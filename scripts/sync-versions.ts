/**
 * Synchronizes version numbers across all packages in the monorepo.
 *
 * Reads the version from root package.json and updates:
 * - All packages/x/package.json version fields
 * - Internal @effect-gql/x peer dependency versions
 * - CLI template VERSIONS constant
 */

import * as fs from "fs"
import * as path from "path"

const ROOT_DIR = path.resolve(__dirname, "..")
const PACKAGES_DIR = path.join(ROOT_DIR, "packages")
const CLI_TEMPLATE_PATH = path.join(
  PACKAGES_DIR,
  "cli/src/commands/create/templates/package-json.ts"
)

interface PackageJson {
  name: string
  version: string
  peerDependencies?: Record<string, string>
  [key: string]: unknown
}

function readJson(filePath: string): PackageJson {
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as PackageJson
}

function writeJson(filePath: string, data: PackageJson): void {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n")
}

function getPackageDirs(): string[] {
  return fs
    .readdirSync(PACKAGES_DIR)
    .filter((name) => {
      const pkgPath = path.join(PACKAGES_DIR, name, "package.json")
      return fs.existsSync(pkgPath)
    })
    .map((name) => path.join(PACKAGES_DIR, name))
}

function updatePackageVersions(version: string): void {
  const packageDirs = getPackageDirs()
  const versionWithCaret = "^" + version

  for (const packageDir of packageDirs) {
    const pkgPath = path.join(packageDir, "package.json")
    const pkg = readJson(pkgPath)

    // Update the package version
    pkg.version = version

    // Update @effect-gql peer dependencies
    if (pkg.peerDependencies) {
      for (const dep of Object.keys(pkg.peerDependencies)) {
        if (dep.startsWith("@effect-gql/")) {
          pkg.peerDependencies[dep] = versionWithCaret
        }
      }
    }

    writeJson(pkgPath, pkg)
    console.log("Updated " + pkg.name + " to " + version)
  }
}

function updateCliTemplate(version: string): void {
  if (!fs.existsSync(CLI_TEMPLATE_PATH)) {
    console.log("CLI template not found, skipping")
    return
  }

  let content = fs.readFileSync(CLI_TEMPLATE_PATH, "utf-8")
  const versionWithCaret = "^" + version

  // Update the VERSIONS constant for @effect-gql packages
  // Match patterns like: core: "^1.1.0", node: "^1.1.0", etc.
  const effectGqlPackages = ["core", "node", "bun", "express", "web"]

  for (const pkg of effectGqlPackages) {
    const regex = new RegExp("(" + pkg + ':\\s*)"\\^[0-9]+\\.[0-9]+\\.[0-9]+"', "g")
    content = content.replace(regex, '$1"' + versionWithCaret + '"')
  }

  fs.writeFileSync(CLI_TEMPLATE_PATH, content)
  console.log("Updated CLI template VERSIONS to " + versionWithCaret)
}

function main(): void {
  // Read version from root package.json
  const rootPkgPath = path.join(ROOT_DIR, "package.json")
  const rootPkg = readJson(rootPkgPath)
  const version = rootPkg.version

  if (!version) {
    console.error("Error: No version field in root package.json")
    process.exit(1)
  }

  console.log("Syncing version " + version + " across all packages...\n")

  // Update all package versions
  updatePackageVersions(version)

  console.log("")

  // Update CLI template
  updateCliTemplate(version)

  console.log("\nVersion sync complete!")
}

main()
