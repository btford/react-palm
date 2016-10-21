const split = require('split');
const through2 = require('through2');
const cp = require('child_process');
const chalk = require('chalk');

execWithPrepend('./node_modules/.bin/tsc --watch', chalk.blue('tsc'));
execWithPrepend('./node_modules/.bin/webpack-dev-server --hot', chalk.green('wpk'));
execWithPrepend('./node_modules/.bin/ava --watch --verbose', chalk.cyan('ava'));

function execWithPrepend(cmd, prefix) {
  const child = cp.exec(cmd);

  prefixLine(child.stdout, prefix + ' ')
    .pipe(process.stdout);
  prefixLine(child.stderr, chalk.red(prefix) + ' ')
   .pipe(process.stderr);
}

function prefixLine(stream, prefix) {
  return stream.pipe(split())
    .pipe(through2((chunk, enc, cb) => {
      cb(null, prefix + chunk + '\n');
    }));
}
