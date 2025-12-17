import { Class, Struct } from "effect/Schema";
import { GraphQLObjectTypeBuilder } from "./object-builder";
import { GraphQLObjectType } from "graphql";

const schemaMapper = <T>(schema: Class<T, any, any, any, any, any, any>): GraphQLObjectType => {
    const builder = new GraphQLObjectTypeBuilder(schema.identifier);
    schema.fields.forEach((name: string, field: Struct.Field) => {
        builder.addField(name, schemaMapper(field));
    });

    return builder.build();
}