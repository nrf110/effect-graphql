import * as S from "effect/Schema"
import * as AST from "effect/SchemaAST"
import {
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLEnumType,
  GraphQLUnionType,
  GraphQLInputObjectType,
  GraphQLList,
  GraphQLNonNull,
  GraphQLFieldConfigMap,
  GraphQLInputFieldConfigMap,
} from "graphql"
import { toGraphQLType, toGraphQLArgs, toGraphQLInputType } from "../schema-mapping"
import type {
  TypeRegistration,
  InterfaceRegistration,
  EnumRegistration,
  UnionRegistration,
  InputTypeRegistration,
} from "./types"

/**
 * Extract type name from a schema if it has one.
 * Supports:
 * - S.TaggedStruct("Name", {...}) - extracts from _tag literal
 * - S.TaggedClass()("Name", {...}) - extracts from identifier annotation
 * - S.Class<T>("Name")({...}) - extracts from identifier annotation
 */
export function getSchemaName(schema: S.Schema<any, any, any>): string | undefined {
  const ast = schema.ast

  // Handle Transformation (Schema.Class, TaggedClass)
  if (ast._tag === "Transformation") {
    const identifier = AST.getIdentifierAnnotation((ast as any).to)
    if (identifier._tag === "Some") {
      return identifier.value
    }
  }

  // Handle TypeLiteral (TaggedStruct)
  if (ast._tag === "TypeLiteral") {
    const tagProp = (ast as any).propertySignatures.find((p: any) => String(p.name) === "_tag")
    if (tagProp && tagProp.type._tag === "Literal" && typeof tagProp.type.literal === "string") {
      return tagProp.type.literal
    }
  }

  return undefined
}

/**
 * Context needed for type conversion operations
 */
export interface TypeConversionContext {
  types: Map<string, TypeRegistration>
  interfaces: Map<string, InterfaceRegistration>
  enums: Map<string, EnumRegistration>
  unions: Map<string, UnionRegistration>
  inputs: Map<string, InputTypeRegistration>
  typeRegistry: Map<string, GraphQLObjectType>
  interfaceRegistry: Map<string, GraphQLInterfaceType>
  enumRegistry: Map<string, GraphQLEnumType>
  unionRegistry: Map<string, GraphQLUnionType>
  inputRegistry: Map<string, GraphQLInputObjectType>
  // Reverse lookup caches for O(1) type resolution
  schemaToTypeName?: Map<S.Schema<any, any, any>, string>
  astToTypeName?: Map<AST.AST, string>
  schemaToInterfaceName?: Map<S.Schema<any, any, any>, string>
  astToInterfaceName?: Map<AST.AST, string>
  schemaToInputName?: Map<S.Schema<any, any, any>, string>
  astToInputName?: Map<AST.AST, string>
  // Cached sorted values for enum/union matching
  enumSortedValues?: Map<string, readonly string[]>
  unionSortedTypes?: Map<string, readonly string[]>
  // Reverse lookup: literal value -> enum name (for single literal O(1) lookup)
  literalToEnumName?: Map<string, string>
}

/**
 * Build reverse lookup maps from registration maps for O(1) type resolution
 */
export function buildReverseLookups(ctx: TypeConversionContext): void {
  // Build schema/AST -> type name lookups
  if (!ctx.schemaToTypeName) {
    ctx.schemaToTypeName = new Map()
    ctx.astToTypeName = new Map()
    for (const [typeName, typeReg] of ctx.types) {
      ctx.schemaToTypeName.set(typeReg.schema, typeName)
      ctx.astToTypeName.set(typeReg.schema.ast, typeName)

      // Also add unwrapped AST forms for transformation schemas
      let ast = typeReg.schema.ast as any
      while (ast._tag === "Transformation") {
        ast = ast.to
        ctx.astToTypeName.set(ast, typeName)
      }
      // If we hit a Declaration, also add its typeParameters[0]
      if (ast._tag === "Declaration" && ast.typeParameters?.[0]) {
        ctx.astToTypeName.set(ast.typeParameters[0], typeName)
      }
    }
  }

  // Build schema/AST -> interface name lookups
  if (!ctx.schemaToInterfaceName) {
    ctx.schemaToInterfaceName = new Map()
    ctx.astToInterfaceName = new Map()
    for (const [interfaceName, interfaceReg] of ctx.interfaces) {
      ctx.schemaToInterfaceName.set(interfaceReg.schema, interfaceName)
      ctx.astToInterfaceName.set(interfaceReg.schema.ast, interfaceName)

      // Also add unwrapped AST forms for transformation schemas
      let ast = interfaceReg.schema.ast as any
      while (ast._tag === "Transformation") {
        ast = ast.to
        ctx.astToInterfaceName.set(ast, interfaceName)
      }
      // If we hit a Declaration, also add its typeParameters[0]
      if (ast._tag === "Declaration" && ast.typeParameters?.[0]) {
        ctx.astToInterfaceName.set(ast.typeParameters[0], interfaceName)
      }
    }
  }

  // Build schema/AST -> input name lookups
  if (!ctx.schemaToInputName) {
    ctx.schemaToInputName = new Map()
    ctx.astToInputName = new Map()
    for (const [inputName, inputReg] of ctx.inputs) {
      ctx.schemaToInputName.set(inputReg.schema, inputName)
      ctx.astToInputName.set(inputReg.schema.ast, inputName)

      // Also add unwrapped AST forms for transformation schemas
      let ast = inputReg.schema.ast as any
      while (ast._tag === "Transformation") {
        ast = ast.to
        ctx.astToInputName.set(ast, inputName)
      }
      // If we hit a Declaration, also add its typeParameters[0]
      if (ast._tag === "Declaration" && ast.typeParameters?.[0]) {
        ctx.astToInputName.set(ast.typeParameters[0], inputName)
      }
    }
  }

  // Build cached sorted enum values and literal -> enum lookup
  if (!ctx.enumSortedValues) {
    ctx.enumSortedValues = new Map()
    ctx.literalToEnumName = new Map()
    for (const [enumName, enumReg] of ctx.enums) {
      ctx.enumSortedValues.set(enumName, [...enumReg.values].sort())
      // Build literal -> enum reverse lookup for O(1) single literal lookups
      for (const value of enumReg.values) {
        ctx.literalToEnumName.set(value, enumName)
      }
    }
  }

  // Build cached sorted union types
  if (!ctx.unionSortedTypes) {
    ctx.unionSortedTypes = new Map()
    for (const [unionName, unionReg] of ctx.unions) {
      ctx.unionSortedTypes.set(unionName, [...unionReg.types].sort())
    }
  }
}

// GraphQLNonNull wrapper cache for memoization
const nonNullCache = new WeakMap<any, GraphQLNonNull<any>>()

/**
 * Get or create a GraphQLNonNull wrapper (memoized)
 */
export function getNonNull<T extends import("graphql").GraphQLNullableType>(
  type: T
): GraphQLNonNull<T> {
  let cached = nonNullCache.get(type)
  if (!cached) {
    cached = new GraphQLNonNull(type)
    nonNullCache.set(type, cached)
  }
  return cached
}

/**
 * Convert schema to GraphQL type, checking registry first for registered types
 */
export function toGraphQLTypeWithRegistry(
  schema: S.Schema<any, any, any>,
  ctx: TypeConversionContext
): any {
  // Ensure reverse lookup maps are built
  buildReverseLookups(ctx)

  const ast = schema.ast

  // Check registered object types first
  const registeredType = findRegisteredType(schema, ast, ctx)
  if (registeredType) return registeredType

  // Check registered interfaces
  const registeredInterface = findRegisteredInterface(schema, ast, ctx)
  if (registeredInterface) return registeredInterface

  // Handle transformations (like S.Array, S.optional, etc)
  if (ast._tag === "Transformation") {
    return handleTransformationAST(ast, ctx)
  }

  // Handle unions (enum literals or object type unions)
  if (ast._tag === "Union") {
    return handleUnionAST(ast, ctx)
  }

  // Check single literal for enum match
  if (ast._tag === "Literal") {
    const enumType = findEnumForLiteral(ast, ctx)
    if (enumType) return enumType
  }

  // Handle tuple types (readonly arrays)
  if (ast._tag === "TupleType") {
    return handleTupleTypeAST(ast, ctx)
  }

  // Handle Declaration (e.g., Option, Schema.Class)
  if (ast._tag === "Declaration") {
    // Option declarations map to nullable inner type
    if (isOptionDeclaration(ast)) {
      const innerType = getOptionInnerType(ast)
      if (innerType) {
        return toGraphQLTypeWithRegistry(S.make(innerType), ctx)
      }
    }
    // For other declarations (like Schema.Class), extract TypeLiteral from typeParameters
    const typeParams = (ast as any).typeParameters
    if (typeParams && typeParams.length > 0) {
      return toGraphQLTypeWithRegistry(S.make(typeParams[0]), ctx)
    }
  }

  // Handle Suspend (recursive/self-referential schemas)
  if (ast._tag === "Suspend") {
    const innerAst = (ast as any).f()
    return toGraphQLTypeWithRegistry(S.make(innerAst), ctx)
  }

  // Fall back to default conversion
  return toGraphQLType(schema)
}

/**
 * Find a registered object type matching this schema (O(1) with reverse lookup)
 */
function findRegisteredType(
  schema: S.Schema<any, any, any>,
  ast: AST.AST,
  ctx: TypeConversionContext
): GraphQLObjectType | undefined {
  // Use reverse lookup maps for O(1) lookup
  const typeName = ctx.schemaToTypeName?.get(schema) ?? ctx.astToTypeName?.get(ast)
  if (typeName) {
    return ctx.typeRegistry.get(typeName)
  }
  return undefined
}

/**
 * Find a registered interface matching this schema (O(1) with reverse lookup)
 */
function findRegisteredInterface(
  schema: S.Schema<any, any, any>,
  ast: AST.AST,
  ctx: TypeConversionContext
): GraphQLInterfaceType | undefined {
  // Use reverse lookup maps for O(1) lookup
  const interfaceName = ctx.schemaToInterfaceName?.get(schema) ?? ctx.astToInterfaceName?.get(ast)
  if (interfaceName) {
    return ctx.interfaceRegistry.get(interfaceName)
  }
  return undefined
}

/**
 * Check if a Declaration AST node represents an Option type.
 * Option declarations have a TypeConstructor annotation of 'effect/Option'.
 */
function isOptionDeclaration(ast: AST.AST): boolean {
  if (ast._tag === "Declaration") {
    const annotations = (ast as any).annotations
    if (annotations) {
      const TypeConstructorSymbol = Symbol.for("effect/annotation/TypeConstructor")
      const typeConstructor = annotations[TypeConstructorSymbol]
      if (typeConstructor && typeConstructor._tag === "effect/Option") {
        return true
      }
    }
  }
  return false
}

/**
 * Get the inner type from an Option Declaration.
 */
function getOptionInnerType(ast: AST.AST): AST.AST | undefined {
  if (ast._tag === "Declaration") {
    const typeParams = (ast as any).typeParameters
    if (typeParams && typeParams.length > 0) {
      return typeParams[0]
    }
  }
  return undefined
}

/**
 * Handle Transformation AST nodes (arrays, optional, Schema.Class, Option, etc.)
 */
function handleTransformationAST(ast: any, ctx: TypeConversionContext): any {
  const toAst = ast.to
  const fromAst = ast.from

  // Check if it's an Option transformation (e.g., S.OptionFromNullOr)
  // These should map to the nullable inner type
  if (isOptionDeclaration(toAst)) {
    // For S.OptionFromNullOr, the wrapped type is in the 'from' Union, not in typeParameters
    // Structure: Transformation { from: Union[X.ast, Literal], to: Declaration(Option) }
    if (fromAst && fromAst._tag === "Union") {
      // Check if any union member is a registered type
      for (const memberAst of fromAst.types) {
        // Skip null/undefined literals
        if (memberAst._tag === "Literal") continue
        if (memberAst._tag === "UndefinedKeyword") continue

        // Check cache first for O(1) lookup
        const typeName = ctx.astToTypeName?.get(memberAst)
        if (typeName) {
          const result = ctx.typeRegistry.get(typeName)
          if (result) return result
        }

        // Fallback: Linear scan to check if memberAst matches any registered type
        for (const [regTypeName, typeReg] of ctx.types) {
          if (typeReg.schema.ast === memberAst) {
            const result = ctx.typeRegistry.get(regTypeName)
            if (result) return result
          }
        }

        // Check for transformations wrapping registered types
        if (memberAst._tag === "Transformation") {
          const innerToAst = memberAst.to
          const transformedTypeName = ctx.astToTypeName?.get(innerToAst)
          if (transformedTypeName) {
            const result = ctx.typeRegistry.get(transformedTypeName)
            if (result) return result
          }
          // Fallback: Linear scan for transformation's inner AST
          for (const [regTypeName, typeReg] of ctx.types) {
            if (typeReg.schema.ast === innerToAst) {
              const result = ctx.typeRegistry.get(regTypeName)
              if (result) return result
            }
          }
        }

        // Check for Option.Some pattern - TypeLiteral with 'value' field
        if (memberAst._tag === "TypeLiteral") {
          const valueField = memberAst.propertySignatures?.find(
            (p: any) => String(p.name) === "value"
          )
          if (valueField) {
            const valueType = valueField.type

            // Check cache first
            const valueTypeName = ctx.astToTypeName?.get(valueType)
            if (valueTypeName) {
              const result = ctx.typeRegistry.get(valueTypeName)
              if (result) return result
            }

            // Fallback: Linear scan for value type
            for (const [regTypeName, typeReg] of ctx.types) {
              if (typeReg.schema.ast === valueType) {
                const result = ctx.typeRegistry.get(regTypeName)
                if (result) return result
              }
              // Also check unwrapped forms
              let regAst = typeReg.schema.ast as any
              while (regAst._tag === "Transformation") {
                regAst = regAst.to
                if (regAst === valueType) {
                  const result = ctx.typeRegistry.get(regTypeName)
                  if (result) return result
                }
              }
            }

            // Recursively resolve the value type
            const innerResult = toGraphQLTypeWithRegistry(S.make(valueType), ctx)
            if (innerResult) return innerResult
          }
        }
      }
    }

    // Fallback to typeParameters for S.Option(X)
    const innerType = getOptionInnerType(toAst)
    if (innerType) {
      // Return the inner type as nullable (not wrapped in NonNull)
      return toGraphQLTypeWithRegistry(S.make(innerType), ctx)
    }
  }

  // Check if it's an array (readonly array on the to side)
  if (toAst._tag === "TupleType") {
    if (toAst.rest && toAst.rest.length > 0) {
      const elementSchema = S.make(toAst.rest[0].type)
      const elementType = toGraphQLTypeWithRegistry(elementSchema, ctx)
      return new GraphQLList(elementType)
    } else if (toAst.elements.length > 0) {
      const elementSchema = S.make(toAst.elements[0].type)
      const elementType = toGraphQLTypeWithRegistry(elementSchema, ctx)
      return new GraphQLList(elementType)
    }
  }

  // Other transformations - recurse on the "to" side
  return toGraphQLTypeWithRegistry(S.make(ast.to), ctx)
}

/**
 * Handle Union AST nodes (literal enums or object type unions)
 */
function handleUnionAST(ast: any, ctx: TypeConversionContext): any {
  const allLiterals = ast.types.every((t: any) => t._tag === "Literal")

  if (allLiterals) {
    // This might be an enum
    const enumType = findEnumForLiteralUnion(ast.types, ctx)
    if (enumType) return enumType
  } else {
    // This is a Union of object types - check if it matches a registered union
    const unionType = findRegisteredUnion(ast.types, ctx)
    if (unionType) return unionType
  }

  // Check if any union member is a registered type (handles S.Option(RegisteredType))
  // S.Option/S.OptionFromNullOr wraps the type inside a Union in the 'from' position
  for (const memberAst of ast.types) {
    // Check cache first for O(1) lookup
    const typeName = ctx.astToTypeName?.get(memberAst)
    if (typeName) {
      const result = ctx.typeRegistry.get(typeName)
      if (result) return result
    }

    // Fallback: Linear scan to check if memberAst matches any registered type
    for (const [regTypeName, typeReg] of ctx.types) {
      if (typeReg.schema.ast === memberAst) {
        const result = ctx.typeRegistry.get(regTypeName)
        if (result) return result
      }
    }

    // Also check for transformations wrapping registered types
    if (memberAst._tag === "Transformation") {
      const toAst = memberAst.to
      const transformedTypeName = ctx.astToTypeName?.get(toAst)
      if (transformedTypeName) {
        const result = ctx.typeRegistry.get(transformedTypeName)
        if (result) return result
      }
      // Fallback: Linear scan for transformation's inner AST
      for (const [regTypeName, typeReg] of ctx.types) {
        if (typeReg.schema.ast === toAst) {
          const result = ctx.typeRegistry.get(regTypeName)
          if (result) return result
        }
      }
    }

    // Check for Option.Some pattern - TypeLiteral with a 'value' field containing the wrapped type
    if (memberAst._tag === "TypeLiteral") {
      const valueField = memberAst.propertySignatures?.find(
        (p: any) => String(p.name) === "value"
      )
      if (valueField) {
        const valueType = valueField.type

        // Check cache first
        const valueTypeName = ctx.astToTypeName?.get(valueType)
        if (valueTypeName) {
          const result = ctx.typeRegistry.get(valueTypeName)
          if (result) return result
        }

        // Fallback: Linear scan for value type
        for (const [regTypeName, typeReg] of ctx.types) {
          if (typeReg.schema.ast === valueType) {
            const result = ctx.typeRegistry.get(regTypeName)
            if (result) return result
          }
          // Also check unwrapped forms
          let regAst = typeReg.schema.ast as any
          while (regAst._tag === "Transformation") {
            regAst = regAst.to
            if (regAst === valueType) {
              const result = ctx.typeRegistry.get(regTypeName)
              if (result) return result
            }
          }
        }

        // Recursively resolve the value type - this handles transformations, nested options, etc.
        const innerResult = toGraphQLTypeWithRegistry(S.make(valueType), ctx)
        // Return if we found a registered type (has a proper name, not auto-generated)
        if (innerResult) {
          return innerResult
        }
      }
    }
  }

  // Fallback: use first type
  if (ast.types.length > 0) {
    return toGraphQLTypeWithRegistry(S.make(ast.types[0]), ctx)
  }

  return toGraphQLType(S.make(ast))
}

/**
 * Find a registered enum matching a union of literals (uses cached sorted values)
 */
function findEnumForLiteralUnion(
  types: any[],
  ctx: TypeConversionContext
): GraphQLEnumType | undefined {
  const literalValues = types.map((t: any) => String(t.literal)).sort()

  for (const [enumName] of ctx.enums) {
    // Use cached sorted values instead of sorting on every comparison
    const enumValues = ctx.enumSortedValues?.get(enumName)
    if (
      enumValues &&
      literalValues.length === enumValues.length &&
      literalValues.every((v: string, i: number) => v === enumValues[i])
    ) {
      return ctx.enumRegistry.get(enumName)
    }
  }
  return undefined
}

/**
 * Find a registered union matching an object type union (uses cached sorted types)
 */
function findRegisteredUnion(
  types: any[],
  ctx: TypeConversionContext
): GraphQLUnionType | undefined {
  // Collect _tag values from each union member
  const memberTags: string[] = []
  for (const memberAst of types) {
    if (memberAst._tag === "TypeLiteral") {
      const tagProp = memberAst.propertySignatures.find((p: any) => String(p.name) === "_tag")
      if (tagProp && tagProp.type._tag === "Literal") {
        memberTags.push(String(tagProp.type.literal))
      }
    }
  }

  // Check if any registered union has matching types
  if (memberTags.length === types.length) {
    const sortedTags = memberTags.sort()
    for (const [unionName] of ctx.unions) {
      // Use cached sorted types instead of sorting on every comparison
      const unionTypes = ctx.unionSortedTypes?.get(unionName)
      if (
        unionTypes &&
        sortedTags.length === unionTypes.length &&
        sortedTags.every((tag, i) => tag === unionTypes[i])
      ) {
        return ctx.unionRegistry.get(unionName)
      }
    }
  }
  return undefined
}

/**
 * Find a registered enum containing a single literal value (O(1) with reverse lookup)
 */
function findEnumForLiteral(ast: any, ctx: TypeConversionContext): GraphQLEnumType | undefined {
  const literalValue = String(ast.literal)
  // Use reverse lookup map for O(1) lookup instead of O(N×M) iteration
  const enumName = ctx.literalToEnumName?.get(literalValue)
  if (enumName) {
    return ctx.enumRegistry.get(enumName)
  }
  return undefined
}

/**
 * Handle TupleType AST nodes (arrays)
 */
function handleTupleTypeAST(ast: any, ctx: TypeConversionContext): any {
  if (ast.rest && ast.rest.length > 0) {
    const elementSchema = S.make(ast.rest[0].type)
    const elementType = toGraphQLTypeWithRegistry(elementSchema, ctx)
    return new GraphQLList(elementType)
  } else if (ast.elements && ast.elements.length > 0) {
    const elementSchema = S.make(ast.elements[0].type)
    const elementType = toGraphQLTypeWithRegistry(elementSchema, ctx)
    return new GraphQLList(elementType)
  }
  return toGraphQLType(S.make(ast))
}

/**
 * Convert a schema to GraphQL fields
 */
export function schemaToFields(
  schema: S.Schema<any, any, any>,
  ctx: TypeConversionContext
): GraphQLFieldConfigMap<any, any> {
  let ast = schema.ast

  // Handle Transformation (Schema.Class, TaggedClass)
  if (ast._tag === "Transformation") {
    ast = (ast as any).to
  }

  // Handle Declaration (Schema.Class wraps TypeLiteral in Declaration)
  if (ast._tag === "Declaration") {
    const typeParams = (ast as any).typeParameters
    if (typeParams && typeParams.length > 0) {
      let innerAst = typeParams[0]
      // Unwrap transformation to get to TypeLiteral (e.g., when fields have DateFromSelf)
      while (innerAst._tag === "Transformation") {
        innerAst = innerAst.to
      }
      if (innerAst._tag === "TypeLiteral") {
        ast = innerAst
      }
    }
  }

  if (ast._tag === "TypeLiteral") {
    const fields: GraphQLFieldConfigMap<any, any> = {}

    for (const field of (ast as any).propertySignatures) {
      const fieldName = String(field.name)

      // Skip _tag field from TaggedStruct/TaggedClass - it's an internal discriminator
      if (fieldName === "_tag") continue

      const fieldSchema = S.make(field.type)
      let fieldType = toGraphQLTypeWithRegistry(fieldSchema, ctx)

      // Make non-optional fields non-null (memoized)
      if (!field.isOptional) {
        fieldType = getNonNull(fieldType)
      }

      fields[fieldName] = { type: fieldType }
    }

    return fields
  }

  return {}
}

/**
 * Convert a schema to GraphQL input fields
 */
export function schemaToInputFields(
  schema: S.Schema<any, any, any>,
  enumRegistry: Map<string, GraphQLEnumType>,
  inputRegistry: Map<string, GraphQLInputObjectType>,
  inputs: Map<string, InputTypeRegistration>,
  enums: Map<string, EnumRegistration>,
  cache?: InputTypeLookupCache
): GraphQLInputFieldConfigMap {
  let ast = schema.ast

  // Unwrap transformations to get to the underlying type
  while (ast._tag === "Transformation") {
    ast = (ast as any).to
  }

  if (ast._tag === "TypeLiteral") {
    const fields: GraphQLInputFieldConfigMap = {}

    for (const field of ast.propertySignatures) {
      const fieldName = String(field.name)

      // Skip _tag field from TaggedStruct/TaggedClass - it's an internal discriminator
      if (fieldName === "_tag") continue

      const fieldSchema = S.make(field.type)
      let fieldType = toGraphQLInputTypeWithRegistry(
        fieldSchema,
        enumRegistry,
        inputRegistry,
        inputs,
        enums,
        cache
      )

      // Make non-optional fields non-null (memoized)
      if (!field.isOptional) {
        fieldType = getNonNull(fieldType)
      }

      fields[fieldName] = { type: fieldType }
    }

    return fields
  }

  return {}
}

/**
 * Optional cache for input type lookups to enable O(1) resolution
 */
export interface InputTypeLookupCache {
  schemaToInputName?: Map<S.Schema<any, any, any>, string>
  astToInputName?: Map<AST.AST, string>
  literalToEnumName?: Map<string, string>
  enumSortedValues?: Map<string, readonly string[]>
}

/**
 * Build lookup caches for input type resolution
 */
export function buildInputTypeLookupCache(
  inputs: Map<string, InputTypeRegistration>,
  enums: Map<string, EnumRegistration>
): InputTypeLookupCache {
  const cache: InputTypeLookupCache = {
    schemaToInputName: new Map(),
    astToInputName: new Map(),
    literalToEnumName: new Map(),
    enumSortedValues: new Map(),
  }

  // Build input type reverse lookups
  for (const [inputName, inputReg] of inputs) {
    cache.schemaToInputName!.set(inputReg.schema, inputName)
    cache.astToInputName!.set(inputReg.schema.ast, inputName)

    // Also add unwrapped AST forms for transformation schemas
    // This ensures lookups work when encountering unwrapped AST levels
    let ast = inputReg.schema.ast as any
    while (ast._tag === "Transformation") {
      ast = ast.to
      cache.astToInputName!.set(ast, inputName)
    }
    // If we hit a Declaration, also add its typeParameters[0]
    if (ast._tag === "Declaration" && ast.typeParameters?.[0]) {
      cache.astToInputName!.set(ast.typeParameters[0], inputName)
    }
  }

  // Build enum lookups
  for (const [enumName, enumReg] of enums) {
    cache.enumSortedValues!.set(enumName, [...enumReg.values].sort())
    for (const value of enumReg.values) {
      cache.literalToEnumName!.set(value, enumName)
    }
  }

  return cache
}

/**
 * Convert a schema to GraphQL input type, checking enum and input registries.
 * Uses O(1) reverse lookups when cache is provided.
 */
export function toGraphQLInputTypeWithRegistry(
  schema: S.Schema<any, any, any>,
  enumRegistry: Map<string, GraphQLEnumType>,
  inputRegistry: Map<string, GraphQLInputObjectType>,
  inputs: Map<string, InputTypeRegistration>,
  enums: Map<string, EnumRegistration>,
  cache?: InputTypeLookupCache
): any {
  const ast = schema.ast

  // Check if this schema matches a registered input type FIRST (O(1) with cache)
  // This must happen before transformation handling to find registered types
  if (cache?.schemaToInputName || cache?.astToInputName) {
    const inputName = cache.schemaToInputName?.get(schema) ?? cache.astToInputName?.get(ast)
    if (inputName) {
      const result = inputRegistry.get(inputName)
      if (result) return result
    }
  } else {
    // Fallback to linear scan if no cache
    for (const [inputName, inputReg] of inputs) {
      if (inputReg.schema.ast === ast || inputReg.schema === schema) {
        const result = inputRegistry.get(inputName)
        if (result) return result
      }
    }
  }

  // Handle transformations (like S.optional wrapping) AFTER registry lookup
  if (ast._tag === "Transformation") {
    const toAst = (ast as any).to
    const fromAst = (ast as any).from

    // For S.OptionFromNullOr and S.Option, check the 'from' Union for registered input types
    // S.OptionFromNullOr: Transformation { from: Union[X.ast, Literal], to: Declaration(Option) }
    // S.Option: Transformation { from: Union[Option.None, Option.Some{value: X}], to: Declaration(Option) }
    if (isOptionDeclaration(toAst) && fromAst && fromAst._tag === "Union") {
      for (const memberAst of fromAst.types) {
        // Skip null/undefined literals
        if (memberAst._tag === "Literal") continue
        if (memberAst._tag === "UndefinedKeyword") continue

        // Check cache first for O(1) lookup, then recursively process the registered schema
        const inputName = cache?.astToInputName?.get(memberAst)
        if (inputName) {
          const inputReg = inputs.get(inputName)
          if (inputReg) {
            // Recursively process to ensure it gets generated with the registered name
            return toGraphQLInputTypeWithRegistry(
              inputReg.schema,
              enumRegistry,
              inputRegistry,
              inputs,
              enums,
              cache
            )
          }
        }

        // Fallback: Linear scan to check if memberAst matches any registered input
        for (const [, inputReg] of inputs) {
          if (inputReg.schema.ast === memberAst) {
            // Recursively process to ensure it gets generated with the registered name
            return toGraphQLInputTypeWithRegistry(
              inputReg.schema,
              enumRegistry,
              inputRegistry,
              inputs,
              enums,
              cache
            )
          }
        }

        // Check for transformations wrapping registered input types
        if (memberAst._tag === "Transformation") {
          const innerToAst = memberAst.to
          const transformedInputName = cache?.astToInputName?.get(innerToAst)
          if (transformedInputName) {
            const inputReg = inputs.get(transformedInputName)
            if (inputReg) {
              return toGraphQLInputTypeWithRegistry(
                inputReg.schema,
                enumRegistry,
                inputRegistry,
                inputs,
                enums,
                cache
              )
            }
          }
          // Fallback: Linear scan for transformation's inner AST
          for (const [, inputReg] of inputs) {
            if (inputReg.schema.ast === innerToAst) {
              return toGraphQLInputTypeWithRegistry(
                inputReg.schema,
                enumRegistry,
                inputRegistry,
                inputs,
                enums,
                cache
              )
            }
          }
        }

        // Check for Option.Some pattern - TypeLiteral with 'value' field containing the wrapped type
        if (memberAst._tag === "TypeLiteral") {
          const valueField = (memberAst as any).propertySignatures?.find(
            (p: any) => String(p.name) === "value"
          )
          if (valueField) {
            const valueType = valueField.type

            // Check cache first for the value type
            const valueInputName = cache?.astToInputName?.get(valueType)
            if (valueInputName) {
              const inputReg = inputs.get(valueInputName)
              if (inputReg) {
                return toGraphQLInputTypeWithRegistry(
                  inputReg.schema,
                  enumRegistry,
                  inputRegistry,
                  inputs,
                  enums,
                  cache
                )
              }
            }

            // Fallback: Linear scan to check if valueType matches any registered input
            for (const [, inputReg] of inputs) {
              if (inputReg.schema.ast === valueType) {
                return toGraphQLInputTypeWithRegistry(
                  inputReg.schema,
                  enumRegistry,
                  inputRegistry,
                  inputs,
                  enums,
                  cache
                )
              }
              // Also check unwrapped forms of registered schema
              let regAst = inputReg.schema.ast as any
              while (regAst._tag === "Transformation") {
                regAst = regAst.to
                if (regAst === valueType) {
                  return toGraphQLInputTypeWithRegistry(
                    inputReg.schema,
                    enumRegistry,
                    inputRegistry,
                    inputs,
                    enums,
                    cache
                  )
                }
              }
              if (regAst._tag === "Declaration" && regAst.typeParameters?.[0] === valueType) {
                return toGraphQLInputTypeWithRegistry(
                  inputReg.schema,
                  enumRegistry,
                  inputRegistry,
                  inputs,
                  enums,
                  cache
                )
              }
            }

            // Recursively resolve the value type if no direct match found
            const innerResult = toGraphQLInputTypeWithRegistry(
              S.make(valueType),
              enumRegistry,
              inputRegistry,
              inputs,
              enums,
              cache
            )
            if (innerResult) {
              return innerResult
            }
          }
        }
      }
    }

    return toGraphQLInputTypeWithRegistry(
      S.make(toAst),
      enumRegistry,
      inputRegistry,
      inputs,
      enums,
      cache
    )
  }

  // Check if this schema matches a registered enum
  if (ast._tag === "Union") {
    const unionAst = ast as any

    // Handle S.optional which creates Union(LiteralUnion, UndefinedKeyword)
    const nonUndefinedTypes = unionAst.types.filter((t: any) => t._tag !== "UndefinedKeyword")
    if (nonUndefinedTypes.length === 1 && nonUndefinedTypes[0]._tag === "Union") {
      return toGraphQLInputTypeWithRegistry(
        S.make(nonUndefinedTypes[0]),
        enumRegistry,
        inputRegistry,
        inputs,
        enums,
        cache
      )
    }

    // Check for nested input type inside optional
    if (nonUndefinedTypes.length === 1 && nonUndefinedTypes[0]._tag === "TypeLiteral") {
      return toGraphQLInputTypeWithRegistry(
        S.make(nonUndefinedTypes[0]),
        enumRegistry,
        inputRegistry,
        inputs,
        enums,
        cache
      )
    }

    // Check if any union member is a registered input type (handles S.Option(RegisteredInput))
    // S.Option/S.OptionFromNullOr wraps the type inside a Union in the 'from' position
    for (const memberAst of unionAst.types) {
      // Check cache first for O(1) lookup, then recursively process the registered schema
      const inputName = cache?.astToInputName?.get(memberAst)
      if (inputName) {
        const inputReg = inputs.get(inputName)
        if (inputReg) {
          return toGraphQLInputTypeWithRegistry(
            inputReg.schema,
            enumRegistry,
            inputRegistry,
            inputs,
            enums,
            cache
          )
        }
      }

      // Fallback: Linear scan to check if memberAst matches any registered input
      for (const [, inputReg] of inputs) {
        if (inputReg.schema.ast === memberAst) {
          return toGraphQLInputTypeWithRegistry(
            inputReg.schema,
            enumRegistry,
            inputRegistry,
            inputs,
            enums,
            cache
          )
        }
      }

      // Also check for transformations wrapping registered input types
      if (memberAst._tag === "Transformation") {
        const toAst = memberAst.to
        const transformedInputName = cache?.astToInputName?.get(toAst)
        if (transformedInputName) {
          const inputReg = inputs.get(transformedInputName)
          if (inputReg) {
            return toGraphQLInputTypeWithRegistry(
              inputReg.schema,
              enumRegistry,
              inputRegistry,
              inputs,
              enums,
              cache
            )
          }
        }
        // Fallback: Linear scan for transformation's inner AST
        for (const [, inputReg] of inputs) {
          if (inputReg.schema.ast === toAst) {
            return toGraphQLInputTypeWithRegistry(
              inputReg.schema,
              enumRegistry,
              inputRegistry,
              inputs,
              enums,
              cache
            )
          }
        }
      }

      // Check for Option.Some pattern - TypeLiteral with a 'value' field containing the wrapped type
      if (memberAst._tag === "TypeLiteral") {
        const valueField = (memberAst as any).propertySignatures?.find(
          (p: any) => String(p.name) === "value"
        )
        if (valueField) {
          const valueType = valueField.type

          // Check cache first for the value type
          const valueInputName = cache?.astToInputName?.get(valueType)
          if (valueInputName) {
            const inputReg = inputs.get(valueInputName)
            if (inputReg) {
              return toGraphQLInputTypeWithRegistry(
                inputReg.schema,
                enumRegistry,
                inputRegistry,
                inputs,
                enums,
                cache
              )
            }
          }

          // Fallback: Linear scan to check if valueType matches any registered input
          for (const [, inputReg] of inputs) {
            if (inputReg.schema.ast === valueType) {
              return toGraphQLInputTypeWithRegistry(
                inputReg.schema,
                enumRegistry,
                inputRegistry,
                inputs,
                enums,
                cache
              )
            }
            // Also check unwrapped forms of registered schema
            let regAst = inputReg.schema.ast as any
            while (regAst._tag === "Transformation") {
              regAst = regAst.to
              if (regAst === valueType) {
                return toGraphQLInputTypeWithRegistry(
                  inputReg.schema,
                  enumRegistry,
                  inputRegistry,
                  inputs,
                  enums,
                  cache
                )
              }
            }
            if (regAst._tag === "Declaration" && regAst.typeParameters?.[0] === valueType) {
              return toGraphQLInputTypeWithRegistry(
                inputReg.schema,
                enumRegistry,
                inputRegistry,
                inputs,
                enums,
                cache
              )
            }
          }

          // Recursively resolve the value type if no direct match found
          const innerResult = toGraphQLInputTypeWithRegistry(
            S.make(valueType),
            enumRegistry,
            inputRegistry,
            inputs,
            enums,
            cache
          )
          // Return if we found a registered type
          if (innerResult) {
            return innerResult
          }
        }
      }
    }

    const allLiterals = unionAst.types.every((t: any) => t._tag === "Literal")

    if (allLiterals) {
      const literalValues = unionAst.types.map((t: any) => String(t.literal)).sort()

      // Use cached sorted values if available
      for (const [enumName] of enums) {
        const enumValues =
          cache?.enumSortedValues?.get(enumName) ?? [...enums.get(enumName)!.values].sort()
        if (
          literalValues.length === enumValues.length &&
          literalValues.every((v: string, i: number) => v === enumValues[i])
        ) {
          const result = enumRegistry.get(enumName)
          if (result) return result
        }
      }
    }
  }

  // Check single literal (O(1) with cache)
  if (ast._tag === "Literal") {
    const literalValue = String((ast as any).literal)
    if (cache?.literalToEnumName) {
      const enumName = cache.literalToEnumName.get(literalValue)
      if (enumName) {
        const result = enumRegistry.get(enumName)
        if (result) return result
      }
    } else {
      // Fallback to linear scan if no cache
      for (const [enumName, enumReg] of enums) {
        if (enumReg.values.includes(literalValue)) {
          const result = enumRegistry.get(enumName)
          if (result) return result
        }
      }
    }
  }

  // Handle Suspend (recursive/self-referential schemas)
  if (ast._tag === "Suspend") {
    const innerAst = (ast as any).f()
    return toGraphQLInputTypeWithRegistry(
      S.make(innerAst),
      enumRegistry,
      inputRegistry,
      inputs,
      enums,
      cache
    )
  }

  // Fall back to default toGraphQLInputType
  return toGraphQLInputType(schema)
}

/**
 * Convert a schema to GraphQL arguments with registry support.
 * Uses O(1) reverse lookups when cache is provided.
 */
export function toGraphQLArgsWithRegistry(
  schema: S.Schema<any, any, any>,
  enumRegistry: Map<string, GraphQLEnumType>,
  inputRegistry: Map<string, GraphQLInputObjectType>,
  inputs: Map<string, InputTypeRegistration>,
  enums: Map<string, EnumRegistration>,
  cache?: InputTypeLookupCache
): any {
  const ast = schema.ast

  if (ast._tag === "TypeLiteral") {
    const args: Record<string, { type: any }> = {}

    for (const field of (ast as any).propertySignatures) {
      const fieldName = String(field.name)

      // Skip _tag field from TaggedStruct/TaggedClass - it's an internal discriminator
      if (fieldName === "_tag") continue

      const fieldSchema = S.make(field.type)
      let fieldType = toGraphQLInputTypeWithRegistry(
        fieldSchema,
        enumRegistry,
        inputRegistry,
        inputs,
        enums,
        cache
      )

      // Make non-optional fields non-null (memoized)
      if (!field.isOptional) {
        fieldType = getNonNull(fieldType)
      }

      args[fieldName] = { type: fieldType }
    }

    return args
  }

  // Fall back to default toGraphQLArgs
  return toGraphQLArgs(schema)
}
