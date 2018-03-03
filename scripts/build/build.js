const util = require('util');
const glob = util.promisify(require('glob'));
const { join, relative } = require('path');
const { emptyDir, write, read } = require('./fs');
const { log } = require('../utils');
const config = require('../../config');

const copyPkgConfig = require('./copyPkgConfig');
const transform = require('./transform');
const { createIndexFile, createFPModule } = require('./generate');


async function buildBase(targetPath, envOptions) {
  const sources = await glob('./src/**/*.js', {
    ignore: './src/__tests__/**',
  });

  return Promise.all(sources.map(async (srcPath) => {
    const contents = await read(srcPath);
    const path = join(targetPath, relative('./src', srcPath));
    return write(path, transform(contents, envOptions));
  }));
}

async function buildFP(_basePath, envOptions) {
  const baseBase = join(_basePath, 'fp');

  const indexFile = createIndexFile(config.definitions);
  await write(join(baseBase, 'index.js'), transform(indexFile, envOptions));

  return Promise.all(config.definitions.map(async ([name, argLength]) => {
    const contents = createFPModule(name, argLength);
    const transformed = transform(contents, envOptions);

    return write(join(baseBase, `${name}.js`), transformed);
  }));
}

async function build(pkgName, envOptions) {
  log.green(`building ${pkgName}...`);

  const basePath = join(config.baseTarget, pkgName);

  await emptyDir(basePath);
  await copyPkgConfig(basePath, pkgName);

  await Promise.all([
    buildBase(basePath, envOptions),
    buildFP(basePath, envOptions),
  ]);
}

module.exports = async function () {
  await build('littlebird-es', { modules: false });
  await build('littlebird', { modules: 'commonjs' });
};