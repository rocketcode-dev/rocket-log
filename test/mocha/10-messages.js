'use strict';

import TestBattery from 'test-battery';
import logger from '../../src/index.js';

const config = {
  debug: {
    logging: {
      transports: [ 'console' ],
      modules: [
        { name: 'module-trace',
          level: 'trace'
        },
        { name: 'module-error',
          level: 'error',
          methods: [
            { name: 'method-debug',
              level: 'debug'
            }
          ]
        }
      ]
    }
  }
}

describe('accurate logging messages', function() {
  it ('accurate messages', function() {
    const logTrace = logger.getLogger('module-trace', 'method-whocares');
    const logErrorError = logger.getLogger('module-error', 'method-error');
    const logErrorDebug = logger.getLogger('module-error', 'method-debug');
    const logInfo = logger.getLogger('module-info', 'method-info');

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
