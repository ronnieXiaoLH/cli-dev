function error(methodName) {
  throw new Error(`${methodName} must be implemented`)
}

class GitServer {
  constructor(type) {
    this.type = type
  }

  setToken(token) {
    this.setToken = token
  }

  createRepo() {
    error('createRepo')
  }

  createOrgRepo() {
    error('createOrgRepo')
  }

  getRemote() {
    error('getRemote')
  }

  getUser() {
    error('getUser')
  }

  getOrg() {
    error('getOrg')
  }
}

module.exports = GitServer
