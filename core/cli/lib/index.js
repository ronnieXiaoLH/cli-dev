'use strict';
const semver = require('semver')
const colors = require('colors/safe')
const userHome = require('user-home')
const pathExists = require('path-exists').sync
const path = require('path')
const log = require('@xiaolh-cli-dev/log')
const pkg = require('../package.json')
const constant = require('./const')

module.exports = core;

let args, config

function core() { 
    try {
        checkPkgVersion()
        checkNodeVersion()
        checkRoot()
        checkUserHome()
        checkInputArgs()
        checkEnv()
        // log.verbose('debug', 'test debug log')
    } catch (error) {
        console.error(error.message)
    }
}

function checkPkgVersion () {
    log.notice('cli', pkg.version)
}

function checkNodeVersion () {
    const currentVersion = process.version
    const lowestVersion = constant.LOWEST_NODE_VERSION
    if (!semver.gte(currentVersion, lowestVersion)) {
        throw new Error(colors.red(`xlh-cli 需要安装 V${lowestVersion} 以上版本的 Node.js`))
    }
}

function checkRoot () {
  const rootCheck = require('root-check');
  // 对 root 进行用户降级
  rootCheck()
}

function checkUserHome () {
  console.log(userHome)
  if (!userHome || !pathExists(userHome)) {
    throw new Error(colors.red('当前登录用户主目录不存在'))
  }
}

function checkInputArgs () {
  const minimist = require('minimist')
  args = minimist(process.argv.slice(2))
  checkArgs()
}

function checkArgs () {
  if (args.debug) {
    process.env.LOG_LEVEL = 'verbose'
  } else {
    process.env.LOG_LEVEL = 'info'
  }
  log.level = process.env.LOG_LEVEL
}

function checkEnv () {
  const dotenv = require('dotenv')
  const dotenvPath = path.resolve(userHome, '.env')
  if (pathExists(dotenvPath)) {
    config = dotenv.config({
      path: dotenvPath
    })
  }
  createDefaultCliHome()
  console.log(process.env.CLI_HOME_PATH, config)
}

function createDefaultCliHome () {
  const cliConfig = {
    home: userHome
  }
  if (process.env.CLI_HOME) {
    cliConfig['cliHome'] = path.join(userHome, process.env.CLI_HOME)
  } else {
    cliConfig['cliHome'] = path.join(userHome, constant.DEFAULT_CLI_HOME)
  }
  process.env.CLI_HOME_PATH = cliConfig.cliHome
}
