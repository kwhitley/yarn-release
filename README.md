Simplifies module releases to NPM via Yarn
===

# Why?
When you want to publish to NPM, but NOT from the root (e.g. from a build folder),
this basically simplifies the following steps into a single one:
- copying the root package.json into the build folder
- cleaning it up to remove dev deps
- navigating into that folder
- incrementing the appropriate version number
- publishing
- making sure that version number makes it back down to the root project to keep it all in sync
- navigating back out to the root

# Installation
```
yarn add -D @supergeneric/yarn-release
```

# Exposed Commands
- Just one: `yarn release --major|minor|patch [options]`

### Options
```bash
-V, --version     output the version number
-M, --major       major release X.#.# for breaking changes
-m, --minor       minor release #.X.# non-breaking for feature additions
-p, --patch       patch release #.#.X for patch fixes/tweaks
-s, --src <dir>   directory to build/release from (default=./src)
-d, --dest <dir>  temporary build directory (default=./.dist)
-t, --test        build, but do not publish (great for testing locally)
-c, --nocleanup   leave build folder after publishing (great for testing locally)
-v, --verbose     writes a bunch of extra stuff to the console
-h, --help        output usage information
```

### Example Usage (package.json)
```js
{
  "scripts": {
    "build": "do some stuff",
    "release:major": "yarn build && release --major --src=build",
    "release:minor": "yarn build && release --minor --src=build",
    "release:patch": "yarn build && release --patch --src=build",
  }
}
```

### Caveats
- This build will do a generic `yarn publish` without specific `--access=public` flag,
meaning it will default to private if it's never been published.  Solution is to publish once with that
flag set, then use `release` to maintain.
