import { GraphQLDirective, GraphQLFieldConfig, GraphQLFieldConfigMap, GraphQLNamedType, GraphQLObjectType, GraphQLSchema } from "graphql";

class GraphQLSchemaBuilder {
  private readonly types: Record<string, GraphQLNamedType> = {};
  private readonly directives: GraphQLDirective[] = [];
  private readonly queryFields: GraphQLFieldConfigMap<any, any> = {};
  private readonly mutationFields: GraphQLFieldConfigMap<any, any> = {};
  private readonly subscriptionFields: GraphQLFieldConfigMap<any, any> = {};

  addType(type: GraphQLNamedType): this {
    this.types[type.name] = type;
    return this
  }

  getType(name: string): GraphQLNamedType | undefined {
    return this.types[name]
  }

  addDirective(directive: GraphQLDirective): this {
    this.directives.push(directive);
    return this
  }

  addQueryField(name: string, field: GraphQLFieldConfig<any, any>): this {
    this.queryFields[name] = field;
    return this
  }

  addMutationField(name: string, field: GraphQLFieldConfig<any, any>): this {
    this.mutationFields[name] = field;
    return this
  }

  addSubscriptionField(name: string, field: GraphQLFieldConfig<any, any>): this {
    this.subscriptionFields[name] = field;
    return this
  }

  build(): GraphQLSchema {
    return new GraphQLSchema({
      types: this.types,
      directives: this.directives,
      query: new GraphQLObjectType({
        name: "Query",
        fields: this.queryFields,
      }),
      mutation: new GraphQLObjectType({
        name: "Mutation",
        fields: this.mutationFields,
      }),
      subscription: new GraphQLObjectType({
        name: "Subscription",
        fields: this.subscriptionFields,
      }),
    })
  }
}

export const schemaBuilder = new GraphQLSchemaBuilder()