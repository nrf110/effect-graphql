/**
 * tsconfig.json template generation
 */

import type { TemplateContext } from "../types"

/**
 * Generate tsconfig.json content
 */
export const generateTsConfig = (ctx: TemplateContext): string => {
  const config = ctx.isMonorepo
    ? {
        // In a monorepo, extend from root tsconfig
        extends: "../../tsconfig.json",
        compilerOptions: {
          outDir: "./dist",
          rootDir: "./src",
          noEmit: true,
        },
        include: ["src/**/*"],
        exclude: ["node_modules", "dist"],
      }
    : {
        // Standalone project config
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          lib: ["ES2022"],
          outDir: "./dist",
          rootDir: "./src",
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          declaration: true,
          declarationMap: true,
          sourceMap: true,
          noEmit: true,
          // Effect requires these for decorators
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
        },
        include: ["src/**/*"],
        exclude: ["node_modules", "dist"],
      }

  return JSON.stringify(config, null, 2) + "\n"
}
