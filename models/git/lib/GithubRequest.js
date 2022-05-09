const axios = require('axios')
const BASE_URL = 'https://api.github.com/'

class GithubRequest {
  constructor(token) {
    this.token = token
    this.service = axios.create({
      baseURL: BASE_URL,
      timeout: 5000,
    })
    this.service.interceptors.request.use(
      (config) => {
        config.headers.Authorization = `token ${this.token}`
        return config
      },
      (error) => Promise.reject(error)
    )
    this.service.interceptors.response.use(
      (response) => response.data,
      (error) => {
        if (error.reponse && error.reponse.data) {
          return error.reponse.data
        } else {
          Promise.reject(error)
        }
      }
    )
  }

  get(url, params, headers) {
    return this.service.get(
      url,
      {
        params,
      },
      headers
    )
  }
}

module.exports = GithubRequest
