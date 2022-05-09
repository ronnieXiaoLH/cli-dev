'use strict'
const path = require('path')
const SimpleGit = require('simple-git')
const userHome = require('user-home')
const fse = require('fs-extra')
const inquirer = require('inquirer')
const log = require('@xiaolh-cli-dev/log')
const { readFile, writeFile } = require('@xiaolh-cli-dev/utils')
const Github = require('./Github')
const Gitee = require('./Gitee')

const DEFAULT_CLI_HOME = '.xlh-cli'
const GIT_SERVER_FILE = '.git_server'
const GIT_TOKEN_FILE = '.git_token'
const GIT_ROOT_DIR = '.git'
const GITHUB = 'github'
const GITEE = 'gitee'
const GIT_SERVER_TYPE = [
  {
    name: 'Github',
    value: GITHUB,
  },
  {
    name: 'Gitee',
    value: GITEE,
  },
]

class Git {
  constructor(
    { name, version, dir },
    { refreshServer = false, refreshToken = false } = {}
  ) {
    this.name = name
    this.version = version
    this.dir = dir
    this.git = new SimpleGit(this.dir)
    console.log(this.git)
    this.gitServer = null
    this.homePath = null
    this.user = null
    this.orgs = null
    this.refreshServer = refreshServer
    this.refreshToken = refreshToken
  }

  init() {
    console.log('init')
  }

  async prepare() {
    this.checkHomePath() // 检查用户主目录
    await this.checkGitServer() // 检查用户远程仓库类型
    await this.checkGitToken() // 检查用户远程仓库Token
    await this.getUserAndOrgs() // 获取用户或组织信息
  }

  async checkHomePath() {
    if (!this.homePath) {
      if (process.env.CLI_HOME_PATH) {
        this.homePath = process.env.CLI_HOME_PATH
      } else {
        this.homePath = path.resolve(userHome, DEFAULT_CLI_HOME)
      }
    }
    log.verbose('homePath', this.homePath)
    fse.ensureDirSync(this.homePath)
    if (!fse.existsSync(this.homePath)) {
      throw new Error('用户主目录获取失败')
    }
  }

  async checkGitServer() {
    const gitServerPath = this.createPath(GIT_SERVER_FILE)
    let gitServer = readFile(gitServerPath)
    if (!gitServer || this.refreshServer) {
      gitServer = (
        await inquirer.prompt({
          type: 'list',
          name: 'gitServer',
          message: '请选择你要托管的 Git 平台',
          default: GITHUB,
          choices: GIT_SERVER_TYPE,
        })
      ).gitServer
      // .git_server 文件里存储的是 git 平台类型的值
      writeFile(gitServerPath, gitServer)
      log.success('git server写入成功', `${gitServer} -> ${gitServerPath}`)
    } else {
      log.success('git server获取成功', `${gitServer}`)
    }

    this.gitServer = this.createGitServer(gitServer)

    if (!this.gitServer) {
      throw new Error('初始化 gitServer 失败')
    }
  }

  createPath(file) {
    const rootDir = path.resolve(this.homePath, GIT_ROOT_DIR)
    fse.ensureDirSync(rootDir)
    const filePath = path.resolve(rootDir, file)
    return filePath
  }

  createGitServer(gitServer = '') {
    // 防止手动修改 .git_server 文件，文件内容带有换行
    const _gitServer = gitServer.trim()
    if (_gitServer === GITHUB) {
      return new Github()
    } else if (_gitServer === GITEE) {
      return new Gitee()
    }
    return null
  }

  async checkGitToken() {
    const tokenPath = this.createPath(GIT_TOKEN_FILE)
    let token = readFile(tokenPath)
    if (!token || this.refreshToken) {
      log.warn(this.gitServer.type + ' token 未生成')
      token = (
        await inquirer.prompt({
          type: 'password',
          name: 'token',
          message: '请将token复制到这里',
          default: '',
        })
      ).token
      writeFile(tokenPath, token)
      log.success('token写入成功', `${token} -> ${tokenPath}`)
      this.token = token
      this.gitServer.setToken(token)
    } else {
      log.success('token读取成功', tokenPath)
      this.token = token
      this.gitServer.setToken(token)
    }
  }

  async getUserAndOrgs() {
    this.user = await this.gitServer.getUser()
    console.log('this.user', this.user)
    if (!this.user) throw new Error('用户信息获取失败')
    this.orgs = await this.gitServer.getOrg(this.user.login)
    console.log('this.orgs', this.orgs)
    if (!this.orgs) throw new Error('组织信息获取失败')
    log.success(this.gitServer.type + ' 用户和组织信息获取成功')
  }
}

module.exports = Git
