<div align="left">

# @view-ignored/create [![version](https://npmx.dev/api/registry/badge/version/@view-ignored/create)](https://npmx.dev/package/@view-ignored/create) [![view-ignored](https://npmx.dev/api/registry/badge/version/view-ignored?label=view-ignored)](https://npmx.dev/package/view-ignored) [![wiki](https://img.shields.io/badge/docs-wiki-blue)](https://github.com/view-ignored/view-ignored/wiki/How-to-create-plugin-public-npm-package)

</h1>

Create public view-ignored target packages with Bun. ([Guide](https://github.com/view-ignored/view-ignored/wiki/How-to-create-plugin-public-npm-package))

</div>

## Quick Start

`@view-ignored/create` will start interactive prompts to guide you through creating a new target package.

```bash
npm create @view-ignored
npmx @view-ignored/create
bunx @view-ignored/create
```

You can also specify the target name, directory, and options directly:

```txt
Usage: bunx @view-ignored/create [target-name] [directory] [options]

Target name:
  'test' creates '@view-ignored/target-test/'
  'view-ignored-test' creates 'view-ignored-test/'

Options:
  -f, --force         Overwrite existing directory if non-empty
  --no-install        Skip running 'bun install' after generating target package
  --type <type>       Package type: 'target' or 'view-ignored' (default: 'target')
  -h, --help          Show this help message
```

## License

MIT License. See [LICENSE.txt](LICENSE.txt) for details.
