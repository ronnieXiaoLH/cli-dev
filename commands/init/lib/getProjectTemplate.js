const request = require('@xiaolh-cli-dev/request')

module.exports = function () {
  return request.get('/project/template')
}