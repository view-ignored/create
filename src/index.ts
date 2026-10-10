#!/usr/bin/env node
import { execSync } from "node:child_process"
import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import prompts from "prompts"

export type PackageType = "target" | "view-ignored"

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
	/**
	 * Package generator type: "target" (default) or "view-ignored".
	 */
	type?: PackageType
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

function normalizePackageName(rawName: string, type: PackageType = "target"): string {
	const trimmed = rawName.trim().toLowerCase()
	if (trimmed.startsWith("@") || trimmed.includes("view-ignored")) return trimmed
	if (type === "view-ignored") return trimmed
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
	const { install = true, name, type = "target" } = options
	const packageName = normalizePackageName(name, type)
	const targetName = normalizeTargetName(name)
	const functionName = type === "view-ignored" ? "main" : `make${targetName}`

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

	const repoName = packageName.startsWith("@")
		? packageName.split("/")[1] || packageName
		: packageName

	const devDependencies: Record<string, string> = {
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
	}

	const dependencies: Record<string, string> = {}
	const peerDependencies: Record<string, string> = {}

	if (type === "view-ignored") {
		dependencies["view-ignored"] = "latest"
	} else {
		devDependencies["view-ignored"] = "latest"
		peerDependencies["view-ignored"] = "*"
	}

	const pkgObject: Record<string, unknown> = {
		name: packageName,
		version: "0.1.0",
		description:
			type === "view-ignored"
				? `Package using view-ignored for ${targetName}.`
				: `view-ignored target plugin for ${targetName}.`,
		keywords: [
			"create",
			targetName.toLowerCase(),
			"generator",
			type === "view-ignored" ? "app" : "target",
			"view-ignored",
		].sort(),
		bugs: { url: `https://github.com/view-ignored/${repoName}/issues` },
		license: "MIT",
		author: "@",
		repository: { type: "git", url: `git+https://github.com/view-ignored/${repoName}.git` },
		directories: { lib: "out" },
		files: ["/out"],
		type: "module",
		exports: { ".": { types: "./out/index.d.ts", default: "./out/index.js" } },
		publishConfig: { access: "public" },
		scripts: {
			check: "bun tsc -p src --noEmit",
			dev: "bun tsc -p src",
			fmt: "bun run oxfmt",
			lint: "bun run oxlint --type-aware",
			"node-compat": "bun node-compat-22 && bun node-compat-24",
			"node-compat-22": "bun node_modules/typescript6/bin/tsc -p src/tsconfig.prod22.json --noEmit",
			"node-compat-24": "bun node_modules/typescript6/bin/tsc -p src/tsconfig.prod24.json --noEmit",
			prerelease:
				"bun check && bun run test && bun run prod && bun run lint && bun run fmt --check && bun run ts-compat && bun run node-compat && bun publint --pack npm --strict",
			prod: "rm -rf out && bun tsc -p src/tsconfig.prod.json --emitDeclarationOnly && bun tsc -p src/tsconfig.prod.json --removeComments -d false && oxfmt --no-error-on-unmatched-pattern ./out/**/*.js ./out/**/*.d.ts",
			publint: "publint",
			"release:major": "bun run --bun release-it --increment=major",
			"release:minor": "bun run --bun release-it --increment=minor",
			"release:patch": "bun run --bun release-it --increment=patch",
			test: "bun test --timeout 5000 src",
			"ts-compat": "bun run ts-compat-6 && bun run ts-compat-5",
			"ts-compat-5":
				"bun node_modules/typescript5/bin/tsc -p src/tsconfig.prod.json --noEmit --resolveJsonModule",
			"ts-compat-6": "bun node_modules/typescript6/bin/tsc -p src/tsconfig.prod.json --noEmit",
		},
	}

	if (Object.keys(dependencies).length > 0) {
		pkgObject.dependencies = dependencies
	}

	pkgObject.devDependencies = devDependencies

	if (Object.keys(peerDependencies).length > 0) {
		pkgObject.peerDependencies = peerDependencies
	}

	pkgObject.engines = { node: ">=22" }

	const packageJsonContent = JSON.stringify(pkgObject, null, "\t") + "\n"

	const indexTsContent =
		type === "view-ignored"
			? `import { scan } from "view-ignored"
import { type MatcherContext } from "view-ignored/patterns"
import { makeGit } from "view-ignored/targets"

/**
 * Scans path using view-ignored.
 */
export async function ${functionName}(): Promise<MatcherContext> {
	return scan({ target: makeGit() })
}
`
			: `import type { Target } from "view-ignored/targets"

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
	const extractors: Extractor[] = [{ extract: extractNpmignore, path: ".${targetName.toLowerCase()}ignore" }]

	const internalRules: Rule[] = [
		ruleCompile({ compiled: null, excludes: true, list: [".git", "node_modules"] }),
	]

	return { extractors, ignores: ruleTest, internalRules, root: "." }
}
`

	const indexTestTsContent =
		type === "view-ignored"
			? `import { describe, expect, test } from "bun:test"

import { ${functionName} } from "./index.js"

describe("${functionName}", () => {
	test("scans path using view-ignored", async () => {
		const ctx = await ${functionName}()
		expect(ctx).toBeDefined()
	})
})
`
			: `import { describe, expect, test } from "bun:test"
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
	// Visit https://aka.ms/tsconfig to read more about this file
	"compilerOptions": {
		// File Layout
		"rootDir": ".",
		"outDir": "../out",

		// Environment Settings
		// See also https://aka.ms/tsconfig/module
		"target": "esnext",
		// For nodejs:
		"lib": ["es2024"],
		"types": ["node", "bun"],
		"module": "nodenext",
		"moduleResolution": "nodenext",

		// Other Outputs
		"sourceMap": true,
		"declaration": true,
		"declarationMap": true,

		// Stricter Typechecking Options
		"noUncheckedIndexedAccess": true,
		"exactOptionalPropertyTypes": false,

		// Style Options
		"noImplicitReturns": true,
		"noImplicitOverride": true,
		"noUnusedLocals": true,
		"noUnusedParameters": true,
		// "noFallthroughCasesInSwitch": true,
		// "noPropertyAccessFromIndexSignature": true,

		// Recommended Options
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

	const tsconfigProdJsonContent = `{
	"extends": "./tsconfig.json",
	"exclude": ["**/*.test.*"],
	// Visit https://aka.ms/tsconfig to read more about this file
	"compilerOptions": {
		"types": ["node"],
		// Other Outputs
		"sourceMap": false,
		"declaration": true,
		"declarationMap": false
	}
}
`

	const tsconfigProd22JsonContent = `{
	"extends": "./tsconfig.prod.json",
	// Visit https://aka.ms/tsconfig to read more about this file
	"compilerOptions": {
		"noEmit": true,
		"lib": ["es2024"],
		"target": "es2022",
		"paths": { "node": ["../node_modules/@types/node-22"] }
	}
}
`

	const tsconfigProd24JsonContent = `{
	"extends": "./tsconfig.prod.json",
	// Visit https://aka.ms/tsconfig to read more about this file
	"compilerOptions": {
		"noEmit": true,
		"lib": ["es2024"],
		"target": "es2024",
		"paths": { "node": ["../node_modules/@types/node-24"] }
	}
}
`

	const gitignoreContent = `node_modules
out
dist
*.tgz
coverage
package-lock.json
yarn.lock
pnpm-lock.yaml
deno.lock
`

	const gitattributesContent = `**      eol=lf
bin/**  eol=lf
`

	const oxfmtrcJsonContent = `{
	"$schema": "./node_modules/oxfmt/configuration_schema.json",
	"semi": false,
	"useTabs": true,
	"objectWrap": "collapse",
	"experimentalSortImports": {
		"groups": [
			"type-import",
			"type-internal",
			["type-parent", "type-sibling", "type-index"],
			["value-builtin", "value-external"],
			"value-internal",
			["value-parent", "value-sibling", "value-index"],
			"unknown"
		]
	}
}
`

	const oxlintrcJsonContent = `{
	"$schema": "./node_modules/oxlint/configuration_schema.json",
	"plugins": ["import", "oxc", "unicorn", "jsdoc", "eslint", "typescript"],
	"rules": {
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
		"typescript/dot-notation": "error",
		"object-shorthand": "error",
		"oxc/no-map-spread": "error",
		"oxc/no-accumulating-spread": "error",
		"typescript/require-array-sort-compare": "off",
		"unicorn/prefer-array-index-of": "error",
		"unicorn/no-useless-iterator-to-array": "error",
		"unicorn/no-new-array": "off",
		"unicorn/prefer-ternary": "error",
		"unicorn/prefer-logical-operator-over-ternary": "error",
		"eslint/prefer-destructuring": "error",
		"eslint/func-names": ["error", "always"],
		"check-access": "error"
	},
	"categories": { "perf": "error" }
}
`

	const releaseItJsonContent = `{
	"$schema": "https://unpkg.com/release-it@19/schema/release-it.json",
	"hooks": { "before:init": "bun prerelease" },
	"plugins": { "@release-it/keep-a-changelog": { "filename": "CHANGELOG.md" } },
	"github": { "release": true, "draft": false, "releaseName": "\${version}", "skipChecks": true },
	"npm": { "publish": true, "skipChecks": true },
	"git": { "requireBranch": false }
}
`

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

	const vscodeExtensionsJsonContent = `{ "recommendations": ["oxc.oxc-vscode", "typescriptteam.native-preview"] }
`

	const vscodeSettingsJsonContent = `{
	"javascript.format.enable": false,
	"typescript.format.enable": false,
	"files.eol": "\\n",
	"typescript.tsdk": "node_modules/typescript/lib",
	"editor.defaultFormatter": "oxc.oxc-vscode"
}
`

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

	const readmeContent = `# ${packageName} [![version](https://npmx.dev/api/registry/badge/version/${packageName})](https://npmx.dev/package/${packageName}) [![view-ignored](https://npmx.dev/api/registry/badge/version/view-ignored?label=view-ignored)](https://npmx.dev/package/view-ignored)

view-ignored target plugin for ${targetName}.

## Installation

\`\`\`bash
bun add ${packageName} view-ignored
\`\`\`

## Usage

\`\`\`ts
import { ${functionName} } from "${packageName}"
import { scan } from "view-ignored"

const ctx = await scan({ target: ${functionName}() })
\`\`\`

## License

MIT License. See [LICENSE.txt](LICENSE.txt) for details.
`
	const licenseTxtContent = `MIT License

Copyright (c) 2024 Mopsgamer

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`
	const changelogContent = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

- Initial release.
`

	const fileContentsMap: Record<string, string> = {
		".gitattributes": gitattributesContent,
		".github/workflows/prerelease.yml": githubPrereleaseYmlContent,
		".github/workflows/release.yml": githubReleaseYmlContent,
		".gitignore": gitignoreContent,
		".oxfmtrc.json": oxfmtrcJsonContent,
		".oxlintrc.json": oxlintrcJsonContent,
		".release-it.json": releaseItJsonContent,
		".vscode/extensions.json": vscodeExtensionsJsonContent,
		".vscode/settings.json": vscodeSettingsJsonContent,
		"README.md": readmeContent,
		"LICENSE.txt": licenseTxtContent,
		"CHANGELOG.md": changelogContent,
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
		execSync("bun install --prefer-offline", o)
		execSync("bun run prod", o)
	}

	return { dir: outputDir, files, functionName, packageName }
}

export async function runCli(args: string[] = process.argv.slice(2)): Promise<void> {
	if (args.includes("-h") || args.includes("--help")) {
		console.log(`
Usage: create-view-ignored [target-name] [directory] [options]

Target name:
  'test' creates '@view-ignored/target-test/'
  'view-ignored-test' creates 'view-ignored-test/'

Options:
  -f, --force         Overwrite existing directory if non-empty
  --no-install        Skip running 'bun install' after generating target package
  --type <type>       Package type: 'target' or 'view-ignored' (default: 'target')
  -h, --help          Show this help message
`)
		return
	}

	let force = false
	let install = true
	let type: PackageType | undefined

	const positionalArgs: string[] = []
	for (let i = 0; i < args.length; i++) {
		const arg = args[i]!
		if (arg === "-f" || arg === "--force") {
			force = true
			continue
		}
		if (arg === "--no-install") {
			install = false
			continue
		}
		if (arg === "--type") {
			const next = args[i + 1]
			if (next && !next.startsWith("-")) {
				if (next === "target" || next === "view-ignored") {
					type = next
				}
				i++
			}
			continue
		}
		if (arg.startsWith("--type=")) {
			const val = arg.slice("--type=".length)
			if (val === "target" || val === "view-ignored") {
				type = val
			}
			continue
		}
		if (!arg.startsWith("-")) positionalArgs.push(arg)
	}

	let [name, targetDir] = positionalArgs

	if (!name || !type) {
		const response = await prompts(
			[
				{
					type: name ? null : "text",
					name: "name",
					message: "Package or target name:",
					validate: (val: string) => (val.trim().length > 0 ? true : "Name is required"),
				},
				{
					type: type ? null : "select",
					name: "type",
					message: "Select package type:",
					choices: [
						{ title: "target (plugin target package implementation)", value: "target" },
						{ title: "view-ignored (package that uses view-ignored)", value: "view-ignored" },
					],
					initial: 0,
				},
			],
			{
				onCancel: () => {
					process.exit(1)
				},
			},
		)

		const { name: resName, type: resType } = response
		if (!name && typeof resName === "string") {
			name = resName
		}
		if (!type && (resType === "target" || resType === "view-ignored")) {
			type = resType
		}
	}

	if (!name) {
		throw new Error(
			"Package name is required\n" +
				"'test' creates '@view-ignored/target-test/'\n" +
				"'view-ignored-test' creates 'view-ignored-test/'",
		)
	}

	try {
		const result = createTargetPackage({ force, install, name, targetDir, type })
		console.log(`Successfully created target package "${result.packageName}" in ${result.dir}`)
	} catch (error) {
		console.error(error instanceof Error ? error.message : error)
		process.exit(1)
	}
}

// Execute when invoked directly as CLI script
if (import.meta.main) await runCli()
