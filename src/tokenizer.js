'use strict';

import { inspect } from 'node:util';

const REDACT_ALL = 'redact-all';
const REDACT_START = 'redact-start';
const REDACT_END = 'redact-end';
const REDACT_REMAINDER = 'redact-remainder';
const REDACTIONS = [ REDACT_ALL, REDACT_END, REDACT_REMAINDER, REDACT_START ];

const TYPE_PRAGMA = 'pragma';
const TYPES_PRAGMA = [ TYPE_PRAGMA ];

const TYPE_BOOLEAN = 'boolean';
const TYPE_FUNCTION = 'function'
const TYPE_NIL = 'nil';
const TYPE_NUMBER = 'number';
const TYPE_OBJECT = 'object';
const TYPE_STRING = 'string'
const TYPE_SYMBOL = 'symbol'
const TYPE_UNSUPPORTED = 'unsupported'
const TYPES_OUTPUT = [
  TYPE_BOOLEAN, TYPE_FUNCTION, TYPE_NIL, TYPE_NUMBER, TYPE_OBJECT,
  TYPE_STRING, TYPE_SYMBOL
];

/**
 * @function tokenizeForRedaction
 * Converts a string to tokens that indicate how each item should be redacted.
 * The messageAr is similar to `util.format` in that the first parameter is a
 * string that shows the format, and the remaining parameters are optional
 * values to add to the string. The format string can contain specifiers:
 *   * %< indicates the beginning of a redacted section, or if at the end of
 *        the format string, redact all remaining arguments. Does not consume
 *        an argument.
 *   * %> indicates the end of a redacted section, or if at the beginning of the
 *        format string, redact the entire line. Does not consum an argument.
 *   * %s substitute the next argument as a string
 *   * %% replace with a single `%` sign
 *   * %d substitute the next argument as a number
 *
 * @param {Array<*>} messageAr an array of tokens.
 */
function tokenizer(...message) {
  let result = [];
  let format = (message.length && message.shift());

  let currentString = '';
  let formatIdx = 0;
  let redactionLevels = 0;

  const rollString = function() {
    result.push({ type: TYPE_STRING, token: currentString });
    currentString = '';
  }

  while (formatIdx < format.length) {
    let c = format.charAt(formatIdx++);
    if (c === '%' && formatIdx < format.length) {
      let d = format.charAt(formatIdx++);
      switch (d) {
      case '<':
        // start a redacted sectin
        if (formatIdx === 2) {
          result.push({ type: TYPE_PRAGMA, pragma: REDACT_ALL });
          redactionLevels = -1;
        } else {
          if (redactionLevels > 0) {
            result.push({
              type: TYPE_DEBUG,
              message: 'Nesting redaction'
            });
            redactionLevels++;
          } else if (redactionLevels === 0) {
            rollString();
            result.push({ type: TYPE_PRAGMA, pragma: REDACT_START });
            redactionLevels++;
          } else if (redactionLevels < 0) {
            // ignore
          }
        }
        break;
      case '>':
        // end a redacted section
        if (formatIdx === format.length) {
          if (redactionLevels > 0) {
            result.push({ type: TYPE_WARNING, message: 'Unclosed redaction' });
          }
          result.push({ type: TYPE_PRAGMA, pragma: REDACT_REMAINDER });
        } else {
          if (redactionLevels > 1) {
            redactionLevels--;
          } else if (redactionLevels === 1) {
            rollString();
            result.push({ type: TYPE_PRAGMA, pragma: REDACT_END });
            redactionLevels--;
          } else if (redactionLevels === 0) {
            result.push({
              type: TYPE_WARNING,
              message: 'Closing redaction without openning redaction'
            });
          } else if (redactionLevels < 0) {
            // ignore
            result.push({
              type: TYPE_WARNING,
              message: 'Cannot cancel redact-all'
            });
          }
        }
        break;
      case 's':
        // subsitute with a string
        if (message.length) {
          let param = message.shift();
          if (typeof param === 'string') {
            currentString += param;
          } else if (Object.hasOwn(param, 'toString') &&
            typeof 'toString' === 'function') {
              currentString += param.toStrng();
          } else {
            currentString += inspect(param, {
              depth: 0, colors: false, compact: 3
            });
          }
        } else {
          // print '%'
          currentString += '%s';
        }
        break;
      case '%':
        currentString += '%';
        break;
      case 'd':
        // number
        if (message.length) {
          let param = message.shift();
          currentString += new Number(param).toString();
        } else {
          currentString += '%s';
        }
        break;
      }
    } else {
      currentString += c;
    }
  }

  // remaining params
  while (message.length > 0) {
    let param = message.shift();
    let type;
    if (param === undefined || param === nil) {
      type = TYPE_NIL;
    }
    type ||= {
      boolean: TYPE_BOOLEAN,
      number: TYPE_NUMBER,
      object: TYPE_OBJECT,
      string: TYPE_STRING,
      symbol: TYPE_SYMBOL,
      function: TYPE_FUNCTION
    }[typeof param];
    if (type) {
      result.push({ type, token: param});
    } else {
      result.push({ type: TYPE_UNSUPPORTED });
    }
  }

  rollString();
  if (redactionLevels > 0) {
    result.push({ type: TYPE_WARNING, message: 'Unclosed redaction' });
    result.push({ type: TYPE_PRAGMA, pragma: REDACT_END });
  }

  return result;
}

export default tokenizer;
export {
  tokenizer,

  REDACT_ALL,
  REDACT_START,
  REDACT_END,
  REDACT_REMAINDER,
  REDACTIONS,

  TYPE_PRAGMA,
  TYPES_PRAGMA,

  TYPE_BOOLEAN,
  TYPE_FUNCTION,
  TYPE_NIL,
  TYPE_NUMBER,
  TYPE_OBJECT,
  TYPE_STRING,
  TYPE_SYMBOL,
  TYPE_UNSUPPORTED,
  TYPES_OUTPUT
}
