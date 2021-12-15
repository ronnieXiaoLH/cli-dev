const axios = require('axios')
const urlJoin = require('url-join')
const semver = require('semver')

function getNpmInfo (npmName, registry) {
  if (!npmName) return
  registry = registry || getDefaultRegistry()
  const npmInfoUrl = urlJoin(registry, npmName)
  return axios.get(npmInfoUrl).then(res => {
    if (res.status === 200) {
      return res.data
    } else {
      return null
    }
  }).catch(err => Promise.reject(err))
}

function getDefaultRegistry (isOriginal = false) {
  return isOriginal ? 'https://registry.npmjs.org/' : 'https://registry.npm.taobao.org/'
}

async function getNpmVersions (npmName, registry) {
  const data = await getNpmInfo(npmName, registry)
  return data ? Object.keys(data.versions) : []
}

function getSemverVersions (baseVersion, versions) {
  return versions
    .filter(version => semver.satisfies(version, `^${baseVersion}`))
    .sort((a, b) => semver.gt(b, a))
}

async function getNpmSemverVersion (baseVersion, npmName, registry) {
  const versions = await getNpmVersions(npmName, registry)
  const newVersions = getSemverVersions(baseVersion, versions)
  if (newVersions && newVersions.length) {
    return newVersions[0]
  }
}

async function getNpmLateseVersion (npmName, registry) {
  const versions = await getNpmVersions(npmName, registry)
  return versions.sort((a, b) => semver.gt(b, a))[0]
}
 
module.exports = {
  getNpmSemverVersion,
  getDefaultRegistry,
  getNpmLateseVersion
}