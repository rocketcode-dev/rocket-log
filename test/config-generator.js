'use strict';

function configGenerator() {
  return {
    debug: {
      logging: {
        defaults: {
          transport: "clear-ansi-text-console",
          level: "trace",
        },
        transports: (() => {
          let result = [];
          for (let type of ['console']) {
            for (let format of ['ansi-text', 'text', 'json']) {
              for (let sensitive of ['clear', 'redacted']) {
                result.push({
                  name: `${sensitive}-${format}-${type}`,
                  type,
                  format,
                  showSensitive: sensitive === 'clear',
                });
              }
            }
          }
          return result;
        })(),
        modules: [
          { name: 'test',
            methods: [{
              name: 'clear',
              transport: 'clear-ansi-text-console'
            }, {
              name: 'redacted',
              transport: 'redacted-ansi-text-console'
            }, {
              name: 'textClear',
              transport: 'clear-text-console'
            }, {
              name: 'textRedacted',
              transport: 'redacted-text-console'
            }, {
              name: 'jsonClear',
              transport: 'clear-json-console'
            }, {
              name: 'jsonRedacted',
              transport: 'redacted-json-console'
            }]
          },{
            name: 'levels',
            methods: [{
              name: 'fault',
              level: 'fault'
            }, {
              name: 'error',
              level: 'error'
            }, {
              name: 'warn',
              level: 'warn'
            }, {
              name: 'info',
              level: 'info'
            }, {
              name: 'verbose',
              level: 'verbose'
            }, {
              name: 'debug',
              level: 'debug'
            }, {
              name: 'trace',
              level: 'trace'
            }]
          }
        ]
      }
    }
  };
}

export default configGenerator;
