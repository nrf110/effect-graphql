import { Effect } from "effect"
import * as S from "effect/Schema"
import * as AST from "effect/SchemaAST"
import {
  GraphQLObjectType,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLNonNull,
  GraphQLList,
  GraphQLOutputType,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLFieldConfigMap,
  GraphQLFieldConfigArgumentMap,
} from "graphql"

/**
 * Check if a number AST node represents an integer
 */
const isIntegerType = (ast: AST.AST): boolean => {
  // Check for Refinement with integer filter
  if (ast._tag === "Refinement") {
    const refinement = ast as any

    // Check the annotations for the integer identifier or JSONSchema type
    const annotations = refinement.annotations
    if (annotations) {
      // Check for identifier annotation (Int, NonNegativeInt, PositiveInt, etc.)
      const identifier = AST.getIdentifierAnnotation(refinement)
      if (identifier._tag === "Some") {
        const id = identifier.value
        // Check for any integer-related identifier
        if (id === "Int" || id.includes("Int")) {
          return true
        }
      }

      // Check for JSONSchema annotation with type "integer"
      const JSONSchemaSymbol = Symbol.for("effect/annotation/JSONSchema")
      const jsonSchema = annotations[JSONSchemaSymbol]
      if (jsonSchema && jsonSchema.type === "integer") {
        return true
      }
    }

    // Recursively check the base type
    return isIntegerType(refinement.from)
  }
  return false
}

/**
 * Check if a Declaration AST node represents an Option type.
 * Option declarations have a TypeConstructor annotation of 'effect/Option'.
 */
const isOptionDeclaration = (ast: AST.AST): boolean => {
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
 * Check if a Transformation represents an Option schema (e.g., S.OptionFromNullOr).
 * These have a Declaration with "Option" identifier on the "to" side.
 */
const isOptionTransformation = (ast: AST.AST): boolean => {
  if (ast._tag === "Transformation") {
    return isOptionDeclaration((ast as any).to)
  }
  return false
}

/**
 * Get the inner type from an Option Declaration.
 * Option<A> has A as the first type parameter.
 */
const getOptionInnerType = (ast: AST.AST): AST.AST | undefined => {
  if (ast._tag === "Declaration") {
    const typeParams = (ast as any).typeParameters
    if (typeParams && typeParams.length > 0) {
      return typeParams[0]
    }
  }
  return undefined
}

/**
 * Convert an Effect Schema to a GraphQL output type
 */
export const toGraphQLType = (schema: S.Schema<any, any, any>): GraphQLOutputType => {
  const ast = schema.ast

  // Handle primitives
  if (ast._tag === "StringKeyword") return GraphQLString
  if (ast._tag === "NumberKeyword") return GraphQLFloat
  if (ast._tag === "BooleanKeyword") return GraphQLBoolean

  // Handle refinements (e.g., S.Int)
  if (ast._tag === "Refinement") {
    if (isIntegerType(ast)) {
      return GraphQLInt
    }
    // For other refinements, use the base type
    return toGraphQLType(S.make((ast as any).from))
  }

  // Handle literals
  if (ast._tag === "Literal") {
    if (typeof ast.literal === "string") return GraphQLString
    if (typeof ast.literal === "number") {
      // Check if it's an integer literal
      return Number.isInteger(ast.literal) ? GraphQLInt : GraphQLFloat
    }
    if (typeof ast.literal === "boolean") return GraphQLBoolean
  }

  // Handle arrays - check for TupleType
  if (ast._tag === "TupleType") {
    const elements = ast.elements
    if (elements.length > 0) {
      const elementSchema = S.make(elements[0].type)
      return new GraphQLList(toGraphQLType(elementSchema))
    }
  }

  // Handle structs/objects
  if (ast._tag === "TypeLiteral") {
    const fields: GraphQLFieldConfigMap<any, any> = {}

    for (const field of ast.propertySignatures) {
      const fieldName = String(field.name)

      // Skip _tag field from TaggedStruct/TaggedClass - it's an internal discriminator
      if (fieldName === "_tag") continue

      const fieldSchema = S.make(field.type)
      let fieldType = toGraphQLType(fieldSchema)

      // Make non-optional fields non-null, unless they're Option transformations
      // Option transformations (like S.OptionFromNullOr) should always be nullable
      const isOptionField = isOptionTransformation(field.type) || isOptionDeclaration(field.type)
      if (!field.isOptional && !isOptionField) {
        fieldType = new GraphQLNonNull(fieldType)
      }

      fields[fieldName] = { type: fieldType }
    }

    // Generate a name from the schema or use a default
    const typeName =
      (schema as any).annotations?.identifier || `Object_${Math.random().toString(36).slice(2, 11)}`

    return new GraphQLObjectType({
      name: typeName,
      fields,
    })
  }

  // Handle transformations - use the "to" side
  if (ast._tag === "Transformation") {
    // Special handling for Option transformations (e.g., S.OptionFromNullOr)
    // These should map to the nullable inner type
    if (isOptionTransformation(ast)) {
      const innerType = getOptionInnerType(ast.to)
      if (innerType) {
        // Return the inner type as nullable (not wrapped in NonNull)
        return toGraphQLType(S.make(innerType))
      }
    }
    return toGraphQLType(S.make(ast.to))
  }

  // Handle Declaration (e.g., Option from S.Option)
  if (ast._tag === "Declaration") {
    // Option declarations map to nullable inner type
    if (isOptionDeclaration(ast)) {
      const innerType = getOptionInnerType(ast)
      if (innerType) {
        return toGraphQLType(S.make(innerType))
      }
    }
    // For other declarations (like Schema.Class), extract TypeLiteral from typeParameters
    const typeParams = (ast as any).typeParameters
    if (typeParams && typeParams.length > 0) {
      return toGraphQLType(S.make(typeParams[0]))
    }
  }

  // Handle unions (use first type as fallback)
  if (ast._tag === "Union") {
    const types = ast.types
    if (types.length > 0) {
      return toGraphQLType(S.make(types[0]))
    }
  }

  // Handle Suspend (recursive/self-referential schemas)
  if (ast._tag === "Suspend") {
    const innerAst = (ast as any).f()
    return toGraphQLType(S.make(innerAst))
  }

  // Default fallback
  return GraphQLString
}

/**
 * Convert an Effect Schema to a GraphQL input type
 */
export const toGraphQLInputType = (schema: S.Schema<any, any, any>): GraphQLInputType => {
  const ast = schema.ast

  // Handle primitives
  if (ast._tag === "StringKeyword") return GraphQLString
  if (ast._tag === "NumberKeyword") return GraphQLFloat
  if (ast._tag === "BooleanKeyword") return GraphQLBoolean

  // Handle refinements (e.g., S.Int)
  if (ast._tag === "Refinement") {
    if (isIntegerType(ast)) {
      return GraphQLInt
    }
    // For other refinements, use the base type
    return toGraphQLInputType(S.make((ast as any).from))
  }

  // Handle literals
  if (ast._tag === "Literal") {
    if (typeof ast.literal === "string") return GraphQLString
    if (typeof ast.literal === "number") {
      // Check if it's an integer literal
      return Number.isInteger(ast.literal) ? GraphQLInt : GraphQLFloat
    }
    if (typeof ast.literal === "boolean") return GraphQLBoolean
  }

  // Handle arrays
  if (ast._tag === "TupleType") {
    const elements = ast.elements
    if (elements.length > 0) {
      const elementSchema = S.make(elements[0].type)
      return new GraphQLList(toGraphQLInputType(elementSchema))
    }
  }

  // Handle structs/objects as input types
  if (ast._tag === "TypeLiteral") {
    const fields: Record<string, { type: GraphQLInputType }> = {}

    for (const field of ast.propertySignatures) {
      const fieldName = String(field.name)

      // Skip _tag field from TaggedStruct/TaggedClass - it's an internal discriminator
      if (fieldName === "_tag") continue

      const fieldSchema = S.make(field.type)
      let fieldType = toGraphQLInputType(fieldSchema)

      // Make non-optional fields non-null, unless they're Option transformations
      // Option transformations (like S.OptionFromNullOr) should always be nullable
      const isOptionField = isOptionTransformation(field.type) || isOptionDeclaration(field.type)
      if (!field.isOptional && !isOptionField) {
        fieldType = new GraphQLNonNull(fieldType)
      }

      fields[fieldName] = { type: fieldType }
    }

    const typeName =
      (schema as any).annotations?.identifier || `Input_${Math.random().toString(36).slice(2, 11)}`

    return new GraphQLInputObjectType({
      name: typeName,
      fields,
    })
  }

  // Handle transformations - use the "from" side for input
  if (ast._tag === "Transformation") {
    // For Option transformations, the "from" side is Union(T, null/undefined)
    // which the Union handler below will process correctly
    return toGraphQLInputType(S.make(ast.from))
  }

  // Handle Declaration (for completeness, though inputs typically use "from" side)
  if (ast._tag === "Declaration") {
    // Option declarations - use the inner type
    if (isOptionDeclaration(ast)) {
      const innerType = getOptionInnerType(ast)
      if (innerType) {
        return toGraphQLInputType(S.make(innerType))
      }
    }
    // For other declarations, extract from typeParameters
    const typeParams = (ast as any).typeParameters
    if (typeParams && typeParams.length > 0) {
      return toGraphQLInputType(S.make(typeParams[0]))
    }
  }

  // Handle unions (use first non-null/undefined type)
  if (ast._tag === "Union") {
    const types = ast.types
    // Filter out null and undefined for nullable unions
    const nonNullTypes = types
      .filter((t: AST.AST) => t._tag !== "Literal" || (t as any).literal !== null)
      .filter((t: AST.AST) => t._tag !== "UndefinedKeyword")
    if (nonNullTypes.length > 0) {
      return toGraphQLInputType(S.make(nonNullTypes[0]))
    }
    if (types.length > 0) {
      return toGraphQLInputType(S.make(types[0]))
    }
  }

  // Handle Suspend (recursive/self-referential schemas)
  if (ast._tag === "Suspend") {
    const innerAst = (ast as any).f()
    return toGraphQLInputType(S.make(innerAst))
  }

  // Default fallback
  return GraphQLString
}

/**
 * Additional field configuration for computed/relational fields
 */
export interface AdditionalField<Parent, Args, R, E, A> {
  type: GraphQLOutputType
  args?: GraphQLFieldConfigArgumentMap
  description?: string
  resolve: (parent: Parent, args: Args) => Effect.Effect<A, E, R>
}

/**
 * Create a GraphQL Object Type from an Effect Schema with a name
 * Optionally add computed/relational fields with resolvers
 */
export const toGraphQLObjectType = <T>(
  name: string,
  schema: S.Schema<any, any, any>,
  additionalFields?: Record<string, AdditionalField<T, any, any, any, any>>
): GraphQLObjectType => {
  let ast = schema.ast

  // Handle Transformation wrappers (e.g., from optionalWith, Schema.Class)
  // Recurse through transformations to find the TypeLiteral
  while (ast._tag === "Transformation") {
    ast = (ast as any).to
  }

  // Handle Declaration (e.g., Schema.Class)
  if (ast._tag === "Declaration") {
    const typeParams = (ast as any).typeParameters
    if (typeParams && typeParams.length > 0) {
      ast = typeParams[0]
      // May need to recurse through more transformations
      while (ast._tag === "Transformation") {
        ast = (ast as any).to
      }
    }
  }

  if (ast._tag === "TypeLiteral") {
    const fields: GraphQLFieldConfigMap<any, any> = {}

    // Add fields from schema
    for (const field of ast.propertySignatures) {
      const fieldName = String(field.name)

      // Skip _tag field from TaggedStruct/TaggedClass - it's an internal discriminator
      if (fieldName === "_tag") continue

      const fieldSchema = S.make(field.type)
      let fieldType = toGraphQLType(fieldSchema)

      // Make non-optional fields non-null, unless they're Option transformations
      // Option transformations (like S.OptionFromNullOr) should always be nullable
      const isOptionField = isOptionTransformation(field.type) || isOptionDeclaration(field.type)
      if (!field.isOptional && !isOptionField) {
        fieldType = new GraphQLNonNull(fieldType)
      }

      fields[fieldName] = { type: fieldType }
    }

    // Add additional computed/relational fields
    if (additionalFields) {
      for (const [fieldName, fieldConfig] of Object.entries(additionalFields)) {
        fields[fieldName] = {
          type: fieldConfig.type,
          args: fieldConfig.args,
          description: fieldConfig.description,
          // Note: resolve will be set later when runtime is available
          resolve: fieldConfig.resolve as any,
        }
      }
    }

    return new GraphQLObjectType({
      name,
      fields,
    })
  }

  throw new Error(`Schema must be an object type to convert to GraphQLObjectType`)
}

/**
 * Convert an Effect Schema to GraphQL arguments
 */
export const toGraphQLArgs = (schema: S.Schema<any, any, any>): GraphQLFieldConfigArgumentMap => {
  const ast = schema.ast

  if (ast._tag === "TypeLiteral") {
    const args: GraphQLFieldConfigArgumentMap = {}

    for (const field of ast.propertySignatures) {
      const fieldName = String(field.name)

      // Skip _tag field from TaggedStruct/TaggedClass - it's an internal discriminator
      if (fieldName === "_tag") continue

      const fieldSchema = S.make(field.type)
      let fieldType = toGraphQLInputType(fieldSchema)

      // Make non-optional fields non-null, unless they're Option transformations
      // Option transformations (like S.OptionFromNullOr) should always be nullable
      const isOptionField = isOptionTransformation(field.type) || isOptionDeclaration(field.type)
      if (!field.isOptional && !isOptionField) {
        fieldType = new GraphQLNonNull(fieldType)
      }

      args[fieldName] = { type: fieldType }
    }

    return args
  }

  throw new Error(`Schema must be an object type to convert to GraphQL arguments`)
}
