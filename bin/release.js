#!/usr/bin/env node

const release = require('commander')
const pkg = require('../package.json')
const cmd = require('node-cmd')
const chalk = require('chalk')
const rimraf = require('rimraf')
const fs = require('fs-extra')
const Promise = require('bluebird')
const path = require('path')

const cmdAsync = Promise.promisify(cmd.get, { multiArgs: true, context: cmd })
const distPkg = JSON.parse(JSON.stringify(pkg))
const errors = []

const logError = (err) => err && errors.push(err.message)
const hasErrors = () => errors.length > 0

release
  .version(pkg.version)
  .option('-M, --major', 'major release X.#.# for breaking changes')
  .option('-m, --minor', 'minor release #.X.# non-breaking for feature additions')
  .option('-p, --patch', 'patch release #.#.X for patch fixes/tweaks')
  .option('-s, --src <dir>', 'directory to build/release from (default=./src)')
  .option('-t, --temp <dir>', 'temporary build directory (default=./.dist)')
  .option('-d, --dry', 'build, but do not publish')
  .option('-c, --nocleanup', 'leave build folder after publishing')
  .parse(process.argv)

let releaseType =
  (release.major && 'major') ||
  (release.minor && 'minor') ||
  (release.patch && 'patch') ||
  undefined

let targetFolder = release.src || 'src/client'
let releaseFolder = release.temp || '.dist'

// return --help if no release style specified
if (!releaseType) return release.outputHelp()

const rootFolder = path.join(__dirname, '..')
const sourceFolder = path.join(__dirname, '../' + targetFolder)
const distFolder = path.join(__dirname, '../', releaseFolder)

async function runRelease() {
  console.log(chalk.white.bold('\nreleasing to NPM via yarn...'))
  // empty any previous distribution
  console.log(chalk.gray(`emptying ${releaseFolder}...`))
  await fs.emptyDir(distFolder).catch(logError)

  // ensure release directory exists
  console.log(chalk.gray(`ensuring ${releaseFolder} exists...`))
  await fs.ensureDir(distFolder)

  // copy client to dist folder
  console.log(chalk.gray(`copying ${targetFolder} to ${releaseFolder}...`))
  !hasErrors() && await fs.copy(sourceFolder, distFolder).catch(logError)

  // copy .npmrc to dist folder
  console.log(chalk.gray(`copying .npmrc...`))
  !hasErrors() && await fs.copy(`${rootFolder}/.npmrc`, `${distFolder}/.npmrc`).catch(logError)

  // clean up package.json before writing
  console.log(chalk.gray(`cleaning package.json...`))
  delete distPkg.devDependencies
  delete distPkg.scripts

  // write modified package.json
  console.log(chalk.gray(`writing package.json...`))
  await fs.writeJson(`${distFolder}/package.json`, distPkg, { spaces: 2 })
          .then(() => console.log(chalk.gray(`created ${distFolder}/package.json`)))
          .catch(console.log)

  // update version and publish
  process.chdir(releaseFolder)
  console.log(chalk.gray(`updating ${chalk.white(releaseType)} version (from ${chalk.white(distPkg.version)})...`))
  await cmdAsync(`npm version ${releaseType}`)
  const { version, name } = require(`${distFolder}/package.json`)
  console.log(chalk.green(`publishing ${name} --> v${version}`))

  if (release.dry) {
    console.log(chalk.yellow(`dry-run complete... skipping publish`))
  } else {
    // publish
    await cmdAsync(`yarn publish --new-version ${version}`).catch(logError)
  }

  release.nocleanup !== true && await fs.remove(distFolder)

  if (hasErrors()) {
    console.log(chalk.yellow(`\n${errors.length} errors...`))
    console.log(...errors)
  } else {
    // write new version back to root package.json
    pkg.version = version

    !release.dry && await fs.writeJson(`${rootFolder}/package.json`, pkg, { spaces: 2 })
                            .catch(console.log)

    console.log(chalk.green('\nSuccess!'))
  }
}

runRelease()

