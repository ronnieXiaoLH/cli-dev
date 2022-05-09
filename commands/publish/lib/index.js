'use strict'
const path = require('path')
const fs = require('fs')
const fse = require('fs-extra')
const Command = require('@xiaolh-cli-dev/command')
const log = require('@xiaolh-cli-dev/log')
const Git = require('../../../models/git/lib')

class PublishCommand extends Command {
  init() {
    console.log('init')
    this.opts = this._argv[0]
    console.log(this.opts)
  }

  async exec() {
    try {
      const startTime = new Date().getTime()
      // 1. 初始化检查
      this.prepare()
      // 2. Git Flow 自动化
      const git = new Git(this.projectInfo, this.opts)
      await git.prepare()
      // 3. 云构建和云发布
      const endTime = new Date().getTime()
      log.info('本次发布耗时', ((endTime - startTime) / 1000) | 0, '秒')
    } catch (e) {
      log.error(e.message)
    }
  }

  prepare() {
    // 1. 确认项目是否为 npm 项目
    const projectPath = process.cwd()
    const pkgPath = path.resolve(projectPath, 'package.json')
    log.verbose('package.json', pkgPath)
    if (!fs.existsSync(pkgPath)) {
      throw new Error('package.json不存在')
    }
    // 2. 确认时候包含 name, version, build 命令
    const pkg = fse.readJSONSync(pkgPath)
    const { name, version, scripts } = pkg
    log.verbose('package.json', name, version, scripts)
    if (!name || !version || !scripts || !scripts.build) {
      throw new Error(
        'package.json 信息不全，请检查是否存在 name、version 和 scripts (需提供 build 命令)'
      )
    }
    this.projectInfo = { name, version, dir: projectPath }
  }
}

function init(argv) {
  return new PublishCommand(argv)
}

module.exports = init

module.exports.PublishCommand = PublishCommand
