const path = require('path')
const fs = require('fs')
const inquirer = require('inquirer')
const fse = require('fs-extra')
const semver = require('semver')
const userHome = require('user-home')
const Command = require('@xiaolh-cli-dev/command')
const log = require('@xiaolh-cli-dev/log')
const Package = require('@xiaolh-cli-dev/package')
const { spinnerStart, sleep } = require('@xiaolh-cli-dev/utils')
const getProjectTemplate = require('./getProjectTemplate')

const TYPE_PROJECT = 'project'
const TYPE_COMPONENT = 'component'
class InitCommand extends Command {
  constructor (argv) {
    super(argv)
  }

  init() {
    this.projectName = this._argv[0] || ''
    const opts = this._argv?.[1] || {}
    this.force = opts.force
    log.verbose('projectName', this.projectName)
    log.verbose('force', this.force)
  }

  async exec () {
    try {
      // 0. 判断项目模板是否存在
      const template = await getProjectTemplate()
      if (!template || template.length === 0) {
        throw new Error('项目模板不存在')
      }
      this.template = template
      // 1. 准备阶段
      this.projectInfo = await this.prepare()
      // 2. 下载模板
      await this.downloadTemplate()
      // 3. 安装模板
    } catch (e) {
      log.error(e.message)
    }
  }

  async prepare () {
    // 1. 判断当前目录是否为空
    const localPath = process.cwd()
    if (!this.isCwdEmpty(localPath)) {
      let ifContinue = false
      if (!this.force) {
        ifContinue = (await inquirer.prompt({
          type: 'confirm',
          name: 'ifContinue',
          default: false,
          message: '当前文件夹不为空？是否继续创建项目？'
        })).ifContinue
      }
      // 用户选择不继续创建，退出
      if (!ifContinue) return
      if (ifContinue || this.force) {
        // 给用户做二次确认
        const { confirmDelete } = await inquirer.prompt({
          type: 'confirm',
          name: 'confirmDelete',
          default: false,
          message: '是否确认清空当前目录下的文件？'
        })
        if (confirmDelete) {
          // 清空当前文件夹
          fse.emptyDirSync(localPath)
        }
      }
    }
    return await this.getProjectInfo()
  }

  isCwdEmpty (localPath) {
    let fileList = fs.readdirSync(localPath)
    fileList = fileList.filter(file => {
      return !file.startsWith('.') && ['node_modules'].indexOf(file) === -1
    })
    return fileList.length === 0
  }

  async getProjectInfo () {
    let projectInfo = {}
    // 1. 选择创建的是项目或组件
    const { type } = await inquirer.prompt({
      type: 'list',
      name: 'type',
      default: TYPE_PROJECT,
      message: '请选择初始化类型',
      choices: [
        {
          name: '项目',
          value: TYPE_PROJECT
        },
        {
          name: '组件',
          value: TYPE_COMPONENT
        }
      ]
    })
    log.verbose('type', type)
    if (type === TYPE_PROJECT) {
      // 2. 获取项目的基本信息
      const project = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectName',
          message: '请输入项目名称',
          default: '',
          validate: function (v) {
            // 1. 首字符必须是英文字符
            // 2. 尾字符必须是英文字符或数字
            // 3. 字符仅允许 '-_'
            const done = this.async()
            setTimeout(() => {
              if (!/^[a-zA-Z]+([-][a-zA-z][a-zA-z0-9]*|[_][a-zA-z][a-zA-z0-9]*|[a-zA-Z0-9]*)$/.test(v)) {
                done('请输入合法的项目名称')
              } else {
                done(null, true)
              }
            }, 0)
          },
          filter: function (v) {
            return v
          }
        },
        {
          type: 'input',
          name: 'projectVersion',
          message: '请输入项目版本号',
          default: '1.0.0',
          validate: function (v) {
            const done = this.async()
            setTimeout(() => {
              if (!semver.valid(v)) {
                done('请输入合法的项目版本号')
              } else {
                done(null, true)
              }
            }, 0)
          },
          filter: function (v) {
            return semver.valid(v) || v
          }
        },
        {
          type: 'list',
          name: 'projectTemplate',
          message: '请选择项目模板',
          default: '1.0.0',
          choices: this.createTemplateChoice()
        }
      ])
      projectInfo = {
        type,
        ...project
      }
    } else if (type === TYPE_COMPONENT) {

    }
    return projectInfo
  }

  async downloadTemplate() {
    const { projectTemplate } = this.projectInfo
    const templateInfo = this.template.find(item => item.npmName === projectTemplate)
    const targetPath = path.resolve(userHome, process.env.CLI_HOME, 'template')
    const storeDir = path.resolve(targetPath, 'node_modules')
    const { npmName, version } = templateInfo
    const templateNpm = new Package({
      targetPath,
      storeDir,
      packageName: npmName,
      packageVersion: version
    })
    if (!await templateNpm.exists()) {
      const spinner = spinnerStart('正在下载模板...')
      try {
        await templateNpm.install()
        log.success('下载模板成功')
      } catch (error) {
        throw new Error(error)
      } finally {
        spinner.stop(true)
      }
    } else {
      const spinner = spinnerStart('正在更新模板...')
      try {
        await sleep()
        await templateNpm.update()
        log.success('更新模板成功')
      } catch (error) {
        throw new Error(error)
      } finally {
        spinner.stop(true)
      }
    }
  }

  createTemplateChoice () {
    return this.template.map(item => {
      return {
        name: item.name,
        value: item.npmName
      }
    })
  }
}

function init (argv) {
  console.log('init', process.env.CLI_TARGET_PATH)
  return new InitCommand(argv)
}

module.exports = init

module.exports.InitCommand = InitCommand