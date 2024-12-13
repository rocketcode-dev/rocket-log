'use strict';

import TestBattery from 'test-battery';
import logger from '../../src/index.js';
import configGenerator from '../config-generator.js';

const config = configGenerator();
logger.config = config;

console.log('logger.config sections', Object.keys(config.debug.logging));
console.log('logger.config [default]', JSON.stringify(config.debug.logging.defaults, null, 3));

// {
//   debug: {
//     logging: {
//       defaults: {
//         level: 'info',
//         transport: 'clear-ansi-text-console',
//       },
//       transports: [ 'console' ],
//       modules: [
//         { name: 'module-trace',
//           level: 'trace'
//         },
//         { name: 'module-error',
//           level: 'error',
//           methods: [
//             { name: 'method-debug',
//               level: 'debug'
//             }
//           ]
//         }
//       ]
//     }
//   }
// }

describe('accurate logging messages', function() {
  it ('accurate messages', function() {
    const logTrace = logger('module-trace', 'method-whocares');
    const logErrorError = logger('module-error', 'method-error');
    const logErrorDebug = logger('module-error', 'method-debug');
    const logInfo = logger('module-info', 'method-info');

    logTrace.trace('Trace Message');
    logTrace.debug('Debug Message');
    logErrorError.error('Error Message');
    logErrorError.fault('Fatal Message');
    logErrorDebug.debug('Debug Message');
    logErrorDebug.info('Info Message');
    logInfo.info('Info Message');
    logInfo.error('Error Message');
  });
});

describe('accurate config', function() {

});

describe('accurately redacting sensitive messages', function() {

});
