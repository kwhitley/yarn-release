Simplifies module releases to NPM via Yarn
===

# Why?
For simplifying the steps when publishing to NPM (especially if from a subfolder):
- copying the root package.json into the build folder
- cleaning it up to remove dev deps
- navigating into that folder
- incrementing the appropriate version number
- publishing
- making sure that version number makes it back down to the root project to keep it all in sync
- navigating back out to the root

# Installation
```
yarn add -D yarn-release
```

# Exposed Commands
- Just one: `yarn release --major|minor|patch|type=[something] [options]`

### Options
```bash
--type            version type <major|minor|patch|alpha|beta|rc|etc>
--major           major release X.#.# for breaking changes, short for --type=major
--minor           minor release #.X.# non-breaking for feature additions
--patch           patch release #.#.X for patch fixes/tweaks
--src <dir>       directory to build/release from (default=root)
--dest <dir>      temporary build directory (default=./.dist)
--test            build, but do not publish (great for testing locally)
--nocleanup       leave build folder after publishing (great for testing locally)
--nopublish       do not publish new version to NPM
--public          equivalent to npm publish --access=public
--commit          adds unstaged changes (including package.json update) to git and commits
--push            includes --commit, while also doing a "git push" (assumes ref has been set up)
-s, --silent      asks no questions (automated)
-v, --verbose     writes a bunch of extra stuff to the console
-V, --version     output the version number
-h, --help        output usage information
```

### Example Usage (package.json)
```js
{
  "scripts": {
    "build": "do some stuff",
    "prerelease": "test some stuff",
    "release": "yarn build && release --src=build --push",
    "release:major": "yarn release - --major",
    "release:minor": "yarn release - --minor",
    "release:patch": "yarn release - --patch",
    "release:rc": "yarn release - --type=rc",
    "release:verify": "yarn release - --type=rc --verbose --test --nopublish --nocleanup"
  }
}
```

### Caveats
- This build will do a generic `yarn publish` without specific `--access=public` flag,
meaning it will default to private if it's never been published.  Solution is to publish once with that
flag set, then use `release` to maintain.
