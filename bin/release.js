#!/usr/bin/env node

const release = require('commander')
const cmd = require('node-cmd')
const chalk = require('chalk')
const fs = require('fs-extra')
const Promise = require('bluebird')
const path = require('path')
const rootPath = path.resolve()
const pkg = require(`${rootPath}/package.json`)
const inquirer = require('inquirer')

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
  let order = ['major', 'minor', 'patch', 'partial-type', 'partial-version']
  let isPartial = !order.includes(type)
  let parts = v.split(/\.|-/)
  let partialType = parts[3]
  let base = Array(5).fill(0).map((v, i) => Number(parts[i] || v))
  let target = order.indexOf(isPartial ? 'partial-version' : type)
  let partialIndex = order.indexOf('partial-version')
  let updated = base.map((v, i) => {
    if (i < target) return v
    if (isPartial && type !== partialType && i === partialIndex) return 0
    if (i === target) return ++v
    return 0
  })

  if (isPartial) {
    updated[order.indexOf('partial-type')] = `-${type}`
  } else {
    updated = updated.slice(0, 3)
  }

  return updated.join('.').replace(/\.-/gi, '-')
}

release
  .version(pkg.version)
  .option('--type <major|minor|patch|alpha|beta|rc|etc>', 'define the type of the release, e.g. --type=alpha')
  .option('--major', 'major release X.#.# for breaking changes, shorthand for --type=major')
  .option('--minor', 'minor release #.X.# non-breaking for feature additions, shorthand for --type=minor')
  .option('--patch', 'patch release #.#.X for patch fixes/tweaks, shorthand for --type=patch')
  .option('--src <dir>', 'directory to build/release from (default=root)')
  .option('--dest <dir>', 'temporary build directory (default=.dist)')
  .option('--test', 'build, but do not publish')
  .option('--nocleanup', 'leave build folder after publishing')
  .option('--public', 'equivalent to npm publish --access=public')
  .option('--commit', 'adds unstaged changes (including package.json update) to git and commits')
  .option('--tag', 'tag the release to git')
  .option('--push', 'includes --commit, while also doing a "git push" (assumes ref has been set up)')
  .option('--nopublish', 'do not publish new version to NPM')
  .option('-v, --verbose', 'writes a bunch of extra stuff to the console')
  .option('-s, --silent', 'asks no questions')
  .parse(process.argv)

let releaseType =
  (release.opts().major && 'major') ||
  (release.opts().minor && 'minor') ||
  (release.opts().patch && 'patch') ||
  (release.opts().type) ||
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
  tag,
  silent,
  nopublish,
  type,
} = release.opts()
let targetFolder = src || ''
let releaseFolder = dest || '.dist'
let releasingFromRoot = targetFolder === ''

// return --help if no release style specified
if (!releaseType) {
  console.log(chalk.magentaBright('No release type found. Please specify a release type by using one of the following flags:'))
  console.log(chalk.magenta('--major\n--minor\n--patch\n--type=major|minor|patch|alpha|rc|etc\n'))
  return release.outputHelp()
}

const rootFolder = path.join(rootPath)
const sourceFolder = path.join(rootPath, targetFolder)
const distFolder = path.join(rootPath, releaseFolder)

if (verbose) {
  explain('releaseType', releaseType)
  explain('type', type)
  explain('root', rootFolder)
  explain('src', src)
  explain('sourceFolder', sourceFolder)
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

  console.log(chalk.gray(`updating version in ${releasingFromRoot ? rootFolder : releaseFolder}/package.json`))
  !test && await fs.writeJson(`${releasingFromRoot ? rootFolder : distFolder}/package.json`, pkg, { spaces: 2 })
                  .catch(console.log)

  console.log(chalk.white(`publishing ${name} --> v${newVersion}`))
  let optionalTagName = ['major', 'minor', 'patch'].includes(releaseType) ? '' : `--tag ${releaseType}`
  let publishCommand = `yarn publish --new-version ${newVersion} ${optionalTagName}` + (public ? ' --access=public' : '')

  if (!test && !nopublish) {
    let output = await cmdAsync(publishCommand).catch(logError)
    verbose && explain(output)
  } else {
    verbose && explain('publish command', publishCommand)
    console.log(chalk.yellow('skipping publish.'))
  }

  !nocleanup && await fs.remove(distFolder)

  !test && !releasingFromRoot && await fs.writeJson(`${rootFolder}/package.json`, pkg, { spaces: 2 })
                                            .then(console.log(chalk.gray('updated root package.json')))
                                            .catch(logError)

  let commitMessage = `released v${newVersion}`

  if (commit || push) {
    process.chdir(rootFolder)
    console.log(chalk.gray(`commiting changes...`))
    await cmdAsync('git add .')

    if (!silent) {
      let { message } = await inquirer.prompt([
        {
          name: 'message',
          message: 'Enter a commit message (optional)',
        }
      ])

      if (message) {
        message = message
                    .replace(/^['"]+|['"]+$/g, '')  // strip leading/trailing quotes
                    .trim()                         // strip any surrounding whitespace
                    .replace(/"/g, '\'')            // strip interior double quotes to prevent escaping
        commitMessage += ` - ${message}`
      }
    }

    test && console.log(chalk.gray(`git commit -m "${commitMessage}"`))
    !test && await cmdAsync(`git commit -m "${commitMessage}"`).catch(logError)
  }

  if (push) {
    console.log(chalk.gray(`pushing to GitHub..`))
    !test && await cmdAsync('git push').catch(logError)
  }

  if (tag) {
    console.log(chalk.gray(`pushing tagged release to GitHub..`))
    let command = `git tag -a v${newVersion} -m "${commitMessage}"`
    !test && await cmdAsync(command).catch(logError)
    !test && await cmdAsync('git push --tags').catch(logError)
  }

  if (hasErrors()) {
    console.log(chalk.yellow(`\n${errors.length} errors...`))
    console.log(...errors)
  } else {
    console.log(chalk.green('Success!'))
  }
}

runRelease()

