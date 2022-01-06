const path = require('path')
const fs = require('fs')
const inquirer = require('inquirer')
const fse = require('fs-extra')
const semver = require('semver')
const userHome = require('user-home')
const glob = require('glob')
const ejs = require('ejs')
const Command = require('@xiaolh-cli-dev/command')
const log = require('@xiaolh-cli-dev/log')
const Package = require('@xiaolh-cli-dev/package')
const { spinnerStart, sleep, execAsync } = require('@xiaolh-cli-dev/utils')
const getProjectTemplate = require('./getProjectTemplate')

const TYPE_PROJECT = 'project'
const TYPE_COMPONENT = 'component'

const TYPE_TEMPLATE_NORMAL = 'normal'
const TYPE_TEMPLATE_CUSTOM = 'custom'

const WHITE_COMMANDS = ['npm', 'cnpm']
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
      console.log('this.projectInfo', this.projectInfo)
      // 2. 下载模板
      await this.downloadTemplate()
      // 3. 安装模板
      await this.installTemplate()
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
        // 用户选择不继续创建，退出
        if (!ifContinue) return
      }
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
    function isValidName (v) {
      return /^[a-zA-Z]+([-][a-zA-z][a-zA-z0-9]*|[_][a-zA-z][a-zA-z0-9]*|[a-zA-Z0-9]*)$/.test(v)
    }
    let isProjectNameValid = false
    let projectInfo = {}
    if (isValidName(this.projectName)) {
      isProjectNameValid = true
      projectInfo.projectName = this.projectName
    }
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
    this.template = this.template.filter(item => item.tag.includes(type))
    const title = type === TYPE_PROJECT ? '项目' : '组件'
    let projectPrompt = [
      {
        type: 'input',
        name: 'projectVersion',
        message: `请输入${title}版本号`,
        default: '1.0.0',
        validate: function (v) {
          const done = this.async()
          setTimeout(() => {
            if (!semver.valid(v)) {
              done(`请输入合法的${title}版本号`)
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
        message: `请选择${title}模板`,
        default: '',
        choices: this.createTemplateChoice()
      },
    ]
    const projectNamePrompt = {
      type: 'input',
      name: 'projectName',
      message: `请输入${title}名称`,
      default: '',
      validate: function (v) {
        // 1. 首字符必须是英文字符
        // 2. 尾字符必须是英文字符或数字
        // 3. 字符仅允许 '-_'
        const done = this.async()
        setTimeout(() => {
          if (!isValidName(v)) {
            done(`请输入合法的${title}名称`)
          } else {
            done(null, true)
          }
        }, 0)
      },
      filter: function (v) {
        return v
      }
    }
    if (!isProjectNameValid) {
      projectPrompt.unshift(projectNamePrompt)
    }
    if (type === TYPE_PROJECT) {
      // 2. 获取项目的基本信息
      const project = await inquirer.prompt(projectPrompt)
      projectInfo = {
        ...projectInfo,
        type,
        ...project
      }
    } else if (type === TYPE_COMPONENT) {
      const descriptionPrompt = {
        type: 'input',
        name: 'componentDescription',
        message: '请输入组件描述信息',
        default: '',
        validate: function (v) {
          const done = this.async()
          setTimeout(() => {
            if (!v) {
              done('请输入合法的组件描述信息')
            } else {
              done(null, true)
            }
          }, 0)
        },
      }
      projectPrompt.push(descriptionPrompt)
      const component = await inquirer.prompt(projectPrompt)
      projectInfo = {
        ...projectInfo,
        type,
        ...component
      }
    }

    // 生成 className 将用户输入的驼峰命名转化为 - 
    if (projectInfo.projectName) {
      projectInfo.name = projectInfo.projectName
      projectInfo.className = require('kebab-case')(projectInfo.projectName).replace(/^-/, '')
    }
    if (projectInfo.projectVersion) {
      projectInfo.version = projectInfo.projectVersion
    }
    if (projectInfo.componentDescription) {
      projectInfo.description = projectInfo.componentDescription
    }
    return projectInfo
  }

  async downloadTemplate() {
    const { projectTemplate } = this.projectInfo
    const templateInfo = this.template.find(item => item.npmName === projectTemplate)
    if (!templateInfo) {
      throw new Error('项目模板不存在')
    }
    const targetPath = path.resolve(userHome, process.env.CLI_HOME, 'template')
    const storeDir = path.resolve(targetPath, 'node_modules')
    const { npmName, version } = templateInfo
    this.templateInfo = templateInfo

    const templateNpm = new Package({
      targetPath,
      storeDir,
      packageName: npmName,
      packageVersion: version
    })
    this.templateNpm = templateNpm
    
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

  async installTemplate () {
    if (this.templateInfo) {
      if (!this.templateInfo.type) {
        this.templateInfo.type = TYPE_TEMPLATE_NORMAL
      }
      if (this.templateInfo.type === TYPE_TEMPLATE_NORMAL) {
        // 标准安装
        await this.installNormalTemplate()
      } else if (this.templateInfo.type === TYPE_TEMPLATE_CUSTOM) {
        // 自定义安装
        await this.installCustomTemplate()
      } else {
        throw new Error('项目模板类型无法识别')
      }
    } else {
      throw new Error('项目模板不存在')
    }
  }

  async installNormalTemplate() {
    // 拷贝下载下来的模板代码至当前目录
    const spinner = spinnerStart('正在安装模板...')
    const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template')
    const targetPath = process.cwd()
    try {
      fse.ensureDirSync(templatePath)
      fse.ensureDirSync(targetPath)
      fse.copySync(templatePath, targetPath)
    } catch (error) {
      throw error
    } finally {
      spinner.stop(true)
      log.success('安装成功')
    }
    // ejs 动态装换
    const templateIgnore = this.templateInfo.ignore || []
    const ignore = ['node_modules/**', ...templateIgnore]
    await this.ejsRender({ignore})
    // 安装依赖
    const { installCommand, startCommand } = this.templateInfo
    if (installCommand) {
      await this.execCommand(installCommand, '依赖安装失败')
    }
    // 启动项目
    if (startCommand) {
      await this.execCommand(startCommand, '项目启动失败')
    }
  }
  
  async installCustomTemplate () {
    // 查询自定义模板的入口文件
    if (!await this.templateNpm.exists()) {
      const rootFile = this.templateNpm.getRootFilePath()
      console.log('templateNpm', this.templateNpm)
      console.log('rootFile', rootFile)
      if (fs.existsSync(rootFile)) {
        log.notice('开始执行自定义模板')
        const templatePath = path.resolve(this.templateNpm.cacheFilePath, 'template')
        const options = {
          ...this.templateInfo,
          sourcePath: templatePath,
          targetPath: process.cwd()
        }
        const code = `require('${rootFile}')(${JSON.stringify(options)})`
        await execAsync('node', ['e', code], {
          stdio: 'inherit',
          cwd: process.cwd
        })
        log.success('自定义模板安装成功')
      }
    } else {
      console.log('else')
    }
  }

  async ejsRender (options) {
    const projectInfo = this.projectInfo
    console.log(projectInfo)
    // 通过 ejs 转换 template 中的 ejs 语法
    return new Promise((resolve, reject) => {
      const dir = process.cwd()
      glob('**', {
        cwd: dir,
        ignore: options.ignore || '',
        nodir: true
      }, async (err, files) => {
        if (err) {
          reject(err)
        }
        const res = await Promise.all(files.map(file => {
          const filePath = path.join(dir, file)
          return new Promise((resolve1, reject1) => {
            ejs.renderFile(filePath, projectInfo, {}, (err, result) => {
              if (err) {
                reject1(err)
              } else {
                // 根据 ejs 渲染后的结果更新原文件
                fse.writeFileSync(filePath, result)
                resolve1(result)
              }
            })
          })
        }))
        resolve(res)
      })
    })
  }

  checkCommand (cmd) {
    if (WHITE_COMMANDS.includes(cmd)) {
      return cmd
    }
    return null
  }

  async execCommand (command, errMsg) {
    const cmdArray = command.split(' ')
    // 命令检测，避免用户执行一些危险命令
    const cmd = this.checkCommand(cmdArray[0])
    const args = cmdArray.slice(1)
    const ret = await execAsync(cmd, args, {
      stdio: 'inherit',
      cwd: process.cwd()
    })
    if (ret !== 0 && errMsg) {
      throw new Error(errMsg)
    }
  }
}


function init (argv) {
  console.log('init', process.env.CLI_TARGET_PATH)
  return new InitCommand(argv)
}

module.exports = init

module.exports.InitCommand = InitCommand