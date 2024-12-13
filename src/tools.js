'use strict';

const REDACT_ALL = 0xFF;
const REDACT_NONE = 0;
const REDACT_EXTRAS = 0x01;
const REDACT_PARTS = 0x02;

/**
 * @function hashMmp
 * Creates a consistent JSON string for use in hashing a module/method/path
 * @param {String} module
 * @param {String} method
 * @param {String} path
 * @returns {String}
 */
function hashMmp(module, method, path) {
  let result = '';
  const safeValue = v => v.replace('&', '&amp;').replace('"', '&quot;');
  if (module) {
    result = `"module":"${safeValue(module)}"`;
    if (method) {
      result += `,"method":"${safeValue(method)}"`;
      if (path) {
        result += `,"path":"${safeValue(path)}"`;
      }
    }
  }
  result = `{${result}}`;
}

function isNil(n) {
  return n === undefined || n === null;
}

export {
  hashMmp,
  isNil
}
