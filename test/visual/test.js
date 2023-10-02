#!/usr/bin/env node

import logger from '../../src/index.js';
import { format } from 'node:util';
import levels from '../../src/levels.js';

import configGenerator from '../config-generator.js';

const config = configGenerator();

function headline(...text) {
  console.log(`\n\x1b[4;1;96m${format(...text)}\x1b[0m\n`);
}

logger.config = config;

function logSet1(log) {
  log.fault('This is a test');
  log.error('This is a test with a %s.', 'parameter');
  log.warn('This is a test with a %s and a %s.', 'parameter', 'second parameter');
  log.info('This is a test with a %<%s%>.', 'sensitive parameter');
  log.verbose('This is a test with a %s.', 'numeric parameter');
  log.debug('This is a test with a sensitive numeric parameter in %<%d%>.', 99);
  log.trace('This is a sensitive test with a %s. [the per cent sign is intentional]');  
}

for (let func of [{
  name: 'Basic logging',
    fn: () => {
      const log = logger('test', 'clear');
      logSet1(log)
    }
  },{
    name: 'Redacted logging',
    fn: () => {
      const log = logger('test', 'redacted');
      logSet1(log)
    }
  },{
    name: 'Text logging',
    fn: () => {
      const log = logger('test', 'textClear');
      logSet1(log)
    }
  },{
    name: 'Redacted text logging',
    fn: () => {
      const log = logger('test', 'textRedacted');
      logSet1(log)
    }
  },{
    name: 'JSON logging',
    fn: () => {
      const log = logger('test', 'jsonClear');
      logSet1(log)
    }
  },{
    name: 'Redacted JSON logging',
    fn: () => {
      const log = logger('test', 'jsonRedacted');
      logSet1(log)
    }
  },{
    name: 'Logging levels',
    fn: () => {
      for (const level of levels.map(l => l.name)) {
        const log = logger('levels', level);
        logSet1(log);
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
