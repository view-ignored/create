#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

export interface CreateTargetPackageOptions {
	/**
	 * Overwrite existing directory if it is not empty.
	 */
	force?: boolean
	/**
	 * Name of the target or package.
	 */
	name: string
	/**
	 * Output target directory path.
	 */
	targetDir?: string
}

export interface CreateTargetPackageResult {
	/**
	 * Created directory path.
	 */
	dir: string
	/**
	 * List of created files.
	 */
	files: string[]
	/**
	 * Target function export name (e.g. `makeCustom`).
	 */
	functionName: string
	/**
	 * Package name (e.g. `view-ignored-target-custom`).
	 */
	packageName: string
}

function toPascalCase(str: string): string {
	const cleaned = str.replace(/^@/, "").replace(/[^a-zA-Z0-9]+/g, " ")
	return cleaned
		.split(" ")
		.filter((word) => word.length > 0)
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
		.join("")
}

function normalizePackageName(rawName: string): string {
	const trimmed = rawName.trim().toLowerCase()
	if (trimmed.startsWith("@") || trimmed.includes("view-ignored")) return trimmed
	return `@view-ignored/target-${trimmed}`
}

function normalizeTargetName(rawName: string): string {
	const name = rawName.trim()
	const withoutScope = name.startsWith("@") ? name.split("/")[1] || name : name
	const withoutPrefix = withoutScope.replace(/^target-/, "").replace(/^view-ignored-/, "")
	return toPascalCase(withoutPrefix)
}

export function createTargetPackage(
	options: CreateTargetPackageOptions,
): CreateTargetPackageResult {
	const { name } = options
	const packageName = normalizePackageName(name)
	const targetName = normalizeTargetName(name)
	const functionName = `make${targetName}`

	const outputDir = resolve(options.targetDir || packageName)

	if (existsSync(outputDir) && !options.force) {
		const isPackageJsonExist = existsSync(resolve(outputDir, "package.json"))
		if (isPackageJsonExist) {
			throw new Error(
				`Directory "${outputDir}" already contains a package.json. Use force option to overwrite.`,
			)
		}
	}

	mkdirSync(resolve(outputDir, "src"), { recursive: true })

	const packageJsonContent = JSON.stringify(
		{
			description: `view-ignored target plugin for ${targetName}.`,
			devDependencies: {
				"@types/bun": "latest",
				"@types/node": "latest",
				oxfmt: "latest",
				oxlint: "latest",
				typescript: "latest",
				"view-ignored": "latest",
			},
			engines: {
				node: ">=22",
			},
			exports: {
				".": {
					default: "./out/index.js",
					types: "./out/index.d.ts",
				},
			},
			keywords: ["view-ignored", "target", targetName.toLowerCase()],
			license: "MIT",
			name: packageName,
			peerDependencies: {
				"view-ignored": "*",
			},
			scripts: {
				check: "bun tsc -p src --noEmit",
				dev: "bun tsc -p src",
				fmt: "bun run oxfmt",
				lint: "bun run oxlint --type-aware",
				prod: "rm -rf out && bun tsc -p src/tsconfig.prod.json --emitDeclarationOnly && bun tsc -p src/tsconfig.prod.json --removeComments -d false && (mv .gitignore .gitignore.tmp 2>/dev/null || true); oxfmt out; (mv .gitignore.tmp .gitignore 2>/dev/null || true)",
				test: "bun test --timeout 5000 src",
			},
			type: "module",
			version: "0.1.0",
		},
		null,
		"\t",
	)

	const indexTsContent = `import type { Target } from "view-ignored/targets"

import { extractIgnores, ruleCompile, ruleTest, type Extractor, type Rule } from "view-ignored/patterns"

/**
 * Creates a view-ignored target for ${targetName}.
 */
export function ${functionName}(): Target {
	const extractors: Extractor[] = [
		{
			extract: extractIgnores,
			path: ".${targetName.toLowerCase()}ignore",
		},
	]

	const internalRules: Rule[] = [
		ruleCompile({
			compiled: null,
			excludes: true,
			list: [".git", "node_modules"],
		}),
	]

	return {
		extractors,
		ignores: ruleTest,
		internalRules,
		root: ".",
	}
}
`

	const indexTestTsContent = `import { describe, expect, test } from "bun:test"
import { scan } from "view-ignored"

import { ${functionName} } from "./index.js"

describe("${functionName}", () => {
	test("creates target and scans directory", async () => {
		const target = ${functionName}()
		expect(target.root).toBe(".")
		expect(target.extractors.length).toBeGreaterThan(0)

		const ctx = await scan({ target })
		expect(ctx).toBeDefined()
	})
})
`

	const tsconfigJsonContent = JSON.stringify(
		{
			compilerOptions: {
				declaration: true,
				declarationMap: true,
				lib: ["es2024"],
				module: "nodenext",
				moduleResolution: "nodenext",
				noImplicitOverride: true,
				noImplicitReturns: true,
				noUncheckedIndexedAccess: true,
				outDir: "../out",
				rootDir: ".",
				skipLibCheck: true,
				sourceMap: true,
				strict: true,
				target: "esnext",
				types: ["node", "bun"],
				verbatimModuleSyntax: true,
			},
			exclude: ["../node_modules"],
		},
		null,
		"\t",
	)

	const tsconfigProdJsonContent = JSON.stringify(
		{
			compilerOptions: {
				declaration: true,
				declarationMap: false,
				sourceMap: false,
				types: ["node"],
			},
			exclude: ["**/*.test.*"],
			extends: "./tsconfig.json",
		},
		null,
		"\t",
	)

	const gitignoreContent = `out
node_modules
*.log
`

	const readmeContent = `# ${packageName}

view-ignored target plugin for ${targetName}.

## Installation

\`\`\`bash
bun add ${packageName} view-ignored
\`\`\`

## Usage

\`\`\`ts
import { scan } from "view-ignored"
import { ${functionName} } from "${packageName}"

const ctx = await scan({ target: ${functionName}() })
\`\`\`

## License

MIT
`

	const files = [
		"package.json",
		"src/index.ts",
		"src/index.test.ts",
		"src/tsconfig.json",
		"src/tsconfig.prod.json",
		".gitignore",
		"README.md",
	]

	writeFileSync(resolve(outputDir, "package.json"), packageJsonContent, "utf8")
	writeFileSync(resolve(outputDir, "src/index.ts"), indexTsContent, "utf8")
	writeFileSync(resolve(outputDir, "src/index.test.ts"), indexTestTsContent, "utf8")
	writeFileSync(resolve(outputDir, "src/tsconfig.json"), tsconfigJsonContent, "utf8")
	writeFileSync(resolve(outputDir, "src/tsconfig.prod.json"), tsconfigProdJsonContent, "utf8")
	writeFileSync(resolve(outputDir, ".gitignore"), gitignoreContent, "utf8")
	writeFileSync(resolve(outputDir, "README.md"), readmeContent, "utf8")

	return {
		dir: outputDir,
		files,
		functionName,
		packageName,
	}
}

export function runCli(args: string[] = process.argv.slice(2)): void {
	if (args.includes("-h") || args.includes("--help")) {
		console.log(`
Usage: create-view-ignored [target-name] [directory] [options]

Target name:
  'test' creates '@view-ignored/target-test/'
  'view-ignored-test' creates 'view-ignored-test'

Options:
  -f, --force    Overwrite existing directory if non-empty
  -h, --help     Show this help message
`)
		return
	}

	let force = false

	const positionalArgs: string[] = []
	for (const arg of args) {
		if (arg === "-f" || arg === "--force") {
			force = true
			continue
		}
		if (!arg.startsWith("-")) positionalArgs.push(arg)
	}

	const [name, targetDir] = positionalArgs
	if (!name) {
		throw new Error(
			"Package name is required" +
				"'test' creates '@view-ignored/target-test/'" +
				"'view-ignored-test' creates 'view-ignored-test'",
		)
	}

	try {
		const result = createTargetPackage({ force, name, targetDir })
		console.log(`Successfully created target package "${result.packageName}" in ${result.dir}`)
	} catch (error) {
		console.error(error instanceof Error ? error.message : error)
		process.exit(1)
	}
}

// Execute when invoked directly as CLI script
if (import.meta.main) runCli()
