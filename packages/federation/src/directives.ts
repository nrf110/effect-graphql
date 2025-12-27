import type { FederationDirective, KeyDirective } from "./types"

// ============================================================================
// Type-Level Directive Factories
// ============================================================================

/**
 * Create a @key directive for entity identification
 *
 * @example
 * ```typescript
 * entity({
 *   name: "User",
 *   schema: UserSchema,
 *   keys: [key({ fields: "id" })],
 *   resolveReference: (ref) => UserService.findById(ref.id),
 * })
 * ```
 */
export const key = (config: KeyDirective): FederationDirective => ({
  _tag: "key",
  fields: config.fields,
  resolvable: config.resolvable,
})

/**
 * Create a @shareable directive
 * Marks a type or field as resolvable by multiple subgraphs
 *
 * @example
 * ```typescript
 * entity({
 *   name: "Product",
 *   schema: ProductSchema,
 *   keys: [key({ fields: "id" })],
 *   directives: [shareable()],
 * })
 * ```
 */
export const shareable = (): FederationDirective => ({
  _tag: "shareable",
})

/**
 * Create an @inaccessible directive
 * Omits the type/field from the public API while keeping it available for federation
 *
 * @example
 * ```typescript
 * objectType({
 *   name: "InternalMetadata",
 *   schema: MetadataSchema,
 *   directives: [inaccessible()],
 * })
 * ```
 */
export const inaccessible = (): FederationDirective => ({
  _tag: "inaccessible",
})

/**
 * Create an @interfaceObject directive
 * Indicates this object represents an interface from another subgraph
 *
 * @example
 * ```typescript
 * objectType({
 *   name: "Media",
 *   schema: MediaSchema,
 *   directives: [interfaceObject()],
 * })
 * ```
 */
export const interfaceObject = (): FederationDirective => ({
  _tag: "interfaceObject",
})

/**
 * Create a @tag directive for metadata annotation
 *
 * @example
 * ```typescript
 * entity({
 *   name: "Product",
 *   schema: ProductSchema,
 *   keys: [key({ fields: "id" })],
 *   directives: [tag("public"), tag("catalog")],
 * })
 * ```
 */
export const tag = (name: string): FederationDirective => ({
  _tag: "tag",
  name,
})

// ============================================================================
// Field-Level Directive Factories
// ============================================================================

/**
 * Create an @external directive
 * Marks a field as defined in another subgraph
 *
 * @example
 * ```typescript
 * field("User", "externalId", {
 *   type: S.String,
 *   directives: [external()],
 *   resolve: (parent) => parent.externalId,
 * })
 * ```
 */
export const external = (): FederationDirective => ({
  _tag: "external",
})

/**
 * Create a @requires directive
 * Specifies fields that must be fetched from other subgraphs before this field can be resolved
 *
 * @example
 * ```typescript
 * field("Product", "shippingEstimate", {
 *   type: S.Int,
 *   directives: [requires({ fields: "weight dimensions { height width }" })],
 *   resolve: (product) => calculateShipping(product.weight, product.dimensions),
 * })
 * ```
 */
export const requires = (config: { fields: string }): FederationDirective => ({
  _tag: "requires",
  fields: config.fields,
})

/**
 * Create a @provides directive
 * Router optimization hint - indicates this field provides additional fields on the returned type
 *
 * @example
 * ```typescript
 * field("Review", "author", {
 *   type: UserSchema,
 *   directives: [provides({ fields: "name email" })],
 *   resolve: (review) => UserService.findById(review.authorId),
 * })
 * ```
 */
export const provides = (config: { fields: string }): FederationDirective => ({
  _tag: "provides",
  fields: config.fields,
})

/**
 * Create an @override directive
 * Transfers resolution responsibility from another subgraph
 *
 * @example
 * ```typescript
 * field("Product", "price", {
 *   type: S.Number,
 *   directives: [override({ from: "legacy-pricing" })],
 *   resolve: (product) => PricingService.getPrice(product.id),
 * })
 * ```
 */
export const override = (config: { from: string; label?: string }): FederationDirective => ({
  _tag: "override",
  from: config.from,
  label: config.label,
})
