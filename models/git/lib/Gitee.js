const GiteeRequest = require('./GiteeRequest')
const GitServer = require('./GitServer')

class Gitee extends GitServer {
  constructor() {
    super('gitee')
    this.request = null
  }

  setToken(token) {
    super.setToken(token)
    this.request = new GiteeRequest(token)
  }

  getUser() {
    return this.request.get('/user')
  }

  getOrg(username) {
    return this.request.get(`/users/${username}/orgs`, {
      page: 1,
      per_page: 100,
    })
  }
}

module.exports = Gitee
