'use strict'
const semver = require('semver')
const colors = require('colors/safe')
const userHome = require('user-home')
const pathExists = require('path-exists').sync
const commander = require('commander')
const path = require('path')
const log = require('@xiaolh-cli-dev/log')
const init = require('@xiaolh-cli-dev/init')
const exec = require('@xiaolh-cli-dev/exec')
const pkg = require('../package.json')
const constant = require('./const')

module.exports = core

const program = new commander.Command()

let args, config

async function core() {
  try {
    // 脚手架启动阶段
    await prepare()
    // commnnd 初始化
    registerCommand()
  } catch (error) {
    log.error(error.message)
  }
}

async function prepare() {
  checkPkgVersion()
  checkRoot()
  checkUserHome()
  checkEnv()
  await checkGlobalUpdate()
}

// 检查包的版本号
function checkPkgVersion() {
  log.notice('cli', pkg.version)
}

// 检查用户，根用户自动降级
function checkRoot() {
  const rootCheck = require('root-check')
  // 对 root 进行用户降级
  rootCheck()
}

// 检查用户主目录
function checkUserHome() {
  if (!userHome || !pathExists(userHome)) {
    throw new Error(colors.red('当前登录用户主目录不存在'))
  }
}

// 检查环境变量
function checkEnv() {
  const dotenv = require('dotenv')
  const dotenvPath = path.resolve(userHome, '.env')
  if (pathExists(dotenvPath)) {
    config = dotenv.config({
      path: dotenvPath,
    })
  }
  createDefaultCliHome()
}

function createDefaultCliHome() {
  const cliConfig = {
    home: userHome,
  }
  if (process.env.CLI_HOME) {
    cliConfig['cliHome'] = path.join(userHome, process.env.CLI_HOME)
  } else {
    cliConfig['cliHome'] = path.join(userHome, constant.DEFAULT_CLI_HOME)
  }
  process.env.CLI_HOME_PATH = cliConfig.cliHome
}

// 检查最新版本
async function checkGlobalUpdate() {
  // 1. 获取当前版本号和模板名
  const currentVersion = pkg.version
  const npmName = pkg.name
  // 2. 调用 npm api 获取所有版本号
  const { getNpmSemverVersion } = require('@xiaolh-cli-dev/get-npm-info')
  const lastVersion = await getNpmSemverVersion(currentVersion, npmName)
  if (lastVersion && semver.gt(lastVersion, currentVersion)) {
    log.warn(
      colors.yellow(`请手动更新 ${npmName}，当前版本 ${currentVersion}，最新版本 ${lastVersion}
    更新命令: npm install -g ${npmName}`)
    )
  }
}

// 注册命令
function registerCommand() {
  program
    .name(Object.keys(pkg.bin)[0])
    .usage('<command> [options]')
    .version(pkg.version)
    .option('-d, --debug', '是否开启调试模式', false)
    .option('-tp, --targetPath <targetPath>', '是否指定本地调试文件路径', '')

  program
    .command('init [projectName]')
    .option('-f, --force', '是否强制初始化项目')
    .action(exec)

  program
    .command('publish')
    .option('--refreshServer', '是否强制更新Server')
    .option('--refreshToken', '是否强制更新远程仓库Token')
    .action(exec)

  // 开启 debug 模式
  program.on('option:debug', () => {
    const options = program.opts()
    if (options.debug) {
      process.env.LOG_LEVEL = 'verbose'
    } else {
      process.env.LOG_LEVEL = 'info'
    }
    log.level = process.env.LOG_LEVEL
  })

  // 指定 targetPath
  program.on('option:targetPath', () => {
    const options = program.opts()
    if (options.targetPath) {
      process.env.CLI_TARGET_PATH = options.targetPath
    }
  })

  // 对未知命令的监听
  program.on('command:*', (obj) => {
    console.log(colors.red('未知的命令：', obj[0]))
    const availableCommands = program.commands.map((command) => command.name)
    if (availableCommands.length) {
      console.log(colors.red('可用命令：', availableCommands.join(',')))
    }
  })

  program.parse(process.argv)

  // 未输入任何命令，输出帮助文档
  if (program.args && program.args.length < 1) {
    program.outputHelp()
  }
}
