/**
 * Bumps the version across all packages and creates a git tag.
 *
 * Usage:
 *   pnpm version:bump patch   # 1.2.0 → 1.2.1
 *   pnpm version:bump minor   # 1.2.0 → 1.3.0
 *   pnpm version:bump major   # 1.2.0 → 2.0.0
 *   pnpm version:bump 2.0.0   # Set explicit version
 */

import * as fs from "fs"
import * as path from "path"
import { execSync } from "child_process"

const ROOT_DIR = path.resolve(__dirname, "..")

interface PackageJson {
  name: string
  version: string
  [key: string]: unknown
}

function readJson(filePath: string): PackageJson {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as PackageJson
}

function writeJson(filePath: string, data: PackageJson): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n")
}

function parseVersion(version: string): { major: number; minor: number; patch: number } {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) {
    throw new Error(`Invalid version format: ${version}`)
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  }
}

function bumpVersion(
  current: string,
  bumpType: "major" | "minor" | "patch"
): string {
  const { major, minor, patch } = parseVersion(current)

  switch (bumpType) {
    case "major":
      return `${major + 1}.0.0`
    case "minor":
      return `${major}.${minor + 1}.0`
    case "patch":
      return `${major}.${minor}.${patch + 1}`
  }
}

function isValidVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+$/.test(version)
}

function runCommand(command: string, description: string): void {
  console.log(`→ ${description}`)
  try {
    execSync(command, { cwd: ROOT_DIR, stdio: "inherit" })
  } catch {
    console.error(`Failed: ${description}`)
    process.exit(1)
  }
}

function main(): void {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error("Usage: pnpm version:bump <patch|minor|major|x.y.z>")
    process.exit(1)
  }

  const input = args[0]

  // Read current version
  const rootPkgPath = path.join(ROOT_DIR, "package.json")
  const rootPkg = readJson(rootPkgPath)
  const currentVersion = rootPkg.version

  if (!currentVersion) {
    console.error("Error: No version field in root package.json")
    process.exit(1)
  }

  // Determine new version
  let newVersion: string

  if (input === "patch" || input === "minor" || input === "major") {
    newVersion = bumpVersion(currentVersion, input)
  } else if (isValidVersion(input)) {
    newVersion = input
  } else {
    console.error(`Invalid version or bump type: ${input}`)
    console.error("Expected: patch, minor, major, or a valid semver (e.g., 2.0.0)")
    process.exit(1)
  }

  console.log(`\nBumping version: ${currentVersion} → ${newVersion}\n`)

  // Update root package.json
  rootPkg.version = newVersion
  writeJson(rootPkgPath, rootPkg)
  console.log(`✓ Updated root package.json`)

  // Run version sync to propagate to all packages
  console.log("")
  runCommand("pnpm run version:sync", "Syncing versions across packages")

  // Git operations
  console.log("")
  runCommand("git add -A", "Staging changes")
  runCommand(
    `git commit -m "chore: bump version to ${newVersion}"`,
    "Creating commit"
  )
  runCommand(`git tag v${newVersion}`, `Creating tag v${newVersion}`)

  console.log(`
✓ Version bump complete!

Next steps:
  git push origin main --tags   # Push changes and trigger release
`)
}

main()
