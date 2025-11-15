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
  GraphQLFieldConfigMap,
} from "graphql"

/**
 * Convert an Effect Schema to a GraphQL output type
 */
export const toGraphQLType = (schema: S.Schema<any, any, any>): GraphQLOutputType => {
  const ast = schema.ast

  // Handle primitives
  if (ast._tag === "StringKeyword") return GraphQLString
  if (ast._tag === "NumberKeyword") return GraphQLFloat
  if (ast._tag === "BooleanKeyword") return GraphQLBoolean

  // Handle literals
  if (ast._tag === "Literal") {
    if (typeof ast.literal === "string") return GraphQLString
    if (typeof ast.literal === "number") return GraphQLFloat
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
      const fieldSchema = S.make(field.type)
      let fieldType = toGraphQLType(fieldSchema)
      
      // Make non-optional fields non-null
      if (!field.isOptional) {
        fieldType = new GraphQLNonNull(fieldType)
      }
      
      fields[fieldName] = { type: fieldType }
    }

    // Generate a name from the schema or use a default
    const typeName = (schema as any).annotations?.identifier || `Object_${Math.random().toString(36).substr(2, 9)}`
    
    return new GraphQLObjectType({
      name: typeName,
      fields,
    })
  }

  // Handle transformations - use the "to" side
  if (ast._tag === "Transformation") {
    return toGraphQLType(S.make(ast.to))
  }

  // Handle unions (use first type as fallback)
  if (ast._tag === "Union") {
    const types = ast.types
    if (types.length > 0) {
      return toGraphQLType(S.make(types[0]))
    }
  }

  // Default fallback
  return GraphQLString
}

/**
 * Create a GraphQL Object Type from an Effect Schema with a name
 */
export const toGraphQLObjectType = (
  name: string,
  schema: S.Schema<any, any, any>
): GraphQLObjectType => {
  const ast = schema.ast
  
  if (ast._tag === "TypeLiteral") {
    const fields: GraphQLFieldConfigMap<any, any> = {}
    
    for (const field of ast.propertySignatures) {
      const fieldName = String(field.name)
      const fieldSchema = S.make(field.type)
      let fieldType = toGraphQLType(fieldSchema)
      
      // Make non-optional fields non-null
      if (!field.isOptional) {
        fieldType = new GraphQLNonNull(fieldType)
      }
      
      fields[fieldName] = { type: fieldType }
    }
    
    return new GraphQLObjectType({
      name,
      fields,
    })
  }
  
  throw new Error(`Schema must be an object type to convert to GraphQLObjectType`)
}
