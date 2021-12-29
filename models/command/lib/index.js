const semver = require('semver')
const colors = require('colors/safe')
const log = require('@xiaolh-cli-dev/log')

const LOWEST_NODE_VERSION = '12.0.0'

class Command {
  constructor (argv) {
    // console.log('command', argv)
    if (!argv) {
      throw new Error('参数不能为空')
    }
    if (!Array.isArray(argv)) {
      throw new Error('参数必须为数组')
    }
    this._argv = argv
    let runner = new Promise((resolve, reject) => {
      let chain = Promise.resolve()
      chain = chain.then(() => this.checkNodeVersion())
      chain = chain.then(() => this.initArgs())
      chain = chain.then(() => this.init())
      chain = chain.then(() => this.exec())
      chain.catch(err => log.error(err.message))
    })
  }

  init () {
    throw new Error('init 必须实现')
  }

  exec () {
    throw new Error('exec 必须实现')
  }

  // 检查 Node 的版本，最低版本的限制
  checkNodeVersion () {
    const currentVersion = process.version
    const lowestVersion = LOWEST_NODE_VERSION
    if (!semver.gte(currentVersion, lowestVersion)) {
        throw new Error(colors.red(`xlh-cli 需要安装 V${lowestVersion} 以上版本的 Node.js`))
    }
  }

  initArgs () {
    const len = this._argv.length
    this._cmd = this._argv[len - 1]
  }
}

module.exports = Command