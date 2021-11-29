#! /usr/bin/env node

const yargs = require('yargs')
const { hideBin } = require('yargs/helpers')
const dedent = require('dedent')

const pkg = require('../package.json')

// const arg = hideBin(process.argv)

const argv = process.argv.slice(2)

const context = {
  cliVersion: pkg.version
}

const cli = yargs(argv)

cli
  .usage('Usage: xlh-cli [command] <option>')
  .demandCommand(1, 'A command is required. Pass --help to see all available commands and options') // 期望至少输入一个 command
  .strict() // 如果 command 没有匹配到，会输出错误提示
  .recommendCommands() // 输入的 command 没有匹配到，会找到最接近的命令作为提示输出
  .fail((err, msg) => {
    console.log('ERR', err)
  }) // 自定义 command 错误时的输出信息
  .alias('h', 'help') // 配置别名
  .alias('v', 'version')
  .wrap(cli.terminalWidth()) // 终端的宽度
  .epilogue(dedent`
      When a command fails, all logs are written to ...
  `) // 定义结尾的输出信息
  .options({
    debug: {
      type: 'boolean',
      describe: 'Bootstrap debug mode',
      alias: 'd'
    }
  })
  .option('registry', {
    type: 'string',
    describe: 'Define global registry',
    alias: 'r'
  })
  // .group([''])
  .group(['debug'], 'Dev Options:')
  .group(['help', 'version'], 'Global Options:')
  .command('init [name]', 'Do init a project', (yargs) => {
    yargs
      .option('name', {
        type: 'string',
        describe: 'Name of a project'
      })
  }, (argv) => {
    console.log(argv)
  })
  .command({
    command: 'list',
    aliases: ['ls', 'la', 'll'],
    describe: 'List local packages',
    builder: (yargs) => {},
    handler: (argv) => {
      console.log(argv)
    }
  })
  // .argv
  .parse(argv, context)