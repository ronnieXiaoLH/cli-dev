const fs = require('fs')
const inquirer = require('inquirer')
const fse = require('fs-extra')
const semver = require('semver')
const Command = require('@xiaolh-cli-dev/command')
const log = require('@xiaolh-cli-dev/log')

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
      // 1. 准备阶段
      const projectInfo = await this.prepare()
      console.log(projectInfo)
      // 2. 下载模板

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
}

function init (argv) {
  console.log('init', process.env.CLI_TARGET_PATH)
  return new InitCommand(argv)
}

module.exports = init

module.exports.InitCommand = InitCommand