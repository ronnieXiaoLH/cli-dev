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

  getRepo(login, name) {
    return this.request
      .get(`/repos/${login}/${name}`)
      .then((res) => this.handleResponse(res))
  }

  createRepo(name) {
    return this.request.post('/user/repos', { name })
  }

  createOrgRepo(name, login) {
    return this.request.post(`/orgs/${login}/repos`, { name })
  }
}

module.exports = Gitee
