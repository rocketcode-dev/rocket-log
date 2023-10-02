#!/usr/bin/env node

import getLogger from '../../index.js';
import { format } from 'node:util';
import levels from '../../levels.js';

import configGenerator from '../config-generator.js';

const config = configGenerator();

function headline(...text) {
  console.log(`\n\x1b[4;1;96m${format(...text)}\x1b[0m\n`);
}

getLogger.config = config;

function logSet1(logger) {
  logger.fault('This is a test');
  logger.error('This is a test with a %s.', 'parameter');
  logger.warn('This is a test with a %s and a %s.', 'parameter', 'second parameter');
  logger.info('This is a test with a %<%s%>.', 'sensitive parameter');
  logger.verbose('This is a test with a %s.', 'numeric parameter');
  logger.debug('This is a test with a sensitive numeric parameter in %<%d%>.', 99);
  logger.trace('This is a sensitive test with a %s. [the per cent sign is intentional]');  
}

for (let func of [{
  name: 'Basic logging',
    fn: () => {
      const logger = getLogger('test', 'clear');
      logSet1(logger)
    }
  },{
    name: 'Redacted logging',
    fn: () => {
      const logger = getLogger('test', 'redacted');
      logSet1(logger)
    }
  },{
    name: 'Text logging',
    fn: () => {
      const logger = getLogger('test', 'textClear');
      logSet1(logger)
    }
  },{
    name: 'Redacted text logging',
    fn: () => {
      const logger = getLogger('test', 'textRedacted');
      logSet1(logger)
    }
  },{
    name: 'JSON logging',
    fn: () => {
      const logger = getLogger('test', 'jsonClear');
      logSet1(logger)
    }
  },{
    name: 'Redacted JSON logging',
    fn: () => {
      const logger = getLogger('test', 'jsonRedacted');
      logSet1(logger)
    }
  },{
    name: 'Logging levels',
    fn: () => {
      for (const level of levels.map(l => l.name)) {
        const logger = getLogger('levels', level);
        logSet1(logger);
      }
    }
  }
]) {
  headline(func.name);
  func.fn();
}

headline('TESTS COMPLETE');
console.log('This concludes a visual test of the logging system. This test');
console.log('does not validate the results, but it does provide a visual');
console.log('check that the logging system is working as expected.');
console.log();
