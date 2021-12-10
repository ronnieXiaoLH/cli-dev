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

async function core() { 
    try {
        checkPkgVersion()
        checkNodeVersion()
        checkRoot()
        checkUserHome()
        checkInputArgs()
        checkEnv()
        await checkGlobalUpdate()
    } catch (error) {
        console.error(error.message)
    }
}

// 检查包的版本号
function checkPkgVersion () {
    log.notice('cli', pkg.version)
}

// 检查 Node 的版本，最低版本的限制
function checkNodeVersion () {
    const currentVersion = process.version
    const lowestVersion = constant.LOWEST_NODE_VERSION
    if (!semver.gte(currentVersion, lowestVersion)) {
        throw new Error(colors.red(`xlh-cli 需要安装 V${lowestVersion} 以上版本的 Node.js`))
    }
}

// 检查用户，根用户自动降级
function checkRoot () {
  const rootCheck = require('root-check');
  // 对 root 进行用户降级
  rootCheck()
}

// 检查用户主目录
function checkUserHome () {
  if (!userHome || !pathExists(userHome)) {
    throw new Error(colors.red('当前登录用户主目录不存在'))
  }
}

// 检查用户输入参数
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

// 检查环境变量
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

// 检查最新版本
async function checkGlobalUpdate () {
  // 1. 获取当前版本号和模板名
  const currentVersion = pkg.version
  const npmName = pkg.name
  // 2. 调用 npm api 获取所有版本号
  const { getNpmSemverVersion } = require('@xiaolh-cli-dev/get-npm-info')
  const lastVersion = await getNpmSemverVersion(currentVersion, npmName)
  if (lastVersion && semver.gt(lastVersion, currentVersion)) {
    log.warn(colors.yellow(`请手动更新 ${npmName}，当前版本 ${currentVersion}，最新版本 ${lastVersion}
    更新命令: npm install -g ${npmName}`))
  }
}