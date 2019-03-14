#!/usr/bin/env node

const release = require('commander')
const cmd = require('node-cmd')
const chalk = require('chalk')
const fs = require('fs-extra')
const Promise = require('bluebird')
const path = require('path')
const rootPath = require('app-root-path').toString()
const pkg = require(`${rootPath}/package.json`)

const cmdAsync = Promise.promisify(cmd.get, { multiArgs: true, context: cmd })
const distPkg = JSON.parse(JSON.stringify(pkg))
const errors = []

const logError = (err) => err && errors.push(err)
const ignore = () => {}
const hasErrors = () => errors.length > 0
const explain = (...args) => {
  let style = chalk.magenta
  args = args.map((a, i) => args.length > 1 && i === 0 ? style.bold(`[${a}]`) : style(a))
  console.log(...args)
}

const versionBump = (v) => (type = 'patch') => {
  let order = ['major', 'minor', 'patch']
  let parts = v.split('.')
  let base = Array(3).fill(0).map((v, i) => Number(parts[i] || v))
  let target = order.indexOf(type)
  let updated = base.map((v, i) => {
    if (i < target) return v
    if (i === target) return ++v
    return 0
  })

  return updated.join('.')
}

release
  .version(pkg.version)
  .option('-M, --major', 'major release X.#.# for breaking changes')
  .option('-m, --minor', 'minor release #.X.# non-breaking for feature additions')
  .option('-p, --patch', 'patch release #.#.X for patch fixes/tweaks')
  .option('-s, --src <dir>', 'directory to build/release from (default=root)')
  .option('-d, --dest <dir>', 'temporary build directory (default=.dist)')
  .option('-t, --test', 'build, but do not publish')
  .option('-c, --nocleanup', 'leave build folder after publishing')
  .option('-v, --verbose', 'writes a bunch of extra stuff to the console')
  .option('--public', 'equivalent to npm publish --access=public')
  .option('--commit', 'adds unstaged changes (including package.json update) to git and commits')
  .option('--push', 'includes --commit, while also doing a "git push" (assumes ref has been set up)')
  .parse(process.argv)

let releaseType =
  (release.major && 'major') ||
  (release.minor && 'minor') ||
  (release.patch && 'patch') ||
  undefined

let {
  src,
  dest,
  verbose,
  test,
  nocleanup,
  public,
  commit,
  push,
} = release
let targetFolder = src || ''
let releaseFolder = dest || '.dist'
let releasingFromRoot = targetFolder === ''

// return --help if no release style specified
if (!releaseType) return release.outputHelp()

const rootFolder = path.join(rootPath)
const sourceFolder = path.join(rootPath, targetFolder)
const distFolder = path.join(rootPath, releaseFolder)

if (verbose) {
  explain('root', rootFolder)
  explain('src', sourceFolder)
  explain('dest', distFolder)
}

async function runRelease() {
  let ver = pkg.version
  let { name, version } = pkg
  let newVersion = versionBump(version)(releaseType)
  pkg.version = newVersion

  console.log(chalk.white.bold(`\nreleasing ${name} to NPM via yarn...`))
  console.log(chalk.gray(`updating ${chalk.white(releaseType)} version (from ${chalk.white(version)} to ${chalk.white(newVersion)}) ...`))
  // empty any previous distribution

  if (!releasingFromRoot) {
    console.log(chalk.gray(`emptying ${releaseFolder}...`))
    await fs.emptyDir(distFolder).catch(logError)

    // ensure release directory exists
    console.log(chalk.gray(`ensuring ${releaseFolder} exists...`))
    !hasErrors() && await fs.ensureDir(distFolder).catch(logError)

    // copy client to dist folder
    console.log(chalk.gray(`copying ${targetFolder} to ${releaseFolder}...`))
    const filter = (src) => !src.includes('/node_modules')
    !hasErrors() && await fs.copy(sourceFolder, distFolder, { filter }).catch(logError)

    // copy .npmrc to dist folder
    console.log(chalk.gray(`copying .npmrc (if exists)...`))
    !hasErrors() && await fs.copy(`${rootFolder}/.npmrc`, `${distFolder}/.npmrc`).catch(ignore)

    // copy .npmrc to dist folder
    console.log(chalk.gray(`copying README.md (if exists)...`))
    !hasErrors() && await fs.copy(`${rootFolder}/README.md`, `${distFolder}/README.md`).catch(ignore)

    // update version and publish
    verbose && explain(`cd ${releaseFolder}`)
    process.chdir(releaseFolder)
  }

  if (test) {
    console.log(chalk.white(`publishing ${name} --> v${newVersion}`))
    console.log(chalk.yellow(`test complete... skipping publish`))
  } else {
    console.log(chalk.gray(`updating version in ${releasingFromRoot ? rootFolder : releaseFolder}/package.json`))
    await fs.writeJson(`${releasingFromRoot ? rootFolder : distFolder}/package.json`, pkg, { spaces: 2 })
            .catch(console.log)

    console.log(chalk.white(`publishing ${name} --> v${newVersion}`))
    let output = await cmdAsync(`yarn publish --new-version ${newVersion}` + (public ? ' --access=public' : '')).catch(logError)
    verbose && explain(output)
  }

  nocleanup !== true && await fs.remove(distFolder)

  if (commit || push) {
    process.chdir(rootFolder)
    console.log(chalk.gray(`commiting changes...`))
    await cmdAsync('git add .')
    await cmdAsync(`git commit -m 'released v${newVersion}'`).catch(logError)
  }

  if (push) {
    console.log(chalk.gray(`pushing to GitHub..`))
    await cmdAsync('git push').catch(logError)
  }

  if (hasErrors()) {
    console.log(chalk.yellow(`\n${errors.length} errors...`))
    console.log(...errors)
  } else {
    // write new version back to root package.json

    !test && !releasingFromRoot && await fs.writeJson(`${rootFolder}/package.json`, pkg, { spaces: 2 })
                                            .then(console.log(chalk.gray('updated root package.json')))
                                            .catch(console.log)

    console.log(chalk.green('Success!'))
  }
}

runRelease()

