'use strict';

var require$$0 = require('await-event-emitter');
var assert = require('assert');
var lodash = require('lodash');
var tsMorph = require('ts-morph');
var JSON5 = require('json5');
var pupa = require('pupa');
var getRelativePath = require('get-relative-path');
var outmatch = require('outmatch');
var gracefulFs = require('graceful-fs');
var filenamify = require('filenamify');
var flat = require('flat');
var pluralize = require('pluralize');

function isManyAndReturnOutputType(name) {
  const lowerName = name.toLowerCase();
  if ((lowerName.startsWith("createmany") || lowerName.startsWith("updatemany")) && (lowerName.endsWith("andreturnoutputtype") || lowerName.endsWith("andreturn"))) {
    return true;
  }
  return false;
}

function pascalCase(string) {
  return lodash.startCase(lodash.camelCase(string)).replaceAll(" ", "");
}

function argsType(field, args) {
  if (["queryRaw", "executeRaw"].includes(field.name)) {
    return;
  }
  if (isManyAndReturnOutputType(field.name)) return;
  const { eventEmitter, typeNames, getModelName } = args;
  let className = pascalCase(`${field.name}Args`);
  const modelName = getModelName(className) || "";
  switch (className) {
    case `Aggregate${modelName}Args`: {
      className = `${modelName}AggregateArgs`;
      break;
    }
    case `GroupBy${modelName}Args`: {
      className = `${modelName}GroupByArgs`;
      break;
    }
  }
  const inputType = {
    // eslint-disable-next-line unicorn/no-null
    constraints: { maxNumFields: null, minNumFields: null },
    name: className,
    fields: [...field.args]
  };
  if (!field.args.some((x) => x.name === "_count") && [`${modelName}AggregateArgs`, `${modelName}GroupByArgs`].includes(className)) {
    const names = ["Count", "Avg", "Sum", "Min", "Max"];
    if (`${modelName}GroupByArgs` === inputType.name) {
      const byField = inputType.fields.find((f) => f.name === "by");
      if (byField?.inputTypes) {
        byField.inputTypes = byField.inputTypes.filter((inputType2) => inputType2.isList);
      }
    }
    for (const name of names) {
      if (!typeNames.has(`${modelName}${name}AggregateInput`)) {
        continue;
      }
      inputType.fields.push({
        name: `_${name.toLowerCase()}`,
        isRequired: false,
        isNullable: true,
        inputTypes: [
          {
            location: "inputObjectTypes",
            type: `${modelName}${name}AggregateInput`,
            isList: false
          }
        ]
      });
    }
  }
  eventEmitter.emitSync("InputType", {
    ...args,
    inputType,
    fileType: "args",
    classDecoratorName: "ArgsType"
  });
}

const BeforeGenerateField = "BeforeGenerateField";

function combineScalarFilters(eventEmitter) {
  eventEmitter.on("BeforeInputType", beforeInputType$2);
  eventEmitter.on(BeforeGenerateField, beforeGenerateField);
  eventEmitter.on("PostBegin", postBegin);
}
function beforeInputType$2(args) {
  const { inputType, removeTypes } = args;
  if (isContainBogus(inputType.name) && isScalarFilter(inputType)) {
    removeTypes.add(inputType.name);
    inputType.name = replaceBogus(inputType.name);
  }
}
function beforeGenerateField(field) {
  for (const fieldInput of field.inputTypes) {
    if (fieldInput.location !== "inputObjectTypes") {
      continue;
    }
    const fieldInputType = String(fieldInput.type);
    if (isContainBogus(fieldInputType)) {
      fieldInput.type = replaceBogus(fieldInputType);
    }
  }
}
function replaceBogus(name) {
  return name.replaceAll(/Nullable|Nested/g, "");
}
function isContainBogus(name) {
  return name.startsWith("Nested") || name.includes("Nullable") && name.endsWith("Filter") || name.endsWith("NullableFilter");
}
function isScalarFilter(inputType) {
  if (!inputType.name.endsWith("Filter")) {
    return false;
  }
  let result = false;
  const equals = inputType.fields.find((f) => f.name === "equals");
  if (equals) {
    result = equals.inputTypes.every((x) => {
      return ["enumTypes", "scalar"].includes(x.location);
    });
  }
  return result;
}
function postBegin(args) {
  const { modelNames, schema } = args;
  const inputTypes = schema.inputObjectTypes.prisma;
  const enumTypes = schema.enumTypes.model || [];
  const types = [
    "Bool",
    "Int",
    "String",
    "DateTime",
    "Decimal",
    "Float",
    "Json",
    "Bytes",
    "BigInt"
  ];
  for (const enumType of enumTypes) {
    const { name } = enumType;
    types.push(`Enum${name}`);
  }
  const inputTypeByName = lodash.keyBy(inputTypes, (inputType) => inputType.name);
  const replaceBogusFilters = (filterName, filterNameCandidates) => {
    for (const filterNameCandidate of filterNameCandidates) {
      const candidate = inputTypeByName[filterNameCandidate];
      if (candidate) {
        const inputType = lodash.cloneDeep({ ...candidate, name: filterName });
        inputTypes.push(inputType);
        inputTypeByName[filterName] = inputType;
        break;
      }
    }
  };
  for (const type of types) {
    replaceBogusFilters(`${type}Filter`, [
      `${type}NullableFilter`,
      `Nested${type}NullableFilter`
    ]);
    replaceBogusFilters(`${type}WithAggregatesFilter`, [
      `${type}NullableWithAggregatesFilter`,
      `Nested${type}NullableWithAggregatesFilter`
    ]);
    replaceBogusFilters(`${type}ListFilter`, [
      `${type}NullableListFilter`,
      `Nested${type}NullableListFilter`
    ]);
  }
  for (const modelName of modelNames) {
    replaceBogusFilters(`${modelName}RelationFilter`, [
      `${modelName}NullableRelationFilter`
    ]);
  }
  for (const modelName of modelNames) {
    replaceBogusFilters(`${modelName}ScalarRelationFilter`, [
      `${modelName}NullableScalarRelationFilter`
    ]);
  }
  lodash.remove(inputTypes, (inputType) => {
    return isContainBogus(inputType.name);
  });
}

function createAggregateInput(args) {
  const { eventEmitter, outputType } = args;
  const className = `${outputType.name}Input`;
  const inputType = {
    // eslint-disable-next-line unicorn/no-null
    constraints: { maxNumFields: null, minNumFields: null },
    name: className,
    fields: outputType.fields.map((x) => ({
      name: x.name,
      isNullable: x.isNullable ?? true,
      isRequired: false,
      inputTypes: [
        {
          isList: false,
          type: "true",
          location: "scalar"
        }
      ]
    }))
  };
  eventEmitter.emitSync("InputType", {
    ...args,
    inputType,
    fileType: "input",
    classDecoratorName: "InputType"
  });
}

function emitSingle(emitter) {
  emitter.on("ClassProperty", classProperty);
}
function classProperty(property, eventArguments) {
  const { location, isList, propertyType } = eventArguments;
  if (["inputObjectTypes", "outputObjectTypes"].includes(location) && !isList) {
    const [safeTypes, instanceofTypes] = lodash.partition(
      propertyType,
      (t) => t === "null" || t.startsWith("Prisma.")
    );
    const mappedInstanceofTypes = instanceofTypes.map((t) => `InstanceType<typeof ${t}>`);
    property.type = [...mappedInstanceofTypes, ...safeTypes].join(" | ");
  }
}

class ImportDeclarationMap extends Map {
  add(name, value) {
    if (!this.has(name)) {
      const structure = typeof value === "string" ? { moduleSpecifier: value, namedImports: [{ name }] } : value;
      this.set(name, structure);
    }
  }
  create(args) {
    const { from, defaultImport, namespaceImport, namedImport } = args;
    let name = args.name;
    const value = {
      moduleSpecifier: from,
      namedImports: [],
      defaultImport: void 0,
      namespaceImport: void 0
    };
    if (namedImport === true && namespaceImport) {
      value.namedImports = [{ name: namespaceImport }];
      name = namespaceImport;
    } else if (defaultImport) {
      value.defaultImport = defaultImport === true ? name : defaultImport;
      name = value.defaultImport;
    } else if (namespaceImport) {
      value.namespaceImport = namespaceImport;
      name = namespaceImport;
    } else {
      value.namedImports = [{ name }];
    }
    this.add(name, value);
  }
  *toStatements() {
    const iterator = this.values();
    let result = iterator.next();
    while (result.value) {
      yield {
        ...result.value,
        kind: tsMorph.StructureKind.ImportDeclaration
      };
      result = iterator.next();
    }
  }
}

async function generateFiles(args) {
  const { config, eventEmitter, output, project } = args;
  if (config.emitSingle) {
    const rootDirectory = project.getDirectory(output) || project.createDirectory(output);
    const sourceFile = rootDirectory.getSourceFile("index.ts") || rootDirectory.createSourceFile("index.ts", void 0, { overwrite: true });
    const statements = project.getSourceFiles().flatMap((s) => {
      if (s === sourceFile) {
        return [];
      }
      const classDeclaration = s.getClass(() => true);
      const statements2 = s.getStructure().statements;
      if (Array.isArray(statements2)) {
        for (const statement of statements2) {
          if (!(typeof statement === "object" && statement.kind === tsMorph.StructureKind.Class)) {
            continue;
          }
          for (const property of statement.properties || []) {
            for (const decorator of property.decorators || []) {
              const fullName = classDeclaration?.getProperty(property.name)?.getDecorator(decorator.name)?.getFullName();
              assert.ok(
                fullName,
                `Cannot get full name of decorator of class ${statement.name}`
              );
              decorator.name = fullName;
            }
          }
        }
      }
      project.removeSourceFile(s);
      return statements2;
    });
    const imports = new ImportDeclarationMap();
    const enums = [];
    const classes = [];
    for (const statement of statements) {
      if (typeof statement === "string") {
        if (statement.startsWith("registerEnumType")) {
          enums.push(statement);
        }
        continue;
      }
      switch (statement.kind) {
        case tsMorph.StructureKind.ImportDeclaration: {
          if (statement.moduleSpecifier.startsWith("./") || statement.moduleSpecifier.startsWith("..")) {
            continue;
          }
          for (const namedImport of statement.namedImports) {
            const name = namedImport.alias || namedImport.name;
            imports.add(name, statement.moduleSpecifier);
          }
          if (statement.defaultImport) {
            imports.create({
              defaultImport: statement.defaultImport,
              from: statement.moduleSpecifier,
              name: statement.defaultImport
            });
          }
          if (statement.namespaceImport) {
            imports.create({
              from: statement.moduleSpecifier,
              name: statement.namespaceImport,
              namespaceImport: statement.namespaceImport
            });
          }
          break;
        }
        case tsMorph.StructureKind.Enum: {
          enums.unshift(statement);
          break;
        }
        case tsMorph.StructureKind.Class: {
          classes.push(statement);
          break;
        }
      }
    }
    for (const customImport of config.customImport) {
      imports.create(customImport);
    }
    sourceFile.set({
      kind: tsMorph.StructureKind.SourceFile,
      statements: [...imports.toStatements(), ...enums, ...classes]
    });
  }
  if (config.emitCompiled) {
    project.compilerOptions.set({
      declaration: true,
      declarationDir: output,
      emitDecoratorMetadata: false,
      outDir: output,
      rootDir: output,
      skipLibCheck: true
    });
    const emitResult = await project.emit();
    const errors = emitResult.getDiagnostics().map((d) => String(d.getMessageText()));
    if (errors.length > 0) {
      eventEmitter.emitSync("Warning", errors);
    }
  } else {
    await project.save();
  }
}

function fileTypeByLocation(fieldLocation) {
  switch (fieldLocation) {
    case "inputObjectTypes": {
      return "input";
    }
    case "outputObjectTypes": {
      return "output";
    }
    case "enumTypes": {
      return "enum";
    }
  }
  return "object";
}

function relativePath(from, to) {
  if (!from.startsWith("/")) {
    from = `/${from}`;
  }
  if (!to.startsWith("/")) {
    to = `/${to}`;
  }
  let result = getRelativePath(from, to);
  if (!result.startsWith(".")) {
    result = `./${result}`;
  }
  if (result.endsWith(".ts")) {
    result = result.slice(0, -3);
  }
  return result;
}

function getGraphqlImport(args) {
  const {
    config,
    fileType,
    getSourceFile,
    isId,
    location,
    noTypeId,
    sourceFile,
    typeName
  } = args;
  if (location === "scalar") {
    if (isId && !noTypeId) {
      return { name: "ID", specifier: "@nestjs/graphql" };
    }
    const graphqlType = config.graphqlScalars[typeName];
    if (graphqlType) {
      return { name: graphqlType.name, specifier: graphqlType.specifier };
    }
    switch (typeName) {
      case "Float":
      case "Int": {
        return { name: typeName, specifier: "@nestjs/graphql" };
      }
      case "DateTime": {
        return { name: "Date", specifier: void 0 };
      }
      case "true":
      case "Boolean": {
        return { name: "Boolean", specifier: void 0 };
      }
      case "Decimal": {
        return {
          name: "GraphQLDecimal",
          specifier: "prisma-graphql-type-decimal"
        };
      }
      case "Json": {
        return { name: "GraphQLJSON", specifier: "graphql-type-json" };
      }
    }
    return { name: "String", specifier: void 0 };
  }
  let sourceFileType = fileTypeByLocation(location);
  if (sourceFileType === "output" && fileType === "model") {
    sourceFileType = "model";
  }
  const specifier = relativePath(
    sourceFile.getFilePath(),
    getSourceFile({
      name: typeName,
      type: sourceFileType
    }).getFilePath()
  );
  return { name: typeName, specifier };
}

function getGraphqlInputType(inputTypes, pattern) {
  let result;
  inputTypes = inputTypes.filter((t) => !["null", "Null"].includes(String(t.type)));
  inputTypes = lodash.uniqWith(inputTypes, lodash.isEqual);
  if (inputTypes.length === 1) {
    return inputTypes[0];
  }
  const countTypes = lodash.countBy(inputTypes, (x) => x.location);
  const isOneType = Object.keys(countTypes).length === 1;
  if (isOneType) {
    result = inputTypes.find((x) => x.isList);
    if (result) {
      return result;
    }
  }
  if (pattern) {
    if (pattern.startsWith("matcher:") || pattern.startsWith("match:")) {
      const { 1: patternValue } = pattern.split(":", 2);
      const isMatch = outmatch(patternValue, { separator: false });
      result = inputTypes.find((x) => isMatch(String(x.type)));
      if (result) {
        return result;
      }
    }
    result = inputTypes.find((x) => String(x.type).includes(pattern));
    if (result) {
      return result;
    }
  }
  result = inputTypes.find((x) => x.location === "inputObjectTypes");
  if (result) {
    return result;
  }
  if (countTypes.enumTypes && countTypes.scalar && inputTypes.some((x) => x.type === "Json" && x.location === "scalar")) {
    result = inputTypes.find((x) => x.type === "Json" && x.location === "scalar");
    if (result) {
      return result;
    }
  }
  if ((countTypes.scalar >= 1 || countTypes.enumTypes >= 1) && countTypes.fieldRefTypes === 1) {
    result = inputTypes.find(
      (x) => (x.location === "scalar" || x.location === "enumTypes") && x.isList
    );
    if (result) {
      return result;
    }
    result = inputTypes.find(
      (x) => x.location === "scalar" || x.location === "enumTypes"
    );
    if (result) {
      return result;
    }
  }
  throw new TypeError(
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    `Cannot get matching input type from ${inputTypes.map((x) => x.type).join(", ") || "zero length inputTypes"}`
  );
}

function getPropertyType(args) {
  const { location, type } = args;
  switch (type) {
    case "Float":
    case "Int": {
      return ["number"];
    }
    case "String": {
      return ["string"];
    }
    case "Boolean": {
      return ["boolean"];
    }
    case "DateTime": {
      return ["Date", "string"];
    }
    case "Decimal": {
      return ["Prisma.Decimal"];
    }
    case "Json": {
      return ["any"];
    }
    case "Null": {
      return ["null"];
    }
    case "Bytes": {
      return ["Uint8Array"];
    }
    case "BigInt": {
      return ["bigint", "number"];
    }
  }
  if (["inputObjectTypes", "outputObjectTypes"].includes(location)) {
    return [type];
  }
  if (location === "enumTypes") {
    const enumType = "`${" + type + "}`";
    return [enumType];
  }
  if (location === "scalar") {
    return [type];
  }
  return ["unknown"];
}

function getWhereUniqueAtLeastKeys(model) {
  const names = model.fields.filter((field) => field.isUnique || field.isId).map((field) => field.name);
  if (model.primaryKey) {
    names.push(createFieldName(model.primaryKey));
  }
  for (const uniqueIndex of model.uniqueIndexes) {
    names.push(createFieldName(uniqueIndex));
  }
  return names;
}
function createFieldName(args) {
  const { name, fields } = args;
  return name || fields.join("_");
}

function isWhereUniqueInputType(name) {
  return name.endsWith("WhereUniqueInput");
}

function propertyStructure(args) {
  const {
    isNullable,
    propertyType,
    name,
    isList,
    hasQuestionToken,
    hasExclamationToken
  } = args;
  const type = propertyType.map((type2) => isList ? `Array<${type2}>` : type2).join(" | ");
  return {
    kind: tsMorph.StructureKind.Property,
    name,
    type,
    hasQuestionToken: hasQuestionToken ?? isNullable,
    hasExclamationToken: hasExclamationToken ?? !isNullable,
    decorators: [],
    leadingTrivia: "\n"
  };
}

function inputType(args) {
  const {
    classDecoratorName,
    classTransformerTypeModels,
    config,
    eventEmitter,
    fieldSettings,
    fileType,
    getModelName,
    getSourceFile,
    inputType: inputType2,
    models,
    removeTypes,
    typeNames
  } = args;
  typeNames.add(inputType2.name);
  const importDeclarations = new ImportDeclarationMap();
  const sourceFile = getSourceFile({
    name: inputType2.name,
    type: fileType
  });
  const classStructure = {
    kind: tsMorph.StructureKind.Class,
    isExported: true,
    name: inputType2.name,
    decorators: [
      {
        name: classDecoratorName,
        arguments: []
      }
    ],
    properties: []
  };
  const modelName = getModelName(inputType2.name) || "";
  const model = models.get(modelName);
  const modelFieldSettings = model && fieldSettings.get(model.name);
  const moduleSpecifier = "@nestjs/graphql";
  importDeclarations.set("Field", {
    namedImports: [{ name: "Field" }],
    moduleSpecifier
  }).set(classDecoratorName, {
    namedImports: [{ name: classDecoratorName }],
    moduleSpecifier
  });
  const useInputType = config.useInputType.find(
    (x) => inputType2.name.includes(x.typeName)
  );
  const isWhereUnique = isWhereUniqueInputType(inputType2.name);
  for (const field of inputType2.fields) {
    field.inputTypes = field.inputTypes.filter((t) => !removeTypes.has(String(t.type)));
    eventEmitter.emitSync(BeforeGenerateField, field, args);
    const { inputTypes, isRequired, name } = field;
    if (inputTypes.length === 0) {
      continue;
    }
    const usePattern = useInputType?.ALL || useInputType?.[name];
    const graphqlInputType = getGraphqlInputType(inputTypes, usePattern);
    const { isList, location, type } = graphqlInputType;
    const typeName = String(type);
    const settings = modelFieldSettings?.get(name);
    const propertySettings = settings?.getPropertyType({
      name: inputType2.name,
      input: true
    });
    const modelField = model?.fields.find((f) => f.name === name);
    const isCustomsApplicable = typeName === modelField?.type;
    const atLeastKeys = model && getWhereUniqueAtLeastKeys(model);
    const whereUniqueInputType = isWhereUniqueInputType(typeName) && atLeastKeys && `Prisma.AtLeast<${typeName}, ${atLeastKeys.map((name2) => `'${name2}'`).join(" | ")}>`;
    const propertyType = lodash.castArray(
      propertySettings?.name || whereUniqueInputType || getPropertyType({
        location,
        type: typeName
      })
    );
    const hasExclamationToken = Boolean(
      isWhereUnique && config.unsafeCompatibleWhereUniqueInput && atLeastKeys?.includes(name)
    );
    const property = propertyStructure({
      name,
      isNullable: !isRequired,
      hasExclamationToken: hasExclamationToken || void 0,
      hasQuestionToken: hasExclamationToken ? false : void 0,
      propertyType,
      isList
    });
    classStructure.properties.push(property);
    if (propertySettings) {
      importDeclarations.create({ ...propertySettings });
    } else if (propertyType.some((p) => p.startsWith("Prisma."))) {
      importDeclarations.add("Prisma", config.prismaClientImport);
    }
    let graphqlType;
    const shouldHideField = settings?.shouldHideField({
      name: inputType2.name,
      input: true
    }) || config.decorate.some(
      (d) => d.name === "HideField" && d.from === moduleSpecifier && d.isMatchField(name) && d.isMatchType(inputType2.name)
    );
    const fieldType = settings?.getFieldType({
      name: inputType2.name,
      input: true
    });
    if (fieldType && isCustomsApplicable && !shouldHideField) {
      graphqlType = fieldType.name;
      importDeclarations.create({ ...fieldType });
    } else {
      const graphqlImport = getGraphqlImport({
        config,
        sourceFile,
        location,
        typeName,
        getSourceFile
      });
      graphqlType = graphqlImport.name;
      let referenceName = propertyType[0];
      if (location === "enumTypes") {
        referenceName = lodash.last(referenceName.split(" "));
      }
      if (graphqlImport.specifier && !importDeclarations.has(graphqlImport.name) && graphqlImport.name !== inputType2.name) {
        importDeclarations.set(graphqlImport.name, {
          namedImports: [{ name: graphqlImport.name }],
          moduleSpecifier: graphqlImport.specifier
        });
      }
    }
    assert.ok(property.decorators, "property.decorators is undefined");
    if (shouldHideField) {
      importDeclarations.add("HideField", moduleSpecifier);
      property.decorators.push({ name: "HideField", arguments: [] });
    } else {
      property.decorators.push({
        name: "Field",
        arguments: [
          isList ? `() => [${graphqlType}]` : `() => ${graphqlType}`,
          JSON5.stringify({
            ...settings?.fieldArguments(),
            nullable: !isRequired
          })
        ]
      });
      if (graphqlType === "GraphQLDecimal") {
        importDeclarations.add("transformToDecimal", "prisma-graphql-type-decimal");
        importDeclarations.add("Transform", "class-transformer");
        importDeclarations.add("Type", "class-transformer");
        property.decorators.push(
          {
            name: "Type",
            arguments: ["() => Object"]
          },
          {
            name: "Transform",
            arguments: ["transformToDecimal"]
          }
        );
      } else if (location === "inputObjectTypes" && (modelField?.type === "Decimal" || [
        "connect",
        "connectOrCreate",
        "create",
        "createMany",
        "data",
        "delete",
        "deleteMany",
        "disconnect",
        "set",
        "update",
        "updateMany",
        "upsert",
        "where"
      ].includes(name) || classTransformerTypeModels.has(getModelName(graphqlType) || "") || modelField?.kind === "object" && models.get(modelField.type) && models.get(modelField.type)?.fields.some(
        (field2) => field2.kind === "object" && classTransformerTypeModels.has(field2.type)
      ))) {
        importDeclarations.add("Type", "class-transformer");
        property.decorators.push({ name: "Type", arguments: [`() => ${graphqlType}`] });
      }
      if (isCustomsApplicable) {
        for (const options of settings || []) {
          if ((options.kind === "Decorator" && options.input && options.match?.(name)) ?? true) {
            property.decorators.push({
              name: options.name,
              arguments: options.arguments
            });
            assert.ok(options.from, "Missed 'from' part in configuration or field setting");
            importDeclarations.create(options);
          }
        }
      }
      for (const decorate of config.decorate) {
        if (decorate.isMatchField(name) && decorate.isMatchType(inputType2.name)) {
          property.decorators.push({
            name: decorate.name,
            arguments: decorate.arguments?.map((x) => pupa(x, { propertyType }))
          });
          importDeclarations.create(decorate);
        }
      }
    }
    eventEmitter.emitSync("ClassProperty", property, {
      location,
      isList,
      propertyType
    });
  }
  sourceFile.set({
    statements: [...importDeclarations.toStatements(), classStructure]
  });
}

class ObjectSettings extends Array {
  shouldHideField({
    name,
    input = false,
    output = false
  }) {
    const hideField = this.find((s) => s.name === "HideField");
    return Boolean(
      hideField?.input && input || hideField?.output && output || hideField?.match?.(name)
    );
  }
  getFieldType({
    name,
    input,
    output
  }) {
    const fieldType = this.find((s) => s.kind === "FieldType");
    if (!fieldType) {
      return void 0;
    }
    if (fieldType.match) {
      return fieldType.match(name) ? fieldType : void 0;
    }
    if (input && !fieldType.input) {
      return void 0;
    }
    if (output && !fieldType.output) {
      return void 0;
    }
    return fieldType;
  }
  getPropertyType({
    name,
    input,
    output
  }) {
    const propertyType = this.find((s) => s.kind === "PropertyType");
    if (!propertyType) {
      return void 0;
    }
    if (propertyType.match) {
      return propertyType.match(name) ? propertyType : void 0;
    }
    if (input && !propertyType.input) {
      return void 0;
    }
    if (output && !propertyType.output) {
      return void 0;
    }
    return propertyType;
  }
  getObjectTypeArguments(options) {
    const objectTypeOptions = lodash.merge({}, options);
    const resultArguments = [objectTypeOptions];
    const objectType = this.find((s) => s.kind === "ObjectType");
    if (objectType && lodash.isObject(objectType.arguments)) {
      const name = objectType.arguments.name;
      lodash.merge(objectTypeOptions, lodash.omit(objectType.arguments, "name"));
      if (name) {
        resultArguments.unshift(name);
      }
    }
    return resultArguments.map((x) => JSON5.stringify(x));
  }
  fieldArguments() {
    const item = this.find((item2) => item2.kind === "Field");
    if (item) {
      return item.arguments;
    }
  }
}
function createObjectSettings(args) {
  const { config, text } = args;
  const result = new ObjectSettings();
  const textLines = text.split("\n");
  const documentationLines = [];
  let fieldElement = result.find((item) => item.kind === "Field");
  if (!fieldElement) {
    fieldElement = {
      name: "",
      kind: "Field",
      arguments: {}
    };
  }
  for (const line of textLines) {
    const match = /^@(?<name>\w+(\.(\w+))?)\((?<args>.*)\)/.exec(line);
    const { element, documentLine } = createSettingElement({
      line,
      config,
      fieldElement,
      match
    });
    if (element) {
      result.push(element);
    }
    if (documentLine) {
      documentationLines.push(line);
    }
  }
  return {
    settings: result,
    documentation: documentationLines.filter(Boolean).join("\n") || void 0
  };
}
function createSettingElement({
  line,
  config,
  fieldElement,
  match
}) {
  const result = {
    documentLine: "",
    element: void 0
  };
  if (line.startsWith("@deprecated")) {
    fieldElement.arguments["deprecationReason"] = lodash.trim(line.slice(11));
    result.element = fieldElement;
    return result;
  }
  if (line.startsWith("@complexity")) {
    let n = Number.parseInt(lodash.trim(line.slice(11)));
    if (n !== n || n < 1) n = 1;
    fieldElement.arguments["complexity"] = n;
    result.element = fieldElement;
    return result;
  }
  const name = match?.groups?.name;
  if (!(match && name)) {
    result.documentLine = line;
    return result;
  }
  const element = {
    kind: "Decorator",
    name: "",
    arguments: [],
    input: false,
    output: false,
    model: false,
    from: ""
  };
  result.element = element;
  if (name === "TypeGraphQL.omit" || name === "HideField") {
    Object.assign(element, hideFieldDecorator(match));
    return result;
  }
  if (["FieldType", "PropertyType"].includes(name) && match.groups?.args) {
    const options2 = customType(match.groups.args);
    lodash.merge(element, options2.namespace && config.fields[options2.namespace], options2, {
      kind: name
    });
    return result;
  }
  if (name === "ObjectType" && match.groups?.args) {
    element.kind = "ObjectType";
    const options2 = customType(match.groups.args);
    if (typeof options2[0] === "string" && options2[0]) {
      options2.name = options2[0];
    }
    if (lodash.isObject(options2[1])) {
      lodash.merge(options2, options2[1]);
    }
    element.arguments = {
      name: options2.name,
      isAbstract: options2.isAbstract
    };
    return result;
  }
  if (name === "Directive" && match.groups?.args) {
    const options2 = customType(match.groups.args);
    lodash.merge(element, { model: true, from: "@nestjs/graphql" }, options2, {
      name,
      namespace: false,
      kind: "Decorator",
      arguments: Array.isArray(options2.arguments) ? options2.arguments.map((s) => JSON5.stringify(s)) : options2.arguments
    });
    return result;
  }
  const namespace = getNamespace(name);
  element.namespaceImport = namespace;
  const options = {
    name,
    arguments: (match.groups?.args || "").split(",").map((s) => lodash.trim(s)).filter(Boolean)
  };
  lodash.merge(element, namespace && config.fields[namespace], options);
  return result;
}
function customType(args) {
  const result = {};
  let options = parseArgs(args);
  if (typeof options === "string") {
    options = { name: options };
  }
  Object.assign(result, options);
  const namespace = getNamespace(options.name);
  result.namespace = namespace;
  if (options.name?.includes(".")) {
    result.namespaceImport = namespace;
  }
  if (typeof options.match === "string" || Array.isArray(options.match)) {
    result.match = outmatch(options.match, { separator: false });
  }
  return result;
}
function hideFieldDecorator(match) {
  const result = {
    name: "HideField",
    arguments: [],
    from: "@nestjs/graphql",
    defaultImport: void 0,
    namespaceImport: void 0,
    match: void 0
  };
  if (!match.groups?.args) {
    result.output = true;
    return result;
  }
  if (match.groups.args.includes("{") && match.groups.args.includes("}")) {
    const options = parseArgs(match.groups.args);
    result.output = Boolean(options.output);
    result.input = Boolean(options.input);
    if (typeof options.match === "string" || Array.isArray(options.match)) {
      result.match = outmatch(options.match, { separator: false });
    }
  } else {
    if (/output:\s*true/.test(match.groups.args)) {
      result.output = true;
    }
    if (/input:\s*true/.test(match.groups.args)) {
      result.input = true;
    }
  }
  return result;
}
function parseArgs(string) {
  try {
    return JSON5.parse(string);
  } catch {
    try {
      return JSON5.parse(`[${string}]`);
    } catch {
      throw new Error(`Failed to parse: ${string}`);
    }
  }
}
function getNamespace(name) {
  if (name === void 0) {
    return void 0;
  }
  let result = String(name);
  if (result.includes(".")) {
    [result] = result.split(".");
  }
  return result;
}

function modelData(model, args) {
  const {
    config,
    modelNames,
    models,
    modelFields,
    fieldSettings,
    classTransformerTypeModels
  } = args;
  modelNames.push(model.name);
  models.set(model.name, model);
  const modelFieldsValue = /* @__PURE__ */ new Map();
  modelFields.set(model.name, modelFieldsValue);
  const fieldSettingsValue = /* @__PURE__ */ new Map();
  fieldSettings.set(model.name, fieldSettingsValue);
  for (const field of model.fields) {
    if (field.documentation) {
      const { documentation, settings } = createObjectSettings({
        text: field.documentation,
        config
      });
      field.documentation = documentation;
      fieldSettingsValue.set(field.name, settings);
    }
    modelFieldsValue.set(field.name, field);
  }
  if (model.fields.some((field) => field.type === "Decimal")) {
    classTransformerTypeModels.add(model.name);
  }
}

function createComment(documentation, settings) {
  const documentationLines = documentation.split("\n");
  const commentLines = ["/**"];
  for (const line of documentationLines) {
    commentLines.push(` * ${line}`);
  }
  const deprecationReason = settings?.fieldArguments()?.deprecationReason;
  if (deprecationReason) {
    commentLines.push(` * @deprecated ${deprecationReason}`);
  }
  commentLines.push(" */\n");
  return commentLines.join("\n");
}

function getOutputTypeName(name) {
  return name.replace(/(?:OutputType|Output)$/, "");
}

const nestjsGraphql$1 = "@nestjs/graphql";
function modelOutputType(outputType, args) {
  const { config, eventEmitter, fieldSettings, getSourceFile, modelFields, models } = args;
  if (isManyAndReturnOutputType(outputType.name)) return;
  const model = models.get(outputType.name);
  assert.ok(model, `Cannot find model by name ${outputType.name}`);
  const sourceFile = getSourceFile({
    name: outputType.name,
    type: "model"
  });
  const sourceFileStructure = sourceFile.getStructure();
  const exportDeclaration = getExportDeclaration$1(
    model.name,
    sourceFileStructure.statements
  );
  const importDeclarations = new ImportDeclarationMap();
  const classStructure = {
    decorators: [
      {
        arguments: [],
        name: "ObjectType"
      }
    ],
    isExported: true,
    kind: tsMorph.StructureKind.Class,
    name: outputType.name,
    properties: []
  };
  sourceFileStructure.statements.push(classStructure);
  assert.ok(classStructure.decorators, "classStructure.decorators is undefined");
  const decorator = classStructure.decorators.find((d) => d.name === "ObjectType");
  assert.ok(decorator, "ObjectType decorator not found");
  let modelSettings;
  if (model.documentation) {
    const objectTypeOptions = {};
    const { documentation, settings } = createObjectSettings({
      config,
      text: model.documentation
    });
    if (documentation) {
      if (!classStructure.leadingTrivia) {
        classStructure.leadingTrivia = createComment(documentation);
      }
      objectTypeOptions.description = documentation;
    }
    decorator.arguments = settings.getObjectTypeArguments(objectTypeOptions);
    modelSettings = settings;
  }
  importDeclarations.add("Field", nestjsGraphql$1);
  importDeclarations.add("ObjectType", nestjsGraphql$1);
  for (const field of outputType.fields) {
    if (config.omitModelsCount && field.name === "_count") continue;
    let fileType = "model";
    const { isList, location, namespace, type } = field.outputType;
    let outputTypeName = String(type);
    if (namespace !== "model") {
      fileType = "output";
      outputTypeName = getOutputTypeName(outputTypeName);
    }
    const modelField = modelFields.get(model.name)?.get(field.name);
    const settings = fieldSettings.get(model.name)?.get(field.name);
    const fieldType = settings?.getFieldType({
      name: outputType.name,
      output: true
    });
    const propertySettings = settings?.getPropertyType({
      name: outputType.name,
      output: true
    });
    const propertyType = lodash.castArray(
      propertySettings?.name || getPropertyType({
        location,
        type: outputTypeName
      })
    );
    propertyType.splice(1, propertyType.length);
    if (field.isNullable && !isList) {
      propertyType.push("null");
    }
    let graphqlType;
    if (fieldType) {
      graphqlType = fieldType.name;
      importDeclarations.create({ ...fieldType });
    } else {
      const graphqlImport = getGraphqlImport({
        config,
        fileType,
        getSourceFile,
        isId: modelField?.isId,
        location,
        noTypeId: config.noTypeId,
        sourceFile,
        typeName: outputTypeName
      });
      graphqlType = graphqlImport.name;
      if (graphqlImport.name !== outputType.name && graphqlImport.specifier) {
        importDeclarations.add(graphqlImport.name, graphqlImport.specifier);
      }
    }
    const property = propertyStructure({
      hasExclamationToken: true,
      hasQuestionToken: location === "outputObjectTypes",
      isList,
      isNullable: field.isNullable,
      name: field.name,
      propertyType
    });
    if (typeof property.leadingTrivia === "string" && modelField?.documentation) {
      property.leadingTrivia += createComment(modelField.documentation, settings);
    }
    classStructure.properties?.push(property);
    if (propertySettings) {
      importDeclarations.create({ ...propertySettings });
    } else if (propertyType.includes("Prisma.Decimal")) {
      importDeclarations.add("Prisma", config.prismaClientImport);
    }
    assert.ok(property.decorators, "property.decorators is undefined");
    const shouldHideField = settings?.shouldHideField({ name: outputType.name, output: true }) || config.decorate.some(
      (d) => d.name === "HideField" && d.from === "@nestjs/graphql" && d.isMatchField(field.name) && d.isMatchType(outputTypeName)
    );
    if (shouldHideField) {
      importDeclarations.add("HideField", nestjsGraphql$1);
      property.decorators.push({ arguments: [], name: "HideField" });
    } else {
      property.decorators.push({
        arguments: [
          isList ? `() => [${graphqlType}]` : `() => ${graphqlType}`,
          JSON5.stringify({
            ...settings?.fieldArguments(),
            defaultValue: ["number", "string", "boolean"].includes(
              typeof modelField?.default
            ) ? modelField?.default : void 0,
            description: modelField?.documentation,
            nullable: Boolean(field.isNullable)
          })
        ],
        name: "Field"
      });
      for (const setting of settings || []) {
        if (shouldBeDecorated(setting) && (setting.match?.(field.name) ?? true)) {
          property.decorators.push({
            arguments: setting.arguments,
            name: setting.name
          });
          assert.ok(setting.from, "Missed 'from' part in configuration or field setting");
          importDeclarations.create(setting);
        }
      }
      for (const decorate of config.decorate) {
        if (decorate.isMatchField(field.name) && decorate.isMatchType(outputTypeName)) {
          property.decorators.push({
            arguments: decorate.arguments?.map((x) => pupa(x, { propertyType })),
            name: decorate.name
          });
          importDeclarations.create(decorate);
        }
      }
    }
    eventEmitter.emitSync("ClassProperty", property, {
      isList,
      location,
      propertyType
    });
  }
  for (const setting of modelSettings || []) {
    if (shouldBeDecorated(setting)) {
      classStructure.decorators.push({
        arguments: setting.arguments,
        name: setting.name
      });
      importDeclarations.create(setting);
    }
  }
  if (exportDeclaration) {
    sourceFile.set({
      statements: [exportDeclaration, "\n", classStructure]
    });
    const classDeclaration = sourceFile.getClassOrThrow(model.name);
    const commentedText = classDeclaration.getText().split("\n").map((x) => `// ${x}`);
    classDeclaration.remove();
    sourceFile.addStatements(["\n", ...commentedText]);
  } else {
    sourceFile.set({
      statements: [...importDeclarations.toStatements(), classStructure]
    });
  }
}
function shouldBeDecorated(setting) {
  return setting.kind === "Decorator" && (setting.output || setting.model) && !(setting.output && setting.model);
}
function getExportDeclaration$1(name, statements) {
  return statements.find((structure) => {
    return structure.kind === tsMorph.StructureKind.ExportDeclaration && structure.namedExports.some(
      (o) => (o.alias || o.name) === name
    );
  });
}

function noAtomicOperations(eventEmitter) {
  eventEmitter.on("BeforeInputType", beforeInputType$1);
  eventEmitter.on("BeforeGenerateFiles", beforeGenerateFiles$1);
}
function beforeInputType$1(args) {
  const { inputType, getModelName } = args;
  for (const field of inputType.fields) {
    const fieldName = field.name;
    field.inputTypes = field.inputTypes.filter((inputType2) => {
      const inputTypeName = String(inputType2.type);
      const modelName = getModelName(inputTypeName);
      if (isAtomicOperation(inputTypeName) || modelName && isListInput(inputTypeName, modelName, fieldName)) {
        return false;
      }
      return true;
    });
  }
}
function beforeGenerateFiles$1(args) {
  const { project } = args;
  for (const sourceFile of project.getSourceFiles()) {
    const className = sourceFile.getClass(() => true)?.getName();
    if (className && isAtomicOperation(className)) {
      project.removeSourceFile(sourceFile);
    }
  }
}
function isAtomicOperation(typeName) {
  if (typeName.endsWith("FieldUpdateOperationsInput")) {
    return true;
  }
  return false;
}
function isListInput(typeName, model, field) {
  return typeName === `${model}Create${field}Input` || typeName === `${model}Update${field}Input`;
}

function getEnumName(referenceName) {
  return referenceName.slice(3, -2);
}

const nestjsGraphql = "@nestjs/graphql";
function outputType(outputType2, args) {
  const { config, eventEmitter, fieldSettings, getModelName, getSourceFile, models } = args;
  const importDeclarations = new ImportDeclarationMap();
  const fileType = "output";
  const modelName = getModelName(outputType2.name) || "";
  const model = models.get(modelName);
  const isAggregateOutput = model && /(?:Count|Avg|Sum|Min|Max)AggregateOutputType$/.test(outputType2.name) && String(outputType2.name).startsWith(model.name);
  const isCountOutput = model?.name && outputType2.name === `${model.name}CountOutputType`;
  if (!config.emitBlocks.outputs && !isCountOutput) return;
  outputType2.name = getOutputTypeName(outputType2.name);
  if (isAggregateOutput) {
    eventEmitter.emitSync("AggregateOutput", { ...args, outputType: outputType2 });
  }
  const sourceFile = getSourceFile({
    name: outputType2.name,
    type: fileType
  });
  const classStructure = {
    decorators: [
      {
        arguments: [],
        name: "ObjectType"
      }
    ],
    isExported: true,
    kind: tsMorph.StructureKind.Class,
    name: outputType2.name,
    properties: []
  };
  importDeclarations.add("Field", nestjsGraphql);
  importDeclarations.add("ObjectType", nestjsGraphql);
  for (const field of outputType2.fields) {
    const { isList, location, type } = field.outputType;
    const outputTypeName = getOutputTypeName(String(type));
    const settings = isCountOutput ? void 0 : model && fieldSettings.get(model.name)?.get(field.name);
    const propertySettings = settings?.getPropertyType({
      name: outputType2.name,
      output: true
    });
    const isCustomsApplicable = outputTypeName === model?.fields.find((f) => f.name === field.name)?.type;
    field.outputType.type = outputTypeName;
    const propertyType = lodash.castArray(
      propertySettings?.name || getPropertyType({
        location,
        type: outputTypeName
      })
    );
    const property = propertyStructure({
      hasQuestionToken: isCountOutput ? true : void 0,
      isList,
      isNullable: field.isNullable,
      name: field.name,
      propertyType
    });
    classStructure.properties?.push(property);
    if (propertySettings) {
      importDeclarations.create({ ...propertySettings });
    } else if (propertyType.includes("Prisma.Decimal")) {
      importDeclarations.add("Prisma", config.prismaClientImport);
    }
    let graphqlType;
    const shouldHideField = settings?.shouldHideField({
      name: outputType2.name,
      output: true
    }) || config.decorate.some(
      (d) => d.name === "HideField" && d.from === "@nestjs/graphql" && d.isMatchField(field.name) && d.isMatchType(outputTypeName)
    );
    const fieldType = settings?.getFieldType({
      name: outputType2.name,
      output: true
    });
    if (fieldType && isCustomsApplicable && !shouldHideField) {
      graphqlType = fieldType.name;
      importDeclarations.create({ ...fieldType });
    } else {
      const graphqlImport = getGraphqlImport({
        config,
        fileType,
        getSourceFile,
        isId: false,
        location,
        sourceFile,
        typeName: outputTypeName
      });
      const referenceName = location === "enumTypes" ? getEnumName(propertyType[0]) : propertyType[0];
      graphqlType = graphqlImport.name;
      if (graphqlImport.specifier && !importDeclarations.has(graphqlImport.name) && (graphqlImport.name !== outputType2.name && !shouldHideField || shouldHideField && referenceName === graphqlImport.name)) {
        importDeclarations.set(graphqlImport.name, {
          moduleSpecifier: graphqlImport.specifier,
          namedImports: [{ name: graphqlImport.name }]
        });
      }
    }
    assert.ok(property.decorators, "property.decorators is undefined");
    if (shouldHideField) {
      importDeclarations.add("HideField", nestjsGraphql);
      property.decorators.push({ arguments: [], name: "HideField" });
    } else {
      property.decorators.push({
        arguments: [
          isList ? `() => [${graphqlType}]` : `() => ${graphqlType}`,
          JSON5.stringify({
            ...settings?.fieldArguments(),
            nullable: Boolean(field.isNullable)
          })
        ],
        name: "Field"
      });
      if (isCustomsApplicable) {
        for (const options of settings || []) {
          if ((options.kind === "Decorator" && options.output && options.match?.(field.name)) ?? true) {
            property.decorators.push({
              arguments: options.arguments,
              name: options.name
            });
            assert.ok(options.from, "Missed 'from' part in configuration or field setting");
            importDeclarations.create(options);
          }
        }
      }
    }
    eventEmitter.emitSync("ClassProperty", property, {
      isList,
      location,
      propertyType
    });
  }
  sourceFile.set({
    statements: [...importDeclarations.toStatements(), classStructure]
  });
}

function purgeOutput(emitter) {
  emitter.on("Begin", begin);
  emitter.on("End", end);
}
function begin({ project, output }) {
  const sourceFiles = project.getDirectory(output)?.getDescendantSourceFiles();
  if (sourceFiles) {
    for (const sourceFile of sourceFiles) {
      sourceFile.delete();
    }
  }
}
function end({ project, output }) {
  const directories = project.getDirectory(output)?.getDescendantDirectories().filter((directory) => directory.getSourceFiles().length === 0).map((directory) => directory.getPath());
  for (const directory of directories || []) {
    try {
      gracefulFs.rmdirSync(directory);
    } catch {
    }
  }
}

var ReExport = /* @__PURE__ */ ((ReExport2) => {
  ReExport2["None"] = "None";
  ReExport2["Directories"] = "Directories";
  ReExport2["Single"] = "Single";
  ReExport2["All"] = "All";
  return ReExport2;
})(ReExport || {});
function reExport(emitter) {
  emitter.on("BeforeGenerateFiles", beforeGenerateFiles);
}
function beforeGenerateFiles(args) {
  const { project, output, config } = args;
  const rootDirectory = project.getDirectoryOrThrow(output);
  if (["Directories" /* Directories */, "All" /* All */].includes(config.reExport)) {
    for (const directory of rootDirectory.getDescendantDirectories()) {
      let indexSourceFile;
      const exportDeclarations = directory.getSourceFiles().filter((sourceFile) => {
        return sourceFile.getBaseName() !== "index.ts";
      }).map((sourcesFile) => getExportDeclaration(directory, sourcesFile));
      if (exportDeclarations.length > 0) {
        indexSourceFile = directory.createSourceFile(
          "index.ts",
          {
            statements: exportDeclarations
          },
          {
            overwrite: true
          }
        );
      }
      if (indexSourceFile) {
        continue;
      }
      const namespaceExportDeclarations = directory.getDirectories().map(
        (sourceDirectory) => getNamespaceExportDeclaration(directory, sourceDirectory)
      );
      project.createSourceFile(
        `${directory.getPath()}/index.ts`,
        {
          statements: namespaceExportDeclarations
        },
        {
          overwrite: true
        }
      );
    }
  }
  if (config.reExport === "Single" /* Single */) {
    const exportDeclarations = project.getSourceFiles().filter((sourceFile) => {
      return sourceFile.getBaseName() !== "index.ts";
    }).map((sourceFile) => getExportDeclaration(rootDirectory, sourceFile));
    rootDirectory.createSourceFile(
      "index.ts",
      {
        statements: exportDeclarations
      },
      {
        overwrite: true
      }
    );
  }
  if (config.reExport === "All" /* All */) {
    const exportDeclarations = [];
    for (const directory of rootDirectory.getDirectories()) {
      if (directory.getBaseName() === "node_modules") continue;
      const sourceFile = directory.getSourceFileOrThrow("index.ts");
      exportDeclarations.push(getExportDeclaration(rootDirectory, sourceFile));
    }
    rootDirectory.createSourceFile(
      "index.ts",
      {
        statements: exportDeclarations
      },
      {
        overwrite: true
      }
    );
  }
}
function getExportDeclaration(directory, sourceFile) {
  return {
    kind: tsMorph.StructureKind.ExportDeclaration,
    namedExports: sourceFile.getExportSymbols().map((s) => ({ name: s.getName() })),
    moduleSpecifier: directory.getRelativePathAsModuleSpecifierTo(sourceFile)
  };
}
function getNamespaceExportDeclaration(directory, sourceDirectory) {
  return {
    kind: tsMorph.StructureKind.ExportDeclaration,
    moduleSpecifier: directory.getRelativePathAsModuleSpecifierTo(sourceDirectory)
  };
}

function extractEnumValueDocs(values) {
  return Object.fromEntries(
    values.map((value) => {
      const { name } = value;
      const documentation = value.documentation;
      if (typeof documentation !== "string") return null;
      if (documentation.startsWith("@deprecated")) {
        return [name, { deprecationReason: documentation.slice(11).trim() }];
      }
      return [name, { description: documentation }];
    }).filter((entry) => entry !== null)
  );
}

function registerEnum(enumType, args) {
  const { config, enums, getSourceFile } = args;
  if (!config.emitBlocks.prismaEnums && !enums[enumType.name]) return;
  const dataModelEnum = enums[enumType.name];
  const enumTypesData = dataModelEnum?.values || [];
  const sourceFile = getSourceFile({
    name: enumType.name,
    type: "enum"
  });
  const importDeclarations = new ImportDeclarationMap();
  importDeclarations.set("registerEnumType", {
    moduleSpecifier: "@nestjs/graphql",
    namedImports: [{ name: "registerEnumType" }]
  });
  const valuesMap = extractEnumValueDocs(enumTypesData);
  const filteredValuesMap = Object.fromEntries(
    Object.entries(valuesMap).filter(([_, v]) => Object.keys(v).length > 0)
  );
  const hasValuesMap = Object.keys(filteredValuesMap).length > 0;
  const formattedValuesMap = hasValuesMap ? JSON.stringify(filteredValuesMap, null, 2).replace(/"([^"]+)":/g, "$1:") : "";
  const valuesMapEntry = hasValuesMap ? `, valuesMap: ${formattedValuesMap}` : "";
  const enumStructure = {
    kind: tsMorph.StructureKind.Enum,
    isExported: true,
    name: enumType.name,
    members: enumType.values.map((v) => ({
      name: v,
      initializer: JSON.stringify(v)
    }))
  };
  sourceFile.set({
    statements: [
      ...importDeclarations.toStatements(),
      enumStructure,
      "\n",
      `registerEnumType(${enumType.name}, { name: '${enumType.name}', description: ${JSON.stringify(
        dataModelEnum?.documentation
      )}${valuesMapEntry} })`
    ]
  });
}

function requireSingleFieldsInWhereUniqueInput(eventEmitter) {
  eventEmitter.on("BeforeInputType", beforeInputType);
}
function beforeInputType(args) {
  const { inputType } = args;
  if (!isWhereUniqueInputType(inputType.name) || inputType.fields.length !== 1) {
    return;
  }
  for (const field of inputType.fields) {
    field.isRequired = true;
    field.isNullable = false;
  }
}

function warning(message) {
  if (Array.isArray(message)) {
    console.log("prisma-nestjs-graphql:");
    console.log(message.join("\n"));
  } else {
    console.log("prisma-nestjs-graphql:", message);
  }
}

const allEmmittedBlocks = [
  "prismaEnums",
  "schemaEnums",
  "models",
  "inputs",
  "args",
  "outputs"
];
const blocksDependencyMap = {
  enums: ["schemaEnums", "prismaEnums"],
  models: ["models", "schemaEnums"],
  inputs: ["inputs", "prismaEnums"],
  outputs: ["outputs"],
  args: ["args", "inputs", "prismaEnums"]
};
function createEmitBlocks(data) {
  if (!data) {
    return Object.fromEntries(allEmmittedBlocks.map((block) => [block, true]));
  }
  let blocksToEmit = {};
  for (const block of data) {
    if (!Object.keys(blocksDependencyMap).includes(block)) continue;
    blocksToEmit = {
      ...blocksToEmit,
      ...Object.fromEntries(
        blocksDependencyMap[block].map((block2) => [block2, true])
      )
    };
  }
  return blocksToEmit;
}

function createConfig(data) {
  const config = lodash.merge({}, flat.unflatten(data, { delimiter: "_" }));
  const $warnings = [];
  const configOutputFilePattern = String(
    config.outputFilePattern || `{model}/{name}.{type}.ts`
  );
  let outputFilePattern = filenamify(configOutputFilePattern, {
    replacement: "/"
  }).replaceAll("..", "/").replaceAll(/\/+/g, "/");
  outputFilePattern = lodash.trim(outputFilePattern, "/");
  if (outputFilePattern !== configOutputFilePattern) {
    $warnings.push(
      `Due to invalid filepath 'outputFilePattern' changed to '${outputFilePattern}'`
    );
  }
  if (config.reExportAll) {
    $warnings.push(`Option 'reExportAll' is deprecated, use 'reExport' instead`);
    if (toBoolean(config.reExportAll)) {
      config.reExport = "All";
    }
  }
  const fields = Object.fromEntries(
    Object.entries(
      config.fields ?? {}
    ).filter(({ 1: value }) => typeof value === "object").map(([name, value]) => {
      const fieldSetting = {
        arguments: [],
        output: toBoolean(value.output),
        input: toBoolean(value.input),
        model: toBoolean(value.model),
        from: value.from,
        defaultImport: toBoolean(value.defaultImport) ? true : value.defaultImport,
        namespaceImport: value.namespaceImport
      };
      return [name, fieldSetting];
    })
  );
  const decorate = [];
  const configDecorate = Object.values(
    config.decorate || {}
  );
  for (const element of configDecorate) {
    if (!element) continue;
    assert.ok(
      element.from && element.name,
      `Missed 'from' or 'name' part in configuration for decorate`
    );
    decorate.push({
      isMatchField: outmatch(element.field, { separator: false }),
      isMatchType: outmatch(element.type, { separator: false }),
      from: element.from,
      name: element.name,
      namedImport: toBoolean(element.namedImport),
      defaultImport: toBoolean(element.defaultImport) ? true : element.defaultImport,
      namespaceImport: element.namespaceImport,
      arguments: element.arguments ? JSON5.parse(element.arguments) : void 0
    });
  }
  const customImport = [];
  const configCustomImport = Object.values(
    config.customImport || {}
  );
  for (const element of configCustomImport) {
    if (!element) continue;
    assert.ok(
      element.from && element.name,
      `Missed 'from' or 'name' part in configuration for customImport`
    );
    customImport.push({
      from: element.from,
      name: element.name,
      namedImport: toBoolean(element.namedImport),
      defaultImport: toBoolean(element.defaultImport) ? true : element.defaultImport,
      namespaceImport: element.namespaceImport
    });
  }
  return {
    outputFilePattern,
    tsConfigFilePath: createTsConfigFilePathValue(config.tsConfigFilePath),
    prismaClientImport: createPrismaImport(config.prismaClientImport),
    combineScalarFilters: toBoolean(config.combineScalarFilters),
    noAtomicOperations: toBoolean(config.noAtomicOperations),
    reExport: ReExport[String(config.reExport)] || ReExport.None,
    emitSingle: toBoolean(config.emitSingle),
    emitCompiled: toBoolean(config.emitCompiled),
    emitBlocks: createEmitBlocks(config.emitBlocks),
    omitModelsCount: toBoolean(config.omitModelsCount),
    $warnings,
    fields,
    purgeOutput: toBoolean(config.purgeOutput),
    useInputType: createUseInputType(config.useInputType),
    noTypeId: toBoolean(config.noTypeId),
    requireSingleFieldsInWhereUniqueInput: toBoolean(
      config.requireSingleFieldsInWhereUniqueInput
    ),
    unsafeCompatibleWhereUniqueInput: toBoolean(
      config.unsafeCompatibleWhereUniqueInput
    ),
    graphqlScalars: config.graphqlScalars || {},
    decorate,
    customImport
  };
}
const tsConfigFileExists = lodash.memoize((filePath) => {
  return gracefulFs.existsSync(filePath);
});
function createTsConfigFilePathValue(value) {
  if (typeof value === "string") return value;
  if (tsConfigFileExists("tsconfig.json")) return "tsconfig.json";
}
function createPrismaImport(value) {
  if (typeof value === "string") return value;
  return "@prisma/client";
}
function createUseInputType(data) {
  if (!data) {
    return [];
  }
  const result = [];
  for (const [typeName, useInputs] of Object.entries(data)) {
    const entry = {
      typeName,
      ALL: void 0
    };
    if (useInputs.ALL) {
      entry.ALL = useInputs.ALL;
      delete useInputs.ALL;
    }
    for (const [propertyName, pattern] of Object.entries(useInputs)) {
      entry[propertyName] = pattern;
    }
    result.push(entry);
  }
  return result;
}
function toBoolean(value) {
  return ["true", "1", "on"].includes(String(value));
}

function generateFileName(args) {
  const { getModelName, name, template, type } = args;
  return pupa(template, {
    get model() {
      const result = getModelName(name) || "prisma";
      return lodash.kebabCase(result);
    },
    get name() {
      let result = lodash.kebabCase(name);
      for (const suffix of ["input", "args", "enum"]) {
        const ending = `-${suffix}`;
        if (type === suffix && result.endsWith(ending)) {
          result = result.slice(0, -ending.length);
        }
      }
      return result;
    },
    plural: {
      get type() {
        return pluralize(type);
      }
    },
    type
  });
}

function factoryGetSourceFile(args) {
  const { outputFilePattern, output, getModelName, project } = args;
  return function getSourceFile(args2) {
    const { name, type } = args2;
    let filePath = generateFileName({
      getModelName,
      name,
      type,
      template: outputFilePattern
    });
    filePath = `${output}/${filePath}`;
    return project.getSourceFile(filePath) || project.createSourceFile(filePath, void 0, { overwrite: true });
  };
}

function createGetModelName(modelNames) {
  return lodash.memoize(tryGetName);
  function tryGetName(name) {
    return getModelName({ modelNames, name });
  }
}
function getModelName(args) {
  const { modelNames, name } = args;
  for (const keyword of splitKeywords) {
    const [test] = name.split(keyword, 1);
    if (modelNames.includes(test)) {
      return test;
    }
  }
  for (const keyword of endsWithKeywords) {
    const [test] = name.split(keyword).slice(-1);
    if (modelNames.includes(test)) {
      return test;
    }
  }
  for (const [start, end] of middleKeywords) {
    let test = name.slice(start.length).slice(0, -end.length);
    if (modelNames.includes(test) && name.startsWith(start) && name.endsWith(end)) {
      return test;
    }
    test = name.slice(0, -(start + end).length);
    if (modelNames.includes(test) && name.endsWith(start + end)) {
      return test;
    }
  }
  if (name.slice(-19) === "CompoundUniqueInput") {
    const test = name.slice(0, -19);
    const models = modelNames.filter((x) => test.startsWith(x)).sort((a, b) => b.length - a.length);
    return lodash.first(models);
  }
  if (name.slice(-5) === "Count") {
    const test = name.slice(0, -5);
    if (modelNames.includes(test)) {
      return test;
    }
  }
}
const splitKeywords = [
  "CreateInput",
  "CreateMany",
  "CreateNested",
  "CreateOneWithout",
  "CreateOrConnect",
  "CreateWithout",
  "DistinctField",
  "Filter",
  "ManyWithout",
  "OrderByInput",
  "RelationFilter",
  "NullableRelationFilter",
  "ListRelationFilter",
  "ScalarWhereInput",
  "UpdateInput",
  "UpdateMany",
  "UpdateOneRequiredWithout",
  "UpdateOneWithout",
  "UpdateWith",
  "UpsertWith",
  "UpsertWithout",
  "WhereInput",
  "WhereUniqueInput",
  "AvgAggregate",
  "SumAggregate",
  "MinAggregate",
  "MaxAggregate",
  "CountAggregate",
  "ScalarField",
  "GroupBy",
  "OrderBy",
  "UncheckedUpdate",
  "UncheckedCreate",
  "ScalarWhere",
  "CountOutputType",
  "CountOrderBy",
  "SumOrderBy",
  "MinOrderBy",
  "MaxOrderBy",
  "AvgOrderBy",
  "Create",
  "Update",
  "ScalarRelationFilter",
  "NullableScalarRelationFilter"
].sort((a, b) => b.length - a.length);
const endsWithKeywords = [
  "Aggregate",
  "GroupBy",
  "CreateOne",
  "CreateMany",
  "DeleteMany",
  "DeleteOne",
  "FindMany",
  "FindOne",
  "FindUnique",
  "UpdateMany",
  "UpdateOne",
  "UpsertOne"
];
const middleKeywords = [
  ["FindFirst", "OrThrowArgs"],
  ["FindUnique", "OrThrowArgs"],
  ["Aggregate", "Args"],
  ["CreateOne", "Args"],
  ["CreateMany", "Args"],
  ["DeleteMany", "Args"],
  ["DeleteOne", "Args"],
  ["FindMany", "Args"],
  ["FindFirst", "Args"],
  ["FindOne", "Args"],
  ["FindUnique", "Args"],
  ["UpdateMany", "Args"],
  ["UpdateMany", "AndReturnOutputType"],
  ["UpdateOne", "Args"],
  ["UpsertOne", "Args"],
  ["GroupBy", "Args"],
  ["OrderBy", "Args"]
];

const AwaitEventEmitter = require$$0.default;
async function generate(args) {
  const { connectCallback, dmmf, generator, skipAddOutputSourceFiles } = args;
  const generatorOutputValue = generator.output?.value;
  assert.ok(generatorOutputValue, "Missing generator configuration: output");
  const config = createConfig(generator.config);
  const eventEmitter = new AwaitEventEmitter();
  eventEmitter.on("Warning", warning);
  config.emitBlocks.models && eventEmitter.on("Model", modelData);
  if (config.emitBlocks.prismaEnums || config.emitBlocks.schemaEnums) {
    eventEmitter.on("EnumType", registerEnum);
  }
  if (config.emitBlocks.outputs || config.emitBlocks.models && !config.omitModelsCount) {
    eventEmitter.on("OutputType", outputType);
  }
  config.emitBlocks.models && eventEmitter.on("ModelOutputType", modelOutputType);
  config.emitBlocks.outputs && eventEmitter.on("AggregateOutput", createAggregateInput);
  config.emitBlocks.inputs && eventEmitter.on("InputType", inputType);
  config.emitBlocks.args && eventEmitter.on("ArgsType", argsType);
  eventEmitter.on("GenerateFiles", generateFiles);
  for (const message of config.$warnings) {
    eventEmitter.emitSync("Warning", message);
  }
  const project = new tsMorph.Project({
    manipulationSettings: {
      quoteKind: tsMorph.QuoteKind.Single
    },
    skipAddingFilesFromTsConfig: true,
    skipLoadingLibFiles: !config.emitCompiled,
    tsConfigFilePath: config.tsConfigFilePath
  });
  if (!skipAddOutputSourceFiles) {
    project.addSourceFilesAtPaths([
      `${generatorOutputValue}/**/*.ts`,
      `!${generatorOutputValue}/**/*.d.ts`
    ]);
  }
  config.combineScalarFilters && combineScalarFilters(eventEmitter);
  config.noAtomicOperations && noAtomicOperations(eventEmitter);
  config.reExport !== ReExport.None && reExport(eventEmitter);
  config.emitSingle && emitSingle(eventEmitter);
  config.purgeOutput && purgeOutput(eventEmitter);
  config.requireSingleFieldsInWhereUniqueInput && requireSingleFieldsInWhereUniqueInput(eventEmitter);
  const models = /* @__PURE__ */ new Map();
  const modelNames = [];
  const modelFields = /* @__PURE__ */ new Map();
  const fieldSettings = /* @__PURE__ */ new Map();
  const getModelName = createGetModelName(modelNames);
  const getSourceFile = factoryGetSourceFile({
    getModelName,
    output: generatorOutputValue,
    outputFilePattern: config.outputFilePattern,
    project
  });
  const { datamodel, schema } = JSON.parse(JSON.stringify(dmmf));
  const removeTypes = /* @__PURE__ */ new Set();
  const eventArguments = {
    classTransformerTypeModels: /* @__PURE__ */ new Set(),
    config,
    enums: lodash.mapKeys(datamodel.enums, (x) => x.name),
    eventEmitter,
    fieldSettings,
    getModelName,
    getSourceFile,
    modelFields,
    modelNames,
    models,
    output: generatorOutputValue,
    project,
    removeTypes,
    schema,
    typeNames: /* @__PURE__ */ new Set()
  };
  if (connectCallback) {
    await connectCallback(eventEmitter, eventArguments);
  }
  await eventEmitter.emit("Begin", eventArguments);
  for (const model of datamodel.models) {
    await eventEmitter.emit("Model", model, eventArguments);
  }
  for (const model of datamodel.types || []) {
    await eventEmitter.emit("Model", model, eventArguments);
  }
  const { enumTypes, inputObjectTypes, outputObjectTypes } = schema;
  await eventEmitter.emit("PostBegin", eventArguments);
  for (const enumType of enumTypes.prisma.concat(enumTypes.model || [])) {
    await eventEmitter.emit("EnumType", enumType, eventArguments);
  }
  for (const outputType2 of outputObjectTypes.model) {
    await eventEmitter.emit("ModelOutputType", outputType2, eventArguments);
  }
  const queryOutputTypes = [];
  for (const outputType2 of outputObjectTypes.prisma) {
    if (["Query", "Mutation"].includes(outputType2.name)) {
      queryOutputTypes.push(outputType2);
      continue;
    }
    await eventEmitter.emit("OutputType", outputType2, eventArguments);
  }
  const inputTypes = inputObjectTypes.prisma.concat(inputObjectTypes.model || []);
  for (const inputType2 of inputTypes) {
    const event = {
      ...eventArguments,
      classDecoratorName: "InputType",
      fileType: "input",
      inputType: inputType2
    };
    if (inputType2.fields.length === 0) {
      removeTypes.add(inputType2.name);
      continue;
    }
    await eventEmitter.emit("BeforeInputType", event);
    await eventEmitter.emit("InputType", event);
  }
  for (const outputType2 of queryOutputTypes) {
    for (const field of outputType2.fields) {
      await eventEmitter.emit("ArgsType", field, eventArguments);
    }
  }
  await eventEmitter.emit("BeforeGenerateFiles", eventArguments);
  await eventEmitter.emit("GenerateFiles", eventArguments);
  await eventEmitter.emit("End", eventArguments);
  for (const name of Object.keys(eventEmitter._events)) {
    eventEmitter.off(name);
  }
}

exports.generate = generate;
