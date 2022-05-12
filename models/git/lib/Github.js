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

  getRepo(login, name) {
    name = 'interview'
    return this.request
      .get(`/repos/${login}/${name}`)
      .then((res) => this.handleResponse(res))
  }

  createRepo(name) {
    return this.request.post(
      '/user/repos',
      { name },
      {
        Accept: 'application/vnd.github.v3+json',
      }
    )
  }

  createOrgRepo(name, login) {
    return this.request.post(
      `/orgs/${login}/repos`,
      { name },
      {
        Accept: 'application/vnd.github.v3+json',
      }
    )
  }
}

module.exports = Github
