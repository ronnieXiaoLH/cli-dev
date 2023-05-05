'use strict'
const path = require('path')
const fs = require('fs')
const SimpleGit = require('simple-git')
const userHome = require('user-home')
const fse = require('fs-extra')
const inquirer = require('inquirer')
const semver = require('semver')
const log = require('@xiaolh-cli-dev/log')
const { readFile, writeFile, spinnerStart } = require('@xiaolh-cli-dev/utils')
const Github = require('./Github')
const Gitee = require('./Gitee')

const DEFAULT_CLI_HOME = '.xlh-cli'
const GIT_SERVER_FILE = '.git_server'
const GIT_TOKEN_FILE = '.git_token'
const GIT_OWN_FILE = '.git_own'
const GIT_LOGIN_FILE = '.git_login'
const GIT_IGNORE_FILE = '.gitignore'
const GIT_ROOT_DIR = '.git'
const GITHUB = 'github'
const GITEE = 'gitee'
const REPO_OWNER_USER = 'user'
const REPO_OWNER_ORG = 'org'
const VERSION_RELEASE = 'release'
const VERSION_DEVELOP = 'dev'

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
const GIT_OWNER_TYPE = [
  {
    name: '个人',
    value: REPO_OWNER_USER,
  },
  {
    name: '组织',
    value: REPO_OWNER_ORG,
  },
]
const GIT_OWNER_TYPE_ONLY = [
  {
    name: '个人',
    value: REPO_OWNER_USER,
  },
]

class Git {
  constructor(
    { name, version, dir },
    { refreshServer = false, refreshToken = false, refreshOwner = false } = {}
  ) {
    this.name = name // 项目名称
    this.version = version // 项目版本
    this.dir = dir // 项目目录
    this.git = new SimpleGit(this.dir) // SimpleGit 实例
    this.gitServer = null // gitServer 实例
    this.homePath = null // 本地缓存目录
    this.user = null // 用户信息
    this.orgs = null // 用户所属组织列表
    this.owner = null // 远程仓库类型
    this.login = null // 远程仓库登录名
    this.repo = null // 远程仓库信息
    this.refreshServer = refreshServer
    this.refreshToken = refreshToken
    this.refreshOwner = refreshOwner
    this.branch = null // 本地开发分支
  }

  async prepare() {
    this.checkHomePath() // 检查用户主目录
    await this.checkGitServer() // 检查用户远程仓库类型
    await this.checkGitToken() // 检查用户远程仓库Token
    await this.getUserAndOrgs() // 获取用户或组织信息
    await this.checkGitOwner() // 检查远程仓库类型(个人|组织)
    await this.checkRepo() // 检查并创建远程仓库
    await this.checkGitignore() // 检查并创建 .gitignore 文件
    await this.init() // 本地仓库初始化
  }

  async init() {
    if (await this.getRemote()) return // git 初始化已经完成
    await this.initAndAddRemote() // 本地项目 git init 添加 git remote
    await this.initCommit()
  }

  async commit() {
    // 完成代码仓库初始化后，当前分支是处于 master 分支
    // 1. 生成开发分支
    await this.getCurrentVersion()
    // 2. 检查 stash 区
    await this.checkStatus()
    // 3. 检查代码冲突
    await this.checkConflicted()
    // 4. 切换开发分支
    await this.checkoutBranch(this.branch)
    // 5.合并远程 master 分支和开发分支代码
    await this.pullRemoteMasterAndBranch()
    // 6.将开发分支代码推送到远仓库
    await this.pushRemoteRepo(this.branch)
  }

  async checkStatus() {
    log.info('检查 stash 记录')
    const stashList = await this.git.stashList()
    if (stashList.all.length > 0) {
      await this.git.stash(['pop'])
      log.success('stash pop 成功')
    }
  }

  async getCurrentVersion() {
    // 1. 获取远程发布分支
    // 版本号规范：release/x.y.x，dev/x.y.z
    // 版本号递增规范：major/minor/patch
    log.info('获取代码分支')
    const remoteBranchList = await this.getRemoteBranchList(VERSION_RELEASE)
    let releaseVersion = null
    if (remoteBranchList.length > 0) {
      releaseVersion = remoteBranchList[0]
    }
    log.verbose('线上最新版本号：', releaseVersion)
    // 2. 生成本地开发分支
    const devVersion = this.version
    if (!releaseVersion) {
      this.branch = `${VERSION_DEVELOP}/${devVersion}`
    } else if (semver.gt(this.version, releaseVersion)) {
      log.info('本地版本大于线上最新版本', `${devVersion} >= ${releaseVersion}`)
      this.branch = `${VERSION_DEVELOP}/${devVersion}`
    } else {
      log.info('当前线上最新版本大于本地版本')
      const incType = (
        await inquirer.prompt({
          type: 'list',
          name: 'incType',
          message: '自动升级版本，请选择升级版本类型',
          choices: [
            {
              name: `小版本(${releaseVersion} -> ${semver.inc(
                releaseVersion,
                'patch'
              )})`,
              value: 'patch',
            },
            {
              name: `中版本(${releaseVersion} -> ${semver.inc(
                releaseVersion,
                'minor'
              )})`,
              value: 'minor',
            },
            {
              name: `大版本(${releaseVersion} -> ${semver.inc(
                releaseVersion,
                'major'
              )})`,
              value: 'major',
            },
          ],
        })
      ).incType
      const incVersion = semver.inc(releaseVersion, incType)
      this.branch = `${VERSION_DEVELOP}/${incVersion}`
      this.version = incVersion
    }
    log.verbose('本地开发分支', this.branch)
    // 3. 将 version 同步到 package.json
    this.syncVersionToPackageJson()
  }

  syncVersionToPackageJson() {
    const packageJsonPath = `${this.dir}/package.json`
    const pkg = fse.readJsonSync(packageJsonPath)
    if (pkg && pkg.version !== this.version) {
      pkg.version = this.version
      fse.writeJsonSync(packageJsonPath, pkg, { spaces: 2 })
    }
  }

  async getRemoteBranchList(type) {
    let remoteList = []
    try {
      remoteList = await this.git.listRemote(['--refs'])
    } catch (error) {
      log.error(error.message)
    }
    let reg
    if (type === VERSION_RELEASE) {
      reg = /.+?refs\/tags\/release\/(\d+\.\d+\.\d+)/g
    } else {
      reg = /.+?refs\/heads\/dev\/(\d+\.\d+\.\d+)/g
    }
    return remoteList
      .split('\n')
      .map((remote) => {
        const match = reg.exec(remote)
        reg.lastIndex = 0
        if (match && semver.valid(match[1])) {
          return match[1]
        }
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (semver.lte(b, a)) {
          if (a === b) return 0
          return -1
        }
        return 1
      })
  }

  async initCommit() {
    await this.checkConflicted()
    await this.checkNotCommitted()
    if (await this.checkRemoteMaster()) {
      await this.pullRemoteRepo('master', {
        '--allow-unrelated-histories': null, // 强制合并
      })
    } else {
      // 远程仓库不存在 master 分支，直接推送代码至 master 分支
      await this.pushRemoteRepo('master')
    }
  }

  async pullRemoteRepo(branchName, options) {
    log.info(`同步远程${branchName}分支代码`)
    await this.git.pull('origin', branchName, options).catch((err) => {
      log.error(err.message)
    })
  }

  async pushRemoteRepo(branchName) {
    log.info(`推送代码至${branchName}分支`)
    await this.git.push('origin', branchName)
    log.success('推送代码成功')
  }

  async checkRemoteMaster() {
    try {
      return (
        (await this.git.listRemote(['--refs'])).indexOf('refs/heads/master') !==
        -1
      )
    } catch (error) {
      return false
    }
  }

  async checkNotCommitted() {
    const status = await this.git.status()
    if (
      status.not_added.length > 0 ||
      status.created.length > 0 ||
      status.deleted.length > 0 ||
      status.modified.length > 0 ||
      status.renamed.length > 0
    ) {
      log.verbose('status', status)
      await this.git.add(status.not_added)
      await this.git.add(status.created)
      await this.git.add(status.deleted)
      await this.git.add(status.modified)
      await this.git.add(status.renamed)
      let message
      while (!message) {
        message = (
          await inquirer.prompt({
            type: 'text',
            name: 'message',
            message: '请输入 commit 信息：',
          })
        ).message
      }
      await this.git.commit(message)
      log.success('本次 commit 成功')
    }
  }

  async checkConflicted() {
    log.info('代码冲突检查')
    const status = await this.git.status()
    if (status.conflicted.length > 0) {
      throw new Error('当前代码存在冲突，请手动处理合并后再重试')
    }
  }

  async checkoutBranch(branch) {
    const localBranchList = await this.git.branchLocal()
    // 判断切换的分支是否存在，存在直接切换，不存在先创建分支再切换
    if (localBranchList.all.includes(branch)) {
      await this.git.checkout(branch)
    } else {
      await this.git.checkoutLocalBranch(branch)
    }
    log.success(`分支切换到${branch}`)
  }

  async pullRemoteMasterAndBranch() {
    log.info(`合并 【master】 -> 【${this.branch}】`)
    await this.pullRemoteRepo('master')
    log.success('合并远程 【master】 分支代码成功')
    await this.checkConflicted()
    log.info('检查远程开发分支')
    const remoteBranchList = await this.getRemoteBranchList()
    console.log(remoteBranchList)
    // if (remoteBranchList)
    if (remoteBranchList.includes(this.version)) {
      log.info(`合并 【${this.branch} -> ${this.branch}】`)
      await this.pullRemoteRepo(this.branch)
      log.success(`合并远程 【${this.branch}】 分支代码成功`)
      await this.checkConflicted()
    } else {
      log.success(`不存在远程分支 【${this.branch}】`)
    }
  }

  async getRemote() {
    const gitPath = path.resolve(this.dir, GIT_ROOT_DIR)
    this.remote = this.gitServer.getRemote(this.login, this.name)
    if (fs.existsSync(gitPath)) {
      log.success('git 初始化已经完成')
      return true
    }
  }

  async initAndAddRemote() {
    log.info('执行 git 初始化')
    await this.git.init(this.dir)
    log.info('添加 git remote')
    const remotes = await this.git.getRemotes() // 拿到项目的所有 remotes
    log.verbose('git remotes', remotes)
    if (!remotes.find((item) => item.name === 'origin')) {
      await this.git.addRemote('origin', this.remote)
    }
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
    log.verbose('this.user', this.user)
    if (!this.user) throw new Error('用户信息获取失败')
    this.orgs = await this.gitServer.getOrg(this.user.login)
    log.verbose('this.orgs', this.orgs)
    if (!this.orgs) throw new Error('组织信息获取失败')
    log.success(this.gitServer.type + ' 用户和组织信息获取成功')
  }

  async checkGitOwner() {
    const ownerPath = this.createPath(GIT_OWN_FILE)
    const loginPath = this.createPath(GIT_LOGIN_FILE)
    let owner = readFile(ownerPath)
    let login = readFile(loginPath)
    if (!owner || !loginPath || this.refreshOwner) {
      owner = (
        await inquirer.prompt({
          type: 'list',
          name: 'owner',
          message: '请选择远程仓库类型',
          default: REPO_OWNER_USER,
          choices: this.orgs.length > 0 ? GIT_OWNER_TYPE : GIT_OWNER_TYPE_ONLY,
        })
      ).owner
      if (owner === REPO_OWNER_USER) {
        login = this.user.login
      } else {
        // 如果是组织，需要用户选择哪个组织
        login = (
          await inquirer.prompt({
            type: 'list',
            name: 'login',
            message: '请选择',
            choices: this.orgs.map((item) => ({
              name: item.login,
              value: item.login,
            })),
          })
        ).login
      }
      writeFile(ownerPath, owner)
      writeFile(loginPath, login)
      log.success('owner写入成功', `${owner} -> ${ownerPath}`)
      log.success('login写入成功', `${login} -> ${loginPath}`)
      this.owner = owner
      this.login = login
    } else {
      log.success('owner读取成功', owner)
      log.success('login读取成功', login)
      this.owner = owner
      this.login = login
    }
  }

  async checkRepo() {
    let repo = await this.gitServer.getRepo(this.login, this.name)
    if (!repo) {
      let spinner = spinnerStart('开始创建远程仓库...')
      try {
        if (this.owner === REPO_OWNER_USER) {
          repo = this.gitServer.createRepo(this.name)
        } else {
          repo = this.gitServer.createOrgRepo(this.name, this.login)
        }
      } catch (error) {
        log.error(error)
      } finally {
        spinner.stop(true)
      }
      if (repo) {
        log.success('远程仓库创建成功')
      } else {
        throw new Error('远程仓库创建失败')
      }
    } else {
      log.success('远程仓库信息获取成功')
      this.repo = repo
    }
    log.verbose('repo', repo)
  }

  // .gitignore 文件是防止将一些无需提交的文件提交到远程仓库
  async checkGitignore() {
    const gitignorePath = path.resolve(this.dir, GIT_IGNORE_FILE)
    const gitignore = readFile(gitignorePath)
    if (!gitignore) {
      writeFile(
        gitignorePath,
        `.DS_Store
node_modules
/dist

# local env files
.env.loval
.env.*.local

# log files
npm-debug.log*
yarn-debug.log*
yarn-eroro.log*
cnpm-debug.log*

# editor directives and files
.idea
.vscode
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
      `
      )
      log.success(`自动写入 ${GIT_IGNORE_FILE} 文件成功`)
    }
  }
}

module.exports = Git
