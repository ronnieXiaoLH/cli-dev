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

  getRepo() {
    error('getRepo')
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

  isHttpResponse = (response) => response && Number.isInteger(response.status)

  handleResponse = (response) => {
    if (this.isHttpResponse(response) && response.status !== 200) {
      return null
    } else {
      return response
    }
  }
}

module.exports = GitServer
