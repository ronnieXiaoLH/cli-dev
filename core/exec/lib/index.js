const path = require('path')
const Package = require('@xiaolh-cli-dev/package')
const log = require('@xiaolh-cli-dev/log')
const { exec: spawn } = require('@xiaolh-cli-dev/utils')
// const formatPath = require('@xiaolh-cli-dev/format-path')

const SETTINGS = {
  init: '@xiaolh-cli-dev/init',
  publish: '@xiaolh-cli-dev/publish',
}

const CACHE_DIR = 'dependencies/'

async function exec() {
  let package
  let targetPath = process.env.CLI_TARGET_PATH
  const homePath = process.env.CLI_HOME_PATH
  let storeDir
  if (!targetPath) {
    targetPath = path.resolve(homePath, CACHE_DIR)
    // 生成缓存路径
    storeDir = path.resolve(targetPath, 'node_modules')
  }
  log.verbose('targetPath', targetPath)
  log.verbose('homePath', homePath)
  log.verbose('storeDir', storeDir)

  const comObj = arguments[arguments.length - 1]
  const cmdName = comObj.name()
  const packageName = SETTINGS[cmdName]
  const packageVersion = 'latest'

  package = new Package({
    targetPath,
    storeDir,
    packageName,
    packageVersion,
  })
  if (await package.exists()) {
    // 更新 package
    console.log('更新 package')
    // 本地的包未发布到 npm 之前，更新会报 404
    // await package.update()
  } else {
    // 安装 package
    console.log('安装 package')
    await package.install()
  }
  log.verbose(package)

  let rootFile = package.getRootFilePath()
  if (process.platform === 'win32') {
    rootFile = rootFile.replace(/\\/g, '/')
  }
  if (!rootFile) return
  try {
    // 在当前进程中执行
    // require(rootFile).call(null, Array.from(arguments))
    // 在 node 子进程中执行
    const args = Array.from(arguments)
    const cmd = args[args.length - 1]
    const obj = Object.create(null)
    Object.keys(cmd).forEach((key) => {
      if (cmd.hasOwnProperty(key) && !key.startsWith('_') && key !== 'parent') {
        obj[key] = cmd[key]
      }
    })
    args[args.length - 1] = obj
    const code = `require('${rootFile}').call(null, ${JSON.stringify(args)})`
    // 使用 node 执行加载到的包的代码
    const child = spawn('node', ['-e', code], {
      cwd: process.cwd(),
      stdio: 'inherit',
    })
    child.on('error', (err) => {
      log.error(err.message)
      process.exit(1)
    })
    child.on('exit', (e) => {
      log.success('命令执行成功：', e)
      process.exit(e)
    })
  } catch (error) {
    log.error(error.message)
  }
}

module.exports = exec
