import { flatMap, fromNullable, filter, getOrElse, type Option } from "effect/Option"
import { Struct, TypeId } from "effect/Schema"
import * as SchemaAST from "effect/SchemaAST"
import { schemaBuilder } from "../builder"
import { GraphQLBoolean, GraphQLEnumType, GraphQLFieldConfig, GraphQLFieldConfigMap, GraphQLInt, GraphQLList, GraphQLObjectType, GraphQLString, GraphQLType, GraphQLUnionType } from "graphql"
import { getIdentifierAnnotation } from "effect/SchemaAST"

/**
 * Type constraint for classes that implement Effect's Class interface.
 * This ensures the decorator can only be applied to classes created with Schema.Class
 * 
 * We use a type that checks for the key static properties that Class must have:
 * - fields: the struct fields definition
 * - identifier: the class identifier string
 * - ast: the AST transformation
 * - annotations: method to add annotations
 * - make: factory method to create instances
 */
type ClassLike = {
  new (...args: any[]): any
} & {
  readonly fields: Struct.Fields
  readonly identifier: string
  readonly ast: any
  annotations(annotations: any): any
  make(...args: any[]): any
}

/**
 * Decorator that can only be applied to classes implementing Effect's Class interface.
 * 
 * @example
 * ```ts
 * @ObjectType()
 * class Book extends Class<Book>("Book")({
 *   id: Schema.Number,
 *   name: Schema.String,
 * }) {}
 * ```
 */
export function ObjectType() {
  return <T extends ClassLike>(target: T): T => {
    schemaBuilder.addType(toGraphqlObjectType(target))
    return target
  }
}

function toGraphqlObjectType<T extends ClassLike>(schema: T): GraphQLObjectType {
    return new GraphQLObjectType({
        name: schema.identifier,
        fields: toGraphqlFields(schema),
    })
}

function toGraphqlFields<T extends ClassLike>(schema: T): GraphQLFieldConfigMap<any, any> {
    return Object.fromEntries(
        Object.entries(schema.fields).map(([name, field]) => [name, toGraphqlField(field)]),
    )
}

function toGraphqlField(field: Struct.Field): GraphQLFieldConfig<any, any> {
    let ast: SchemaAST.AST

    const getTypeName = (ast: SchemaAST.AST) => SchemaAST.getIdentifierAnnotation(ast).pipe(
        getOrElse(() => field[TypeId].toString())
    )

    if (field.ast instanceof SchemaAST.PropertySignature) {
        ast = field.ast.type
    } else {
        ast = field.ast as SchemaAST.AST
    }

    return toGraphQLType(ast, getTypeName)
}

function toGraphQLType(ast: SchemaAST.AST, getTypeName: (ast: SchemaAST.AST) => string): GraphQLFieldConfig<any, any> | undefined {
    if (SchemaAST.isEnums(ast)) {        
        return {
            type: new GraphQLEnumType({
                name: getTypeName(ast),
                values: Object.fromEntries(ast.enums.map(([name, value]) => [name, { value }])),
            }),
        }
    }    
    if (SchemaAST.isStringKeyword(ast) || SchemaAST.isSymbolKeyword(ast)) {
        return {
            type: GraphQLString,
        }
    }
    if (SchemaAST.isNumberKeyword(ast) || SchemaAST.isBigIntKeyword(ast)) {
        return {
            type: GraphQLInt,
        }
    }
    if (SchemaAST.isBooleanKeyword(ast)) {
        return {
            type: GraphQLBoolean,
        }
    }
    if (SchemaAST.isSuspend(ast)) {
        return toGraphQLType(ast.f(), getTypeName)
    }
    if (SchemaAST.isTypeLiteral(ast)) {
        return {
            type: new GraphQLObjectType({
                name: getTypeName(ast),
                fields: toGraphqlFields(ast),
            }),
        }
    }
    if (SchemaAST.isUnion(ast)) {        
        return {
            type: new GraphQLUnionType({
                name: getTypeName(ast),
                types: () => ast.types.flatMap(type => findGraphQLObjectType(type).pipe(
                    getOrElse(() => []),
                )),
            }),
        }
    }
    return undefined
}

function findGraphQLObjectType(ast: SchemaAST.AST): Option<GraphQLObjectType> {
    return getIdentifierAnnotation(ast).pipe(
        flatMap(name => 
            fromNullable(schemaBuilder.getType(name))),
        filter(type => type instanceof GraphQLObjectType)
    )    
}