const GithubRequest = require('./GithubRequest')
const GitServer = require('./GitServer')

class Github extends GitServer {
  constructor() {
    super('github')
    this.request = null
  }

  setToken(token) {
    super.setToken(token)
    this.request = new GithubRequest(token)
  }

  getUser() {
    return this.request.get('/user')
  }

  getOrg() {
    return this.request.get(`/user/orgs`, {
      page: 1,
      per_page: 100,
    })
  }
}

module.exports = Github
