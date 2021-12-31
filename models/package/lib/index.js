const path = require('path')
const pkgDir = require('pkg-dir').sync
const npminstall = require('npminstall')
const fse = require('fs-extra')
const pathExists = require('path-exists').sync
const { isObject } = require('@xiaolh-cli-dev/utils')
const formatPath = require('@xiaolh-cli-dev/format-path')
const { getDefaultRegistry, getNpmLateseVersion } = require('@xiaolh-cli-dev/get-npm-info')

class Package {
  constructor (options) {
    if (!options || !isObject(options)) {
      throw new Error('Package类的options参数必须是一个对象')
    }
    // package的路径
    this.targetPath = options.targetPath
    // 缓存 package 的路径
    this.storeDir = options.storeDir
    // package的name
    this.packageName = options.packageName
    // package的version
    this.packageVersion = options.packageVersion
    // package的缓存目录的前缀
    this.cacheFilePathPrefix = this.packageName.replace('/', '_')
  }

  // 判断当前 Package 是否存在
  async exists () {
    if (this.storeDir) {
      await this.prepare()
      return pathExists(this.cacheFilePath)
    } else {
      return pathExists(this.targetPath)
    }
  }

  // 安装 Package
  async install () {
    await this.prepare()
    return npminstall({
      root: this.targetPath,
      storeDir: this.storeDir,
      registry: getDefaultRegistry(false),
      pkgs: [
        {
          name: this.packageName,
          version: this.packageVersion
        }
      ]
    })
  }

  // 更新 Package
  async update () {
    await this.prepare()
    // 1. 获取最新的 npm 模块版本号
    const latestPackageVersion = await getNpmLateseVersion(this.packageName)
    // 2. 查询最新版本号对应的路径在缓存中是否存在
    const latestFilePath = this.getRootFilePath(latestPackageVersion)
    // 3. 如果不存在，则直接安装最新版本
    if (!pathExists(latestFilePath)) {
      await npminstall({
        root: this.targetPath,
        storeDir: this.storeDir,
        registry: getDefaultRegistry(false),
        pkgs: [
          {
            name: this.packageName,
            version: latestPackageVersion
          }
        ]
      })
      // 安装了最新的版本后，要更新 packageVersion
      this.packageVersion = latestPackageVersion
    } else {
      this.packageVersion = latestPackageVersion
    }
  }

  // 获取 Package 入口文件路径
  getRootFilePath () {
    function _getFilePath (filePath) {
      // 1. 获取 package.json 所在目录
      const dir = pkgDir(filePath)
      if (dir) {
        // 2. 读取 package.json
        const pkg = require(path.resolve(dir, 'package.json'))
        // 3. 寻找 main/lib
        if (pkg && pkg.main) {
          // 4. 路径的兼容(macOS/windows)
          return formatPath(path.resolve(dir, pkg.main))
        }
      }
      return null
    }
    if (this.storeDir) {
      return _getFilePath(this.cacheFilePath)
    } else {
      return _getFilePath(this.targetPath)
    }
  }

  async prepare () {
    // 缓存路径中不存在的文件夹，全部创建(多层级)
    if (this.storeDir && !pathExists(this.storeDir)) {
      fse.mkdirpSync(this.storeDir)
    }
    if (this.packageVersion === 'latest') {
      this.packageVersion = await getNpmLateseVersion(this.packageName)
    }
  }

  get cacheFilePath () {
    return path.resolve(this.storeDir, `_${this.cacheFilePathPrefix}@${this.packageVersion}@${this.packageName}`)
  }

  getSpecificCacheFilePath (packageVersion) {
    return path.resolve(this.storeDir, `_${this.cacheFilePathPrefix}@${packageVersion}@${this.packageName}`)
  }
} 

module.exports = Package