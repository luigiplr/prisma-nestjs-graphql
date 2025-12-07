import { GeneratorOptions } from '@prisma/generator-helper';
import AwaitEventEmitter from 'await-event-emitter';
import { Project, SourceFile } from 'ts-morph';

declare type Datamodel = ReadonlyDeep_2<{
    models: Model$1[];
    enums: DatamodelEnum[];
    types: Model$1[];
    indexes: Index[];
}>;

declare type DatamodelEnum = ReadonlyDeep_2<{
    name: string;
    values: EnumValue[];
    dbName?: string | null;
    documentation?: string;
}>;

declare function datamodelEnumToSchemaEnum(datamodelEnum: DatamodelEnum): SchemaEnum;

declare type Deprecation = ReadonlyDeep_2<{
    sinceVersion: string;
    reason: string;
    plannedRemovalVersion?: string;
}>;

declare namespace DMMF {
    export { datamodelEnumToSchemaEnum, ModelAction };
export type { Document_2 as Document, Mappings, OtherOperationMappings, DatamodelEnum, SchemaEnum, EnumValue, Datamodel, uniqueIndex, PrimaryKey, Model$1 as Model, FieldKind, FieldNamespace, FieldLocation, Field$1 as Field, FieldDefault, FieldDefaultScalar, Index, IndexType, IndexField, SortOrder, Schema$1 as Schema, Query, QueryOutput, TypeRef, InputTypeRef, SchemaArg, OutputType, SchemaField, OutputTypeRef, Deprecation, InputType, FieldRefType, FieldRefAllowType, ModelMapping };
}

declare type Document_2 = ReadonlyDeep_2<{
    datamodel: Datamodel;
    schema: Schema$1;
    mappings: Mappings;
}>;

declare type EnumValue = ReadonlyDeep_2<{
    name: string;
    dbName: string | null;
}>;

declare type Field$1 = ReadonlyDeep_2<{
    kind: FieldKind;
    name: string;
    isRequired: boolean;
    isList: boolean;
    isUnique: boolean;
    isId: boolean;
    isReadOnly: boolean;
    isGenerated?: boolean;
    isUpdatedAt?: boolean;
    /**
     * Describes the data type in the same the way it is defined in the Prisma schema:
     * BigInt, Boolean, Bytes, DateTime, Decimal, Float, Int, JSON, String, $ModelName
     */
    type: string;
    /**
     * Native database type, if specified.
     * For example, `@db.VarChar(191)` is encoded as `['VarChar', ['191']]`,
     * `@db.Text` is encoded as `['Text', []]`.
     */
    nativeType?: [string, string[]] | null;
    dbName?: string | null;
    hasDefaultValue: boolean;
    default?: FieldDefault | FieldDefaultScalar | FieldDefaultScalar[];
    relationFromFields?: string[];
    relationToFields?: string[];
    relationOnDelete?: string;
    relationOnUpdate?: string;
    relationName?: string;
    documentation?: string;
}>;

declare type FieldDefault = ReadonlyDeep_2<{
    name: string;
    args: Array<string | number>;
}>;

declare type FieldDefaultScalar = string | boolean | number;

declare type FieldKind = 'scalar' | 'object' | 'enum' | 'unsupported';

declare type FieldLocation = 'scalar' | 'inputObjectTypes' | 'outputObjectTypes' | 'enumTypes' | 'fieldRefTypes';

declare type FieldNamespace = 'model' | 'prisma';

declare type FieldRefAllowType = TypeRef<'scalar' | 'enumTypes'>;

declare type FieldRefType = ReadonlyDeep_2<{
    name: string;
    allowTypes: FieldRefAllowType[];
    fields: SchemaArg[];
}>;

declare type Index = ReadonlyDeep_2<{
    model: string;
    type: IndexType;
    isDefinedOnField: boolean;
    name?: string;
    dbName?: string;
    algorithm?: string;
    clustered?: boolean;
    fields: IndexField[];
}>;

declare type IndexField = ReadonlyDeep_2<{
    name: string;
    sortOrder?: SortOrder;
    length?: number;
    operatorClass?: string;
}>;

declare type IndexType = 'id' | 'normal' | 'unique' | 'fulltext';

declare type InputType = ReadonlyDeep_2<{
    name: string;
    constraints: {
        maxNumFields: number | null;
        minNumFields: number | null;
        fields?: string[];
    };
    meta?: {
        source?: string;
        grouping?: string;
    };
    fields: SchemaArg[];
}>;

declare type InputTypeRef = TypeRef<'scalar' | 'inputObjectTypes' | 'enumTypes' | 'fieldRefTypes'>;

declare type Mappings = ReadonlyDeep_2<{
    modelOperations: ModelMapping[];
    otherOperations: {
        read: string[];
        write: string[];
    };
}>;

declare type Model$1 = ReadonlyDeep_2<{
    name: string;
    dbName: string | null;
    schema: string | null;
    fields: Field$1[];
    uniqueFields: string[][];
    uniqueIndexes: uniqueIndex[];
    documentation?: string;
    primaryKey: PrimaryKey | null;
    isGenerated?: boolean;
}>;

declare enum ModelAction {
    findUnique = "findUnique",
    findUniqueOrThrow = "findUniqueOrThrow",
    findFirst = "findFirst",
    findFirstOrThrow = "findFirstOrThrow",
    findMany = "findMany",
    create = "create",
    createMany = "createMany",
    createManyAndReturn = "createManyAndReturn",
    update = "update",
    updateMany = "updateMany",
    updateManyAndReturn = "updateManyAndReturn",
    upsert = "upsert",
    delete = "delete",
    deleteMany = "deleteMany",
    groupBy = "groupBy",
    count = "count",// TODO: count does not actually exist in DMMF
    aggregate = "aggregate",
    findRaw = "findRaw",
    aggregateRaw = "aggregateRaw"
}

declare type ModelMapping = ReadonlyDeep_2<{
    model: string;
    plural: string;
    findUnique?: string | null;
    findUniqueOrThrow?: string | null;
    findFirst?: string | null;
    findFirstOrThrow?: string | null;
    findMany?: string | null;
    create?: string | null;
    createMany?: string | null;
    createManyAndReturn?: string | null;
    update?: string | null;
    updateMany?: string | null;
    updateManyAndReturn?: string | null;
    upsert?: string | null;
    delete?: string | null;
    deleteMany?: string | null;
    aggregate?: string | null;
    groupBy?: string | null;
    count?: string | null;
    findRaw?: string | null;
    aggregateRaw?: string | null;
}>;

declare type OtherOperationMappings = ReadonlyDeep_2<{
    read: string[];
    write: string[];
}>;

declare type OutputType = ReadonlyDeep_2<{
    name: string;
    fields: SchemaField[];
}>;

declare type OutputTypeRef = TypeRef<'scalar' | 'outputObjectTypes' | 'enumTypes'>;

declare type PrimaryKey = ReadonlyDeep_2<{
    name: string | null;
    fields: string[];
}>;

declare type Query = ReadonlyDeep_2<{
    name: string;
    args: SchemaArg[];
    output: QueryOutput;
}>;

declare type QueryOutput = ReadonlyDeep_2<{
    name: string;
    isRequired: boolean;
    isList: boolean;
}>;

declare type ReadonlyDeep_2<O> = {
    +readonly [K in keyof O]: ReadonlyDeep_2<O[K]>;
};

declare type Schema$1 = ReadonlyDeep_2<{
    rootQueryType?: string;
    rootMutationType?: string;
    inputObjectTypes: {
        model?: InputType[];
        prisma?: InputType[];
    };
    outputObjectTypes: {
        model: OutputType[];
        prisma: OutputType[];
    };
    enumTypes: {
        model?: SchemaEnum[];
        prisma: SchemaEnum[];
    };
    fieldRefTypes: {
        prisma?: FieldRefType[];
    };
}>;

declare type SchemaArg = ReadonlyDeep_2<{
    name: string;
    comment?: string;
    isNullable: boolean;
    isRequired: boolean;
    inputTypes: InputTypeRef[];
    requiresOtherFields?: string[];
    deprecation?: Deprecation;
}>;

declare type SchemaEnum = ReadonlyDeep_2<{
    name: string;
    values: string[];
}>;

declare type SchemaField = ReadonlyDeep_2<{
    name: string;
    isNullable?: boolean;
    outputType: OutputTypeRef;
    args: SchemaArg[];
    deprecation?: Deprecation;
    documentation?: string;
}>;

declare type SortOrder = 'asc' | 'desc';

declare type TypeRef<AllowedLocations extends FieldLocation> = {
    isList: boolean;
    type: string;
    location: AllowedLocations;
    namespace?: FieldNamespace;
};

declare type uniqueIndex = ReadonlyDeep_2<{
    name: string;
    fields: string[];
}>;

/**
Matches any [primitive value](https://developer.mozilla.org/en-US/docs/Glossary/Primitive).

@category Type
*/
type Primitive =
	| null
	| undefined
	| string
	| number
	| boolean
	| symbol
	| bigint;

declare global {
	// eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- It has to be an `interface` so that it can be merged.
	interface SymbolConstructor {
		readonly observable: symbol;
	}
}

/**
Matches any primitive, `void`, `Date`, or `RegExp` value.
*/
type BuiltIns = Primitive | void | Date | RegExp;

/**
Test if the given function has multiple call signatures.

Needed to handle the case of a single call signature with properties.

Multiple call signatures cannot currently be supported due to a TypeScript limitation.
@see https://github.com/microsoft/TypeScript/issues/29732
*/
type HasMultipleCallSignatures<T extends (...arguments_: any[]) => unknown> =
	T extends {(...arguments_: infer A): unknown; (...arguments_: infer B): unknown}
		? B extends A
			? A extends B
				? false
				: true
			: true
		: false;

/**
Create a deeply mutable version of an `object`/`ReadonlyMap`/`ReadonlySet`/`ReadonlyArray` type. The inverse of `ReadonlyDeep<T>`. Use `Writable<T>` if you only need one level deep.

This can be used to [store and mutate options within a class](https://github.com/sindresorhus/pageres/blob/4a5d05fca19a5fbd2f53842cbf3eb7b1b63bddd2/source/index.ts#L72), [edit `readonly` objects within tests](https://stackoverflow.com/questions/50703834), [construct a `readonly` object within a function](https://github.com/Microsoft/TypeScript/issues/24509), or to define a single model where the only thing that changes is whether or not some of the keys are writable.

@example
```
import type {WritableDeep} from 'type-fest';

type Foo = {
	readonly a: number;
	readonly b: readonly string[]; // To show that mutability is deeply affected.
	readonly c: boolean;
};

const writableDeepFoo: WritableDeep<Foo> = {a: 1, b: ['2'], c: true};
writableDeepFoo.a = 3;
writableDeepFoo.b[0] = 'new value';
writableDeepFoo.b = ['something'];
```

Note that types containing overloaded functions are not made deeply writable due to a [TypeScript limitation](https://github.com/microsoft/TypeScript/issues/29732).

@see Writable
@category Object
@category Array
@category Set
@category Map
*/
type WritableDeep<T> = T extends BuiltIns
	? T
	: T extends (...arguments_: any[]) => unknown
		? {} extends WritableObjectDeep<T>
			? T
			: HasMultipleCallSignatures<T> extends true
				? T
				: ((...arguments_: Parameters<T>) => ReturnType<T>) & WritableObjectDeep<T>
		: T extends ReadonlyMap<unknown, unknown>
			? WritableMapDeep<T>
			: T extends ReadonlySet<unknown>
				? WritableSetDeep<T>
				: T extends readonly unknown[]
					? WritableArrayDeep<T>
					: T extends object
						? WritableObjectDeep<T>
						: unknown;

/**
Same as `WritableDeep`, but accepts only `Map`s as inputs. Internal helper for `WritableDeep`.
*/
type WritableMapDeep<MapType extends ReadonlyMap<unknown, unknown>> =
	MapType extends ReadonlyMap<infer KeyType, infer ValueType>
		? Map<WritableDeep<KeyType>, WritableDeep<ValueType>>
		: MapType; // Should not heppen

/**
Same as `WritableDeep`, but accepts only `Set`s as inputs. Internal helper for `WritableDeep`.
*/
type WritableSetDeep<SetType extends ReadonlySet<unknown>> =
	SetType extends ReadonlySet<infer ItemType>
		? Set<WritableDeep<ItemType>>
		: SetType; // Should not heppen

/**
Same as `WritableDeep`, but accepts only `object`s as inputs. Internal helper for `WritableDeep`.
*/
type WritableObjectDeep<ObjectType extends object> = {
	-readonly [KeyType in keyof ObjectType]: WritableDeep<ObjectType[KeyType]>
};

/**
Same as `WritableDeep`, but accepts only `Array`s as inputs. Internal helper for `WritableDeep`.
*/
type WritableArrayDeep<ArrayType extends readonly unknown[]> =
	ArrayType extends readonly [] ? []
		: ArrayType extends readonly [...infer U, infer V] ? [...WritableArrayDeep<U>, WritableDeep<V>]
			: ArrayType extends readonly [infer U, ...infer V] ? [WritableDeep<U>, ...WritableArrayDeep<V>]
				: ArrayType extends ReadonlyArray<infer U> ? Array<WritableDeep<U>>
					: ArrayType extends Array<infer U> ? Array<WritableDeep<U>>
						: ArrayType;

declare enum ReExport {
    None = "None",
    Directories = "Directories",
    Single = "Single",
    All = "All"
}

type DecorateElement = {
    isMatchField: (s: string) => boolean;
    isMatchType: (s: string) => boolean;
    from: string;
    name: string;
    arguments?: string[];
    namedImport: boolean;
    defaultImport?: string | true;
    namespaceImport?: string;
};
type CustomImport = {
    from: string;
    name: string;
    namedImport: boolean;
    defaultImport?: string | true;
    namespaceImport?: string;
};
declare function createConfig(data: Record<string, unknown>): {
    outputFilePattern: string;
    tsConfigFilePath: string | undefined;
    prismaClientImport: string;
    combineScalarFilters: boolean;
    noAtomicOperations: boolean;
    reExport: ReExport;
    emitSingle: boolean;
    emitCompiled: boolean;
    emitBlocks: Record<"models" | "inputs" | "args" | "outputs" | "prismaEnums" | "schemaEnums", boolean>;
    omitModelsCount: boolean;
    $warnings: string[];
    fields: Record<string, Partial<Omit<ObjectSetting, "name">> | undefined>;
    purgeOutput: boolean;
    useInputType: ConfigInputItem[];
    noTypeId: boolean;
    requireSingleFieldsInWhereUniqueInput: boolean;
    unsafeCompatibleWhereUniqueInput: boolean;
    graphqlScalars: Record<string, ImportNameSpec | undefined>;
    decorate: DecorateElement[];
    customImport: CustomImport[];
};
type ConfigInputItem = {
    typeName: string;
    ALL?: string;
    [index: string]: string | undefined;
};

type ObjectSetting = {
    /**
     * Act as named import or namespaceImport or defaultImport
     */
    name: string;
    kind: 'Decorator' | 'Field' | 'FieldType' | 'PropertyType' | 'ObjectType';
    arguments?: string[] | Record<string, unknown>;
    input: boolean;
    output: boolean;
    model: boolean;
    match?: (test: string) => boolean;
    from: string;
    namespace?: string;
    defaultImport?: string | true;
    namespaceImport?: string;
    namedImport?: boolean;
};
interface ObjectSettingsFilterArgs {
    name: string;
    input?: boolean;
    output?: boolean;
}
declare class ObjectSettings extends Array<ObjectSetting> {
    shouldHideField({ name, input, output, }: ObjectSettingsFilterArgs): boolean;
    getFieldType({ name, input, output, }: ObjectSettingsFilterArgs): ObjectSetting | undefined;
    getPropertyType({ name, input, output, }: ObjectSettingsFilterArgs): ObjectSetting | undefined;
    getObjectTypeArguments(options: Record<string, any>): string[];
    fieldArguments(): Record<string, unknown> | undefined;
}

type Model = WritableDeep<DMMF.Model>;
type Schema = WritableDeep<DMMF.Schema>;
type GeneratorConfiguration = ReturnType<typeof createConfig>;
type EventArguments = {
    schema: Schema;
    models: Map<string, Model>;
    modelNames: string[];
    modelFields: Map<string, Map<string, Field>>;
    fieldSettings: Map<string, Map<string, ObjectSettings>>;
    config: GeneratorConfiguration;
    project: Project;
    output: string;
    getSourceFile(args: {
        type: string;
        name: string;
    }): SourceFile;
    eventEmitter: AwaitEventEmitter;
    typeNames: Set<string>;
    removeTypes: Set<string>;
    enums: Record<string, DMMF.DatamodelEnum | undefined>;
    getModelName(name: string): string | undefined;
    /**
     * Input types for this models should be decorated @Type(() => Self)
     */
    classTransformerTypeModels: Set<string>;
};
type ImportNameSpec = {
    name: string;
    specifier?: string;
};
type Field = DMMF.Field;

declare function generate(args: GeneratorOptions & {
    skipAddOutputSourceFiles?: boolean;
    connectCallback?: (emitter: AwaitEventEmitter, eventArguments: EventArguments) => void | Promise<void>;
}): Promise<void>;

export { generate };
