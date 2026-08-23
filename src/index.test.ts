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

	test("creates target package with default options", () => {
		const rootTmp = makeTmpDir()
		const name = "testing"
		const targetDir = join(rootTmp, "target-testing")

		const res = createTargetPackage({ name, targetDir })
		expect(res.packageName).toBe("@view-ignored/target-testing")
		expect(res.functionName).toBe("makeTesting")
		expect(res.files).toContain("package.json")
		expect(res.files).toContain("src/index.ts")

		const pkgJson = JSON.parse(readFileSync(join(targetDir, "package.json"), "utf8"))
		expect(pkgJson.name).toBe("@view-ignored/target-testing")
		expect(pkgJson.peerDependencies["view-ignored"]).toBe("*")

		const indexTs = readFileSync(join(targetDir, "src/index.ts"), "utf8")
		expect(indexTs).toContain("export function makeTesting()")
		expect(indexTs).toContain(".testingignore")
	})

	test("creates target package with custom name and scope", () => {
		const rootTmp = makeTmpDir()
		const targetDir = join(rootTmp, "my-target")

		const res = createTargetPackage({
			name: "awesome-tool",
			targetDir,
		})
		expect(res.packageName).toBe("@view-ignored/target-awesome-tool")
		expect(res.functionName).toBe("makeAwesomeTool")

		const pkgJson = JSON.parse(readFileSync(join(targetDir, "package.json"), "utf8"))
		expect(pkgJson.name).toBe("@view-ignored/target-awesome-tool")

		const indexTs = readFileSync(join(targetDir, "src/index.ts"), "utf8")
		expect(indexTs).toContain("export function makeAwesomeTool()")
		expect(indexTs).toContain(".awesometoolignore")
	})

	test("throws error when package.json exists unless force is used", () => {
		const rootTmp = makeTmpDir()
		const name = "testing"
		const targetDir = join(rootTmp, "existing")

		createTargetPackage({ name, targetDir })

		expect(() => createTargetPackage({ name, targetDir })).toThrow(
			"already contains a package.json",
		)

		expect(() => createTargetPackage({ name, force: true, targetDir })).not.toThrow()
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
			runCli(["my-cli-target", targetDir])
			expect(logs.join("\n")).toContain("Successfully created target package")
			expect(existsSync(join(targetDir, "package.json"))).toBe(true)
		} finally {
			console.log = origLog
		}
	})
})
