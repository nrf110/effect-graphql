/**
 * Template orchestration - generates all project files
 */

import type { GeneratedFile, TemplateContext } from "../types"
import { generatePackageJson } from "./package-json"
import { generateTsConfig } from "./tsconfig"
import { generateServerTemplate } from "./server"

/**
 * Generate a .gitignore file
 */
const generateGitignore = (): string => `# Dependencies
node_modules/

# Build output
dist/
*.tsbuildinfo

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Testing
coverage/
`

/**
 * Generate all project files
 */
export const generateProject = (ctx: TemplateContext): GeneratedFile[] => [
  {
    path: "package.json",
    content: generatePackageJson(ctx),
  },
  {
    path: "tsconfig.json",
    content: generateTsConfig(ctx),
  },
  {
    path: "src/index.ts",
    content: generateServerTemplate(ctx),
  },
  {
    path: ".gitignore",
    content: generateGitignore(),
  },
]

export { generatePackageJson } from "./package-json"
export { generateTsConfig } from "./tsconfig"
export { generateServerTemplate } from "./server"
