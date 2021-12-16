const path = require('path')
const cp = require('child_process')
const Package = require('@xiaolh-cli-dev/package')
const log = require('@xiaolh-cli-dev/log')
// const formatPath = require('@xiaolh-cli-dev/format-path')

const SETTINGS = {
  init: '@xiaolh-cli-dev/init'
}

const CACHE_DIR  = 'dependencies/'

async function exec () {
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
    packageVersion
  })
  if (await package.exists()) {
    // 更新 package
    console.log('更新 package')
    // await package.update()
  } else {
    // 安装 package
    console.log('安装 package')
    await package.install()
  }
  console.log(package)

  // const rootFile = formatPath(package.getRootFilePath())
  const rootFile = package.getRootFilePath().replace(/\\/g, '/')
  if (!rootFile) return
  try {
    // 在当前进程中执行
    // require(rootFile).call(null, Array.from(arguments))
    // 在 node 子进程中执行
    const args = Array.from(arguments)
    const cmd = args[args.length - 1]
    const obj = Object.create(null)
    Object.keys(cmd).forEach(key => {
      if (cmd.hasOwnProperty(key) && !key.startsWith('_') && key !== 'parent') {
        obj[key] = cmd[key]
      }
    })
    args[args.length - 1] = obj
    const code = `require('${rootFile}').call(null, ${JSON.stringify(args)})`
    const child = spawn('node', ['-e', code], {
      cwd: process.cwd(),
      stdio: 'inherit'
    })
    child.on('error', err => {
      log.error(err.message)
      process.exit(1)
    })
    child.on('exit', e => {
      log.success('命令执行成功：', e)
      process.exit(e)
    })
  } catch (error) {
    log.error(error.message)
  }
  console.log('getRootFilePath', package.getRootFilePath())
}

function spawn (command, args, options) {
  const win32 = process.platform === 'win32'
  const cmd = win32 ? 'cmd' : command
  const cmdArgs = win32 ? ['/c'].concat(command, args) : args

  return cp.spawn(cmd, cmdArgs, options || {})
}

module.exports = exec