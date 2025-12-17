import { GraphQLFieldConfig, GraphQLFieldConfigMap, GraphQLObjectType } from "graphql";

export class GraphQLObjectTypeBuilder {
  private readonly fields: GraphQLFieldConfigMap<any, any> = {};

  constructor(private readonly name: string) {
  }

  addField(name: string, field: GraphQLFieldConfig<any, any>): this {
    this.fields[name] = field
    return this
  }

  build(): GraphQLObjectType {
    return new GraphQLObjectType({
      name: this.name,
      fields: this.fields,
    })
  }
}