const Command = require('@xiaolh-cli-dev/command')
const log = require('@xiaolh-cli-dev/log')

class InitCommand extends Command {
  constructor (argv) {
    super(argv)
  }

  init() {
    this.projectName = this._argv[0] || ''
    const opts = this._argv?.[1] || {}
    this.force = opts.force
    log.verbose('projectName', this.projectName)
    log.verbose('force', this.force)
  }

  exec () {}
}

function init (argv) {
  console.log('init', process.env.CLI_TARGET_PATH)
  return new InitCommand(argv)
}

module.exports = init

module.exports.InitCommand = InitCommand