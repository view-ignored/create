#!/usr/bin/env node
import { execSync } from "node:child_process"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"

export interface CreateTargetPackageOptions {
	/**
	 * Overwrite existing directory if it is not empty.
	 */
	force?: boolean
	/**
	 * Whether to run `bun install` after creating files. Defaults to `true`.
	 */
	install?: boolean
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
	const { install = true, name } = options
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
			name: packageName,
			version: "0.1.0",
			description: `view-ignored target plugin for ${targetName}.`,
			keywords: ["create", "generator", "target", "view-ignored", targetName.toLowerCase()],
			bugs: {
				url: `https://github.com/view-ignored/${packageName.replace(/^@view-ignored\//, "")}/issues`,
			},
			license: "MIT",
			author: "@",
			repository: {
				type: "git",
				url: `git+https://github.com/view-ignored/${packageName.replace(/^@view-ignored\//, "")}.git`,
			},
			directories: {
				lib: "out",
			},
			files: ["/out"],
			type: "module",
			exports: {
				".": {
					types: "./out/index.d.ts",
					default: "./out/index.js",
				},
			},
			publishConfig: {
				access: "public",
			},
			scripts: {
				prerelease:
					"bun check && bun run test && bun run prod && bun run lint && bun run fmt --check && bun run ts-compat && bun run node-compat && bun publint --pack npm --strict",
				check: "bun tsc -p src --noEmit",
				dev: "bun tsc -p src",
				prod: "rm -rf out && bun tsc -p src/tsconfig.prod.json --emitDeclarationOnly && bun tsc -p src/tsconfig.prod.json --removeComments -d false && oxfmt out/**",
				lint: "bun run oxlint --type-aware",
				fmt: "bun run oxfmt ./out/**/* ./",
				test: "bun test --timeout 5000 src",
				publint: "publint",
				"node-compat": "bun run node-compat-22 && bun run node-compat-24",
				"ts-compat": "bun run ts-compat-6 && bun run ts-compat-5",
				"node-compat-24":
					"node node_modules/typescript6/bin/tsc -p src/tsconfig.prod24.json --noEmit",
				"node-compat-22":
					"node node_modules/typescript6/bin/tsc -p src/tsconfig.prod22.json --noEmit",
				"ts-compat-5":
					"node node_modules/typescript5/bin/tsc -p src/tsconfig.prod.json --noEmit --resolveJsonModule",
				"ts-compat-6": "node node_modules/typescript6/bin/tsc -p src/tsconfig.prod.json --noEmit",
				"release:major": "bun run --bun release-it --increment=major",
				"release:minor": "bun run --bun release-it --increment=minor",
				"release:patch": "bun run --bun release-it --increment=patch",
			},
			devDependencies: {
				"@release-it/keep-a-changelog": "latest",
				"@types/bun": "latest",
				"@types/node": "npm:@types/node@latest",
				"@types/node-22": "npm:@types/node@^22.20.1",
				"@types/node-24": "npm:@types/node@^24.13.3",
				"bun-types": "latest",
				oxfmt: "latest",
				oxlint: "latest",
				"oxlint-tsgolint": "latest",
				publint: "latest",
				"release-it": "latest",
				typescript: "npm:typescript@^7.0.2",
				typescript5: "npm:typescript@~5.7.3",
				typescript6: "npm:typescript@^6.0.3",
				"view-ignored": "latest",
			},
			engines: {
				node: ">=22",
			},
			peerDependencies: {
				"view-ignored": "*",
			},
		},
		null,
		"\t",
	)

	const indexTsContent = `import type { Target } from "view-ignored/targets"

import {
	extractNpmignore,
	ruleCompile,
	ruleTest,
	type Extractor,
	type Rule,
} from "view-ignored/patterns"

/**
 * Creates a view-ignored target for ${targetName}.
 */
export function ${functionName}(): Target {
	const extractors: Extractor[] = [
		{
			extract: extractNpmignore,
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

	const tsconfigJsonContent = `{
	"exclude": ["../node_modules"],
	"compilerOptions": {
		"rootDir": ".",
		"outDir": "../out",

		"target": "esnext",
		"lib": ["es2024"],
		"types": ["node", "bun"],
		"module": "nodenext",
		"moduleResolution": "nodenext",

		"sourceMap": true,
		"declaration": true,
		"declarationMap": true,

		"noUncheckedIndexedAccess": true,
		"exactOptionalPropertyTypes": false,

		"noImplicitReturns": true,
		"noImplicitOverride": true,
		"noUnusedLocals": true,
		"noUnusedParameters": true,

		"strict": true,
		"verbatimModuleSyntax": true,
		"isolatedModules": true,
		"noUncheckedSideEffectImports": true,
		"moduleDetection": "force",
		"skipLibCheck": true,
		"preserveSymlinks": true,
		"maxNodeModuleJsDepth": 0
	}
}
`

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

	const tsconfigProd22JsonContent = JSON.stringify(
		{
			compilerOptions: {
				lib: ["es2024"],
				noEmit: true,
				paths: {
					node: ["../../../node_modules/@types/node-22"],
				},
				target: "es2022",
			},
			extends: "./tsconfig.prod.json",
		},
		null,
		"\t",
	)

	const tsconfigProd24JsonContent = JSON.stringify(
		{
			compilerOptions: {
				lib: ["es2024"],
				noEmit: true,
				paths: {
					node: ["../../../node_modules/@types/node-24"],
				},
				target: "es2024",
			},
			extends: "./tsconfig.prod.json",
		},
		null,
		"\t",
	)

	const gitignoreContent = `node_modules
out
dist
*.tgz
package-lock.json
yarn.lock
pnpm-lock.yaml
deno.lock
`

	const gitattributesContent = `**      eol=lf
bin/**  eol=lf
`

	const oxfmtrcJsonContent = JSON.stringify(
		{
			$schema: "./node_modules/oxfmt/configuration_schema.json",
			semi: false,
			useTabs: true,
			experimentalSortImports: {
				groups: [
					"type-import",
					"type-internal",
					["type-parent", "type-sibling", "type-index"],
					["value-builtin", "value-external"],
					"value-internal",
					["value-parent", "value-sibling", "value-index"],
					"unknown",
				],
			},
		},
		null,
		"\t",
	)

	const oxlintrcJsonContent = JSON.stringify(
		{
			$schema: "./node_modules/oxlint/configuration_schema.json",
			plugins: ["import", "oxc", "unicorn", "jsdoc", "eslint", "typescript"],
			rules: {
				"no-control-regex": "off",
				"no-else-return": "error",
				"no-lonely-if": "error",
				"unicorn/no-lonely-if": "error",
				"oxc/branches-sharing-code": "error",
				"max-depth": "error",
				"typescript/no-explicit-any": "error",
				"typescript/restrict-template-expressions": "off",
				"import/no-duplicates": "error",
				"import/no-cycle": "error",
				"oxc/no-map-spread": "error",
				"oxc/no-accumulating-spread": "error",
				"typescript/require-array-sort-compare": "off",
				"unicorn/prefer-array-index-of": "error",
				"unicorn/no-useless-iterator-to-array": "error",
				"unicorn/no-new-array": "off",
				"eslint/prefer-destructuring": "error",
				"eslint/func-names": ["error", "always"],

				"check-access": "warn",
			},
			categories: {
				perf: "error",
			},
		},
		null,
		"\t",
	)

	const bunfigTomlContent = `[test]
pathIgnorePatterns = ["out/**"]
coveragePathIgnorePatterns = ["src/testSelf*.test.ts"]
onlyFailures = true
timeout = 5000

[install]
minimumReleaseAge = 604800 # 7 days
minimumReleaseAgeExcludes = [
	"typescript",

	"oxlint",
	"@oxlint/binding-darwin-x64",
	"@oxlint/binding-freebsd-x64",
	"@oxlint/binding-darwin-arm64",
	"@oxlint/binding-android-arm64",
	"@oxlint/binding-linux-x64-gnu",
	"@oxlint/binding-linux-x64-musl",
	"@oxlint/binding-win32-x64-msvc",
	"@oxlint/binding-linux-arm64-gnu",
	"@oxlint/binding-linux-ppc64-gnu",
	"@oxlint/binding-linux-s390x-gnu",
	"@oxlint/binding-win32-ia32-msvc",
	"@oxlint/binding-android-arm-eabi",
	"@oxlint/binding-linux-arm64-musl",
	"@oxlint/binding-win32-arm64-msvc",
	"@oxlint/binding-linux-riscv64-gnu",
	"@oxlint/binding-openharmony-arm64",
	"@oxlint/binding-linux-riscv64-musl",
	"@oxlint/binding-linux-arm-gnueabihf",
	"@oxlint/binding-linux-arm-musleabihf",

	"oxfmt",
	"@oxfmt/binding-darwin-x64",
	"@oxfmt/binding-freebsd-x64",
	"@oxfmt/binding-darwin-arm64",
	"@oxfmt/binding-android-arm64",
	"@oxfmt/binding-linux-x64-gnu",
	"@oxfmt/binding-linux-x64-musl",
	"@oxfmt/binding-win32-x64-msvc",
	"@oxfmt/binding-linux-arm64-gnu",
	"@oxfmt/binding-linux-ppc64-gnu",
	"@oxfmt/binding-linux-s390x-gnu",
	"@oxfmt/binding-win32-ia32-msvc",
	"@oxfmt/binding-android-arm-eabi",
	"@oxfmt/binding-linux-arm64-musl",
	"@oxfmt/binding-win32-arm64-msvc",
	"@oxfmt/binding-linux-riscv64-gnu",
	"@oxfmt/binding-openharmony-arm64",
	"@oxfmt/binding-linux-riscv64-musl",
	"@oxfmt/binding-linux-arm-gnueabihf",
	"@oxfmt/binding-linux-arm-musleabihf",
]
linker = "isolated"
globalStore = true
`

	const vscodeExtensionsJsonContent = JSON.stringify(
		{
			recommendations: ["oxc.oxc-vscode"],
		},
		null,
		"\t",
	)

	const vscodeSettingsJsonContent = JSON.stringify(
		{
			"editor.defaultFormatter": "oxc.oxc-vscode",
			"files.eol": "\n",
			"js/ts.format.enabled": false,
			"js/ts.tsdk.path": "node_modules/typescript/lib",
		},
		null,
		"\t",
	)

	const vscodeTasksJsonContent = JSON.stringify(
		{
			tasks: [
				{
					detail: "bun run build",
					icon: {
						color: "terminal.ansiWhite",
						id: "package",
					},
					label: "Build",
					problemMatcher: "$tsc",
					script: "build",
					type: "bun",
				},
				{
					args: ["run", "build", "--watch"],
					command: "bun",
					detail: "bun run build --watch",
					icon: {
						color: "terminal.ansiWhite",
						id: "package",
					},
					label: "Build & Watch",
					problemMatcher: "$tsc-watch",
					type: "shell",
				},
				{
					detail: "bun run lint",
					icon: {
						color: "terminal.ansiWhite",
						id: "sparkle",
					},
					label: "Lint",
					script: "lint",
					type: "bun",
				},
				{
					icon: {
						color: "terminal.ansiRed",
						id: "versions",
					},
					label: "Release major - any backward incompatible changes",
					script: "release:major",
					type: "bun",
				},
				{
					icon: {
						color: "terminal.ansiGreen",
						id: "versions",
					},
					label: "Release minor - any new public functionality or deprecation",
					script: "release:minor",
					type: "bun",
				},
				{
					icon: {
						color: "terminal.ansiYellow",
						id: "versions",
					},
					label: "Release patch - any backward compatible bug fixes",
					script: "release:patch",
					type: "bun",
				},
				{
					detail: "bun run node --test out/**/*.test.js",
					icon: {
						color: "terminal.ansiWhite",
						id: "check-all",
					},
					label: "Test",
					script: "test",
					type: "bun",
				},
			],
			version: "2.0.0",
		},
		null,
		"\t",
	)

	const githubPrereleaseYmlContent = `name: Prerelease

on:
  workflow_dispatch:
  pull_request:
    types: [opened, synchronize, reopened, ready_for_review]

jobs:
  prerelease:
    if: github.event_name != 'pull_request' || !github.event.pull_request.draft
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest]
    runs-on: \${{ matrix.os }}
    permissions:
      contents: write
      id-token: write
    env:
      GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}

    steps:
      - uses: actions/checkout@v6
        with:
          ref: \${{ github.event.ref || github.ref }}
          fetch-depth: 0

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.4.0"

      - uses: actions/setup-node@v6
        with:
          token: \${{ secrets.GH_DOTCOM_TOKEN }}
          node-version: 26

      - name: Bun install
        run: bun install

      - name: Run prerelease
        timeout-minutes: 1
        run: |
          bun run prerelease
`

	const githubReleaseYmlContent = `name: Release

on:
  workflow_dispatch:
    inputs:
      release_type:
        description: Select release type
        required: true
        type: choice
        options:
          - patch
          - minor
          - major
      dry_run:
        description: Enable dry run
        required: false
        type: boolean
        default: false

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      id-token: write
    env:
      GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}

    steps:
      - uses: actions/checkout@v6
        with:
          ref: \${{ github.event.ref || github.ref }}
          fetch-depth: 0

      - name: Configure git author
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git status

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: "1.4.0"

      - uses: actions/setup-node@v6
        with:
          token: \${{ secrets.GH_DOTCOM_TOKEN }}
          node-version: 26

      - name: Bun install
        run: bun install

      - name: Run release
        run: |
          if [ "\${{ inputs.dry_run }}" = "true" ]; then
            bun run release:\${{ inputs.release_type }} --ci --dry-run --git.requireCleanWorkingDir=false
          else
            bun run release:\${{ inputs.release_type }} --ci --git.requireCleanWorkingDir=false
          fi
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

	const fileContentsMap: Record<string, string> = {
		".gitattributes": gitattributesContent,
		".github/workflows/prerelease.yml": githubPrereleaseYmlContent,
		".github/workflows/release.yml": githubReleaseYmlContent,
		".gitignore": gitignoreContent,
		".oxfmtrc.json": oxfmtrcJsonContent,
		".oxlintrc.json": oxlintrcJsonContent,
		".vscode/extensions.json": vscodeExtensionsJsonContent,
		".vscode/settings.json": vscodeSettingsJsonContent,
		".vscode/tasks.json": vscodeTasksJsonContent,
		"README.md": readmeContent,
		"bunfig.toml": bunfigTomlContent,
		"package.json": packageJsonContent,
		"src/index.test.ts": indexTestTsContent,
		"src/index.ts": indexTsContent,
		"src/tsconfig.json": tsconfigJsonContent,
		"src/tsconfig.prod.json": tsconfigProdJsonContent,
		"src/tsconfig.prod22.json": tsconfigProd22JsonContent,
		"src/tsconfig.prod24.json": tsconfigProd24JsonContent,
	}

	const files = Object.keys(fileContentsMap)

	for (const [relativePath, content] of Object.entries(fileContentsMap)) {
		const fullPath = resolve(outputDir, relativePath)
		mkdirSync(dirname(fullPath), { recursive: true })
		writeFileSync(fullPath, content, "utf8")
	}

	if (install) {
		const o = { cwd: outputDir, stdio: "inherit" } as const
		execSync("bun install", o)
		execSync("bun run fmt", o)
		execSync("bun run prod", o)
	}

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
  -f, --force         Overwrite existing directory if non-empty
  --no-install        Skip running 'bun install' after generating target package
  -h, --help          Show this help message
`)
		return
	}

	let force = false
	let install = true

	const positionalArgs: string[] = []
	for (const arg of args) {
		if (arg === "-f" || arg === "--force") {
			force = true
			continue
		}
		if (arg === "--no-install") {
			install = false
			continue
		}
		if (!arg.startsWith("-")) positionalArgs.push(arg)
	}

	const [name, targetDir] = positionalArgs
	if (!name) {
		throw new Error(
			"Package name is required\n" +
				"'test' creates '@view-ignored/target-test/'\n" +
				"'view-ignored-test' creates 'view-ignored-test'",
		)
	}

	try {
		const result = createTargetPackage({ force, install, name, targetDir })
		console.log(`Successfully created target package "${result.packageName}" in ${result.dir}`)
	} catch (error) {
		console.error(error instanceof Error ? error.message : error)
		process.exit(1)
	}
}

// Execute when invoked directly as CLI script
if (import.meta.main) runCli()
