/**
 * CLI argument parsing for the create command
 */

import { Option } from "effect"
import type { CreateOptions, ParsedArgs, PackageManager, ServerType } from "./types"
import { isValidServerType, isValidPackageManager, SERVER_TYPES } from "./types"

/**
 * Parse CLI arguments for the create command
 *
 * Usage:
 *   effect-gql create <name> --server-type <type> [options]
 *   effect-gql create --interactive
 */
export const parseArgs = (args: string[]): ParsedArgs => {
  const positional: string[] = []
  let serverType: ServerType | undefined
  let directory: Option.Option<string> = Option.none()
  let monorepo: Option.Option<boolean> = Option.none()
  let skipInstall = false
  let packageManager: Option.Option<PackageManager> = Option.none()
  let interactive = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === "-h" || arg === "--help") {
      return { help: true }
    } else if (arg === "-i" || arg === "--interactive") {
      interactive = true
    } else if (arg === "-s" || arg === "--server-type") {
      const value = args[++i]
      if (!value) {
        return { error: "Missing value for --server-type" }
      }
      if (!isValidServerType(value)) {
        return {
          error: `Invalid server type: ${value}. Must be one of: ${SERVER_TYPES.join(", ")}`,
        }
      }
      serverType = value
    } else if (arg === "-d" || arg === "--directory") {
      const value = args[++i]
      if (!value) {
        return { error: "Missing value for --directory" }
      }
      directory = Option.some(value)
    } else if (arg === "--monorepo") {
      monorepo = Option.some(true)
    } else if (arg === "--skip-install") {
      skipInstall = true
    } else if (arg === "--package-manager") {
      const value = args[++i]
      if (!value) {
        return { error: "Missing value for --package-manager" }
      }
      if (!isValidPackageManager(value)) {
        return { error: `Invalid package manager: ${value}. Must be one of: npm, pnpm, yarn, bun` }
      }
      packageManager = Option.some(value)
    } else if (!arg.startsWith("-")) {
      positional.push(arg)
    } else {
      return { error: `Unknown option: ${arg}` }
    }
  }

  // If interactive mode, return early
  if (interactive) {
    return { interactive: true }
  }

  // If no args at all, default to interactive
  if (args.length === 0) {
    return { interactive: true }
  }

  // Validate required arguments
  if (positional.length === 0) {
    return {
      error:
        "Missing project name. Use --interactive or provide: effect-gql create <name> --server-type <type>",
    }
  }

  if (!serverType) {
    return { error: "Missing --server-type. Must be one of: " + SERVER_TYPES.join(", ") }
  }

  const options: CreateOptions = {
    name: positional[0],
    serverType,
    directory,
    monorepo,
    skipInstall,
    packageManager,
  }

  return { options }
}
