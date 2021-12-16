'use strict';
const log = require('npmlog')

log.level = process.env.LOG_LEVEL ? process.env.LOG_LEVEL : 'info'

log.heading = 'xlh-cli' // 修改前缀
// log.headingStyle = { fg: 'red' } // 修改前缀样式

log.addLevel('success', 2000, { fg: 'green' })

module.exports = log;