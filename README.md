A rapid scaffolding generator that leaves your core dependencies upgradeable.
#### Arundo Approved.

# Requirements
- [Node (current, v10+)](https://nodejs.org/en/download/current/)
- [Yarn](https://yarnpkg.com/lang/en/docs/install/#mac-stable)
- need NPM_TOKEN environment set to allow @arundo deps

```
export NPM_TOKEN=0eedeefa-1bac-4452-9b5e-f8e946cabec3
```

# Get Started
```bash
mkdir myproject                  # create a directory for your project
cd myproject                     # enter new project directory
npm init                         # initialize project
git init                         # connect directory to git
yarn add -D @arundo/spa-builder  # add spa-builder as a devDependency
yarn generate                    # run the spa-builder
yarn dev                         # start the dev server

# code stuff and hit save!
```

# Exposed Commands
- Just one: `yarn release`

### Options
```bash
-V, --version     output the version number
-M, --major       major release X.#.# for breaking changes
-m, --minor       minor release #.X.# non-breaking for feature additions
-p, --patch       patch release #.#.X for patch fixes/tweaks
-s, --src <dir>   directory to build/release from (default=./src)
-t, --temp <dir>  temporary build directory (default=./.dist)
-d, --dry         build, but do not publish
-c, --nocleanup   leave build folder after publishing
-h, --help        output usage information
```
