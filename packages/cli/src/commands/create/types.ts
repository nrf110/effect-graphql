/**
 * Type definitions for the create command
 */

import { Option } from "effect"

/**
 * Supported server types for scaffolding
 */
export type ServerType = "node" | "bun" | "express" | "web"

/**
 * Supported package managers
 */
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun"

/**
 * Options for the create command
 */
export interface CreateOptions {
  /** Package/project name */
  readonly name: string
  /** Server type to scaffold */
  readonly serverType: ServerType
  /** Target directory (defaults to ./<name>) */
  readonly directory: Option.Option<string>
  /** Create as monorepo workspace package */
  readonly monorepo: Option.Option<boolean>
  /** Skip npm install */
  readonly skipInstall: boolean
  /** Package manager to use */
  readonly packageManager: Option.Option<PackageManager>
}

/**
 * Result of parsing CLI arguments
 */
export type ParsedArgs =
  | { readonly options: CreateOptions }
  | { readonly help: true }
  | { readonly interactive: true }
  | { readonly error: string }

/**
 * Context passed to template generators
 */
export interface TemplateContext {
  /** Package name */
  readonly name: string
  /** Server type */
  readonly serverType: ServerType
  /** Whether creating as monorepo workspace package */
  readonly isMonorepo: boolean
  /** Package manager being used */
  readonly packageManager: PackageManager
}

/**
 * A generated file with its relative path and content
 */
export interface GeneratedFile {
  /** Relative path from project root */
  readonly path: string
  /** File content */
  readonly content: string
}

/**
 * Information about a detected monorepo
 */
export interface MonorepoInfo {
  /** Whether a monorepo was detected */
  readonly isMonorepo: boolean
  /** Detected package manager */
  readonly packageManager: Option.Option<PackageManager>
  /** Path to the workspace root */
  readonly workspacesRoot: Option.Option<string>
}

/**
 * All valid server types
 */
export const SERVER_TYPES: readonly ServerType[] = ["node", "bun", "express", "web"]

/**
 * Check if a string is a valid server type
 */
export const isValidServerType = (value: string): value is ServerType =>
  SERVER_TYPES.includes(value as ServerType)

/**
 * All valid package managers
 */
export const PACKAGE_MANAGERS: readonly PackageManager[] = ["npm", "pnpm", "yarn", "bun"]

/**
 * Check if a string is a valid package manager
 */
export const isValidPackageManager = (value: string): value is PackageManager =>
  PACKAGE_MANAGERS.includes(value as PackageManager)
