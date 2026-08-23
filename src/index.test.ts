import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { createTargetPackage, runCli } from "./index.js"

describe("@view-ignored/create generator", () => {
	const tempDirs: string[] = []

	function makeTmpDir(): string {
		const dir = mkdtempSync(join(tmpdir(), "vign-create-test-"))
		tempDirs.push(dir)
		return dir
	}

	afterEach(() => {
		for (const dir of tempDirs) {
			if (existsSync(dir)) {
				rmSync(dir, { force: true, recursive: true })
			}
		}
		tempDirs.length = 0
	})

	test("creates target package with default options and runs bun install", () => {
		const rootTmp = makeTmpDir()
		const name = "testing"
		const targetDir = join(rootTmp, "target-testing")

		const res = createTargetPackage({ install: true, name, targetDir })
		expect(res.packageName).toBe("@view-ignored/target-testing")
		expect(res.functionName).toBe("makeTesting")

		const requiredFiles = [
			"package.json",
			"src/index.ts",
			"src/index.test.ts",
			"src/tsconfig.json",
			"src/tsconfig.prod.json",
			"src/tsconfig.prod22.json",
			"src/tsconfig.prod24.json",
			".gitignore",
			".gitattributes",
			".oxfmtrc.json",
			".oxlintrc.json",
			"bunfig.toml",
			"README.md",
			".vscode/extensions.json",
			".vscode/settings.json",
			".vscode/tasks.json",
			".github/workflows/prerelease.yml",
			".github/workflows/release.yml",
		]

		for (const file of requiredFiles) {
			expect(res.files).toContain(file)
			expect(existsSync(join(targetDir, file))).toBe(true)
		}

		// Check bun install side-effect (bun.lock created)
		expect(existsSync(join(targetDir, "bun.lock"))).toBe(true)

		const pkgJsonRaw = readFileSync(join(targetDir, "package.json"), "utf8")
		const pkgJsonKeys = Object.keys(JSON.parse(pkgJsonRaw))
		expect(pkgJsonKeys).toEqual([
			"name",
			"version",
			"description",
			"keywords",
			"bugs",
			"license",
			"author",
			"repository",
			"directories",
			"files",
			"type",
			"exports",
			"publishConfig",
			"scripts",
			"devDependencies",
			"engines",
			"peerDependencies",
		])

		const indexTs = readFileSync(join(targetDir, "src/index.ts"), "utf8")
		expect(indexTs).toContain("export function makeTesting()")
		expect(indexTs).toContain(".testingignore")
	}, 30000)

	test("creates target package without running bun install when install: false", () => {
		const rootTmp = makeTmpDir()
		const targetDir = join(rootTmp, "my-target")

		const res = createTargetPackage({
			install: false,
			name: "awesome-tool",
			targetDir,
		})
		expect(res.packageName).toBe("@view-ignored/target-awesome-tool")
		expect(res.functionName).toBe("makeAwesomeTool")
		expect(existsSync(join(targetDir, "bun.lock"))).toBe(false)
	})

	test("throws error when package.json exists unless force is used", () => {
		const rootTmp = makeTmpDir()
		const name = "testing"
		const targetDir = join(rootTmp, "existing")

		createTargetPackage({ install: false, name, targetDir })

		expect(() => createTargetPackage({ install: false, name, targetDir })).toThrow(
			"already contains a package.json",
		)

		expect(() =>
			createTargetPackage({ force: true, install: false, name, targetDir }),
		).not.toThrow()
	})

	test("runCli displays help with --help", () => {
		const logs: string[] = []
		const origLog = console.log
		console.log = (...args: unknown[]) => {
			logs.push(args.join(" "))
		}

		try {
			runCli(["--help"])
			expect(logs.join("\n")).toContain("Usage: create-view-ignored")
		} finally {
			console.log = origLog
		}
	})

	test("runCli creates target package from CLI positional args", () => {
		const rootTmp = makeTmpDir()
		const targetDir = join(rootTmp, "cli-target")

		const logs: string[] = []
		const origLog = console.log
		console.log = (...args: unknown[]) => {
			logs.push(args.join(" "))
		}

		try {
			runCli(["my-cli-target", targetDir, "--no-install"])
			expect(logs.join("\n")).toContain("Successfully created target package")
			expect(existsSync(join(targetDir, "package.json"))).toBe(true)
			expect(existsSync(join(targetDir, ".github/workflows/prerelease.yml"))).toBe(true)
		} finally {
			console.log = origLog
		}
	})
})
