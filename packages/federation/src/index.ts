// Core builder
export { FederatedSchemaBuilder } from "./federated-builder"

// Types
export type {
  KeyDirective,
  FederationDirective,
  EntityRepresentation,
  EntityRegistration,
  FederatedSchemaConfig,
  FederatedSchemaResult,
} from "./types"
export { toDirectiveApplication } from "./types"

// Directive factories
export {
  key,
  shareable,
  inaccessible,
  interfaceObject,
  tag,
  external,
  requires,
  provides,
  override,
} from "./directives"

// Pipe-able API
export {
  entity,
  query,
  mutation,
  subscription,
  objectType,
  interfaceType,
  enumType,
  unionType,
  inputType,
  field,
  externalField,
  requiresField,
  providesField,
  overrideField,
} from "./pipe-api"

// Federation scalars (for advanced usage)
export { AnyScalar, FieldSetScalar } from "./scalars"
