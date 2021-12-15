const path = require('path')
const Package = require('@xiaolh-cli-dev/package')
const log = require('@xiaolh-cli-dev/log')

const SETTINGS = {
  init: '@xiaolh-cli-dev/utils'
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
    await package.update()
  } else {
    // 安装 package
    console.log('安装 package')
    await package.install()
  }
  console.log(package)

  const rootFile = package.getRootFilePath()
  rootFile && require(rootFile).apply(null, arguments)
  console.log('getRootFilePath', package.getRootFilePath())
}

module.exports = exec