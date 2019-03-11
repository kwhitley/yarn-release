#!/usr/bin/env node

const release = require('commander')
const pkg = require('../package.json')
const cmd = require('node-cmd')
const chalk = require('chalk')
const fs = require('fs-extra')
const Promise = require('bluebird')
const path = require('path')
const rootPath = require('app-root-path').toString()

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

release
  .version(pkg.version)
  .option('-M, --major', 'major release X.#.# for breaking changes')
  .option('-m, --minor', 'minor release #.X.# non-breaking for feature additions')
  .option('-p, --patch', 'patch release #.#.X for patch fixes/tweaks')
  .option('-s, --src <dir>', 'directory to build/release from (default=src)')
  .option('-d, --dest <dir>', 'temporary build directory (default=.dist)')
  .option('-t, --test', 'build, but do not publish')
  .option('-c, --nocleanup', 'leave build folder after publishing')
  .option('-v, --verbose', 'writes a bunch of extra stuff to the console')
  .parse(process.argv)

let releaseType =
  (release.major && 'major') ||
  (release.minor && 'minor') ||
  (release.patch && 'patch') ||
  undefined

let { src, dest, verbose, test, nocleanup } = release
let targetFolder = src || 'src'
let releaseFolder = dest || '.dist'

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
  console.log(chalk.white.bold('\nreleasing to NPM via yarn...'))
  // empty any previous distribution
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

  // clean up package.json before writing
  console.log(chalk.gray(`cleaning package.json...`))
  delete distPkg.devDependencies
  delete distPkg.scripts

  // write modified package.json
  console.log(chalk.gray(`writing package.json...`))
  verbose && explain(`target=${distFolder}/package.json`)
  await fs.writeJson(`${distFolder}/package.json`, distPkg, { spaces: 2 })
          .then(() => console.log(chalk.gray(`created ${distFolder}/package.json`)))
          .catch(console.log)

  // update version and publish
  verbose && explain(`cd ${releaseFolder}`)
  process.chdir(releaseFolder)
  console.log(chalk.gray(`updating ${chalk.white(releaseType)} version (from ${chalk.white(distPkg.version)})...`))
  await cmdAsync(`npm version ${releaseType}`)
  const { version, name } = require(`${distFolder}/package.json`)
  console.log(chalk.green(`publishing ${name} --> v${version}`))

  if (test) {
    console.log(chalk.yellow(`test complete... skipping publish`))
  } else {
    // publish
    let output = await cmdAsync(`yarn publish --new-version ${version}`).catch(logError)
    verbose && explain(output)
  }

  nocleanup !== true && await fs.remove(distFolder)

  if (hasErrors()) {
    console.log(chalk.yellow(`\n${errors.length} errors...`))
    console.log(...errors)
  } else {
    // write new version back to root package.json
    pkg.version = version

    !test && await fs.writeJson(`${rootFolder}/package.json`, pkg, { spaces: 2 })
                            .catch(console.log)

    console.log(chalk.green('\nSuccess!'))
  }
}

runRelease()

