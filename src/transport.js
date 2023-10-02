'use strict';

import * as levels from './levels.js';
import { Writable } from 'node:stream';
import * as tokenizer from './tokenizer.js';
import { getTransports } from './index.js';
import { isNil } from './tools.js';

const TYPE_CONSOLE = 'console';
const TYPE_FILE = 'file';
const TYPE_GROUP = 'group';
const TYPE_STREAM = 'stream';
// future types: HTTP endpoint, syslog

const VALID_FORMATS = ['text', 'ansi-text', 'json'];
const VALID_TYPES = [ TYPE_CONSOLE, TYPE_FILE, TYPE_GROUP, TYPE_STREAM ];

const existingTransports = [];

/**
 * @property {Record<string, Writeable[]>} streams
 * Maps stream names to actual streams. This is to allow config files to name
 * streams but code to create them.
 */
const streams = {};

/**
 * @method build
 * Builds a transport spec based on an object from the config and default.
 * @param {*} config the config from the spec. This will also fill in
 *  any default
 * @throws exception if the config is not valid
 */
function build(config) {
  let errors = [];
  let result = {};
  let type = null;
  if (!config) {
    // do nothing here
  } else if (typeof config === 'object') {
    type = config.type;
  } else if (typeof config === 'string') {
    type = config;
  }
  const defaultValues = defaultTransport(type);

  if (typeof config === 'string') { 
    if (defaultValues) {
      config = defaultValues;
    } else {
      errors.push({
        type: 'no-default-for-type',
        message: `There is no default config of type "${config}"`
      });
      throw errors;  
    }
  }

  const v = prop => {
    return (config ? config[prop] : undefined) ||
      (defaultValues ? defaultValues[prop] : undefined);
  }

  const nameExists = function(name) {
    return existingTransports.map(t=>t.name).includes(name);
  }

  result.name = v('name');
  if (!result.name) {
    errors.push({
      type: 'name-required',
      message: `Config missing name`
    });
    throw errors;
  }
  if (nameExists(result.name)) {
    errors.push({
      type: 'name-duplicated',
      message: `Config name "%s" duplicated. Config names must be unique.`
    });
    throw errors;
  }

  result.type = v('type');
  if (!result.type) {
    errors.push({
      type: 'type-required',
      message: `Config type required for config "${result.name
        }" in config "${result.name
        }". Acceptable values: ${VALID_TYPES}`,
    });
  } else if (!VALID_TYPES.includes(result.type)) {
    errors.push({
      type: 'invalid-type',
      message: `Config type "${result.type
        }" in config "${result.name
        }" not valid. Acceptable values: ${VALID_TYPES}`,
    });
  }
  
  if (result.type === TYPE_GROUP) {

    // be sure configs not intended for groups do NOT exist
    for (let p of ['format', 'showSensitive', 'levelLimit']) {
      if (v(p)) {
        errors.push({
          type: 'invalid-property',
          message: `Property "${p}" in config "${result.name
            }" not valid for group configs`
        });
      }
    }

  } else {

    // handling for anything that is not a group

    result.format = v('format');
    if (!result.format) {
      errors.push({
        type: 'format-required',
        message: `Config format required in config "${result.name
          }". Acceptable values: ${VALID_FORMATS}`,
      });
    } else if (!VALID_FORMATS.includes(result.format)) {
      errors.push({
        type: 'invalid-format',
        message: `Format "${result.format
          }" in config "${result.name
          }" is not valid. Acceptable values: ${VALID_FORMATS}`
      });
    }

    result.showSensitive = v('showSensitive') || false;
    result.levelLimit = v('levelLimit');
    // null is acceptable
    if (result.levelLimit) {
      if (levels.levels[result.levelLimit]) {
        result.levelLimit = result.levelLimit.level;
      } else {
        errors.push({
          type: 'invalid-level-limit',
          message: `Level limit "${result.levelLimit
            }" in config "${result.name
            }" not valid. Acceptable values: ${levels.levels.map(l=>l.name)
            } or by numbers 0 though ${levels.levels.length - 1}`
        });
      }
    }
  }

  // special handling for each type

  switch (result.format) {
  case TYPE_CONSOLE:
  case TYPE_STREAM:
    break;

  case TYPE_FILE:
    result.path = v('path');
    if (!result.path) {
      errors.push({
        type: 'path-required',
        mesage: 'pathname required'
      })
    }
    break;

  case TYPE_GROUP:
    result.members = v('members');
    if (!result.members) {
      errors.push({
        type: 'invalid-members-list',
        message: `Group "${result.name}" needs members. Set to an empty ` +
          `array to suppress this error`
      });
    } else if (!Array.isArray(result.members)) {
      errors.push({
        type: 'invalid-members-list',
        message: `Members of group "${result.name}" must be an array`
      });
    }
    for (let m of result.members) {
      if (!nameExists(m)) {
        errors.push({
          type: 'unknown-member',
          message: `Group "${result.name}" member ${m} does not exist`
        });
      }
    }
  }

  if (errors.length) {
    throw errors;
  }
  return result;
}

function defaultTransport(type) {
  type ||= 'console';
  switch(type) {
  case console:
    return {
      name: 'console',
      type: 'console',
      format: 'ansi-text',
      showSensitive: false,
      levelLimit: null // set to minimum log level or null for no limit  
    }
  }
}

function formatAnsiText(logger, level, transport, tokens) {
  let result = level.prefix.ansiText;
  if (logger.path) {
    result +=
      ` \x1b[92m${logger.module}${logger.method?`.${logger.method}`:''
      } ${logger.path}\x1b[97m -\x1b[0m `;
  } else {
    result +=
      ` \x1b[94m${logger.module}${logger.method?`.${logger.method}`:''
      }\x1b[97m:\x1b[0m `;
  }
  let ansiString = tokensToAnsiString(transport, tokens, level);
  result += ansiString.messages;
  return result;
}

function formatText(logger, level, transport, tokens) {
  let logMessage = tokensToString(transport, tokens);
  let result = level.prefix.text;
  result += hasRedactables(tokens) ? 'R' : ' ';
  if (logger.path) {
    result +=
      `${logger.module} ${logger.method} ${logger.path} - `;
  } else {
    result +=
      `${logger.module}.${logger.method} - `;
  }
  result += logMessage.messages.join('');
  return result;
}

function formatJson(logger, level, transport, tokens) {

  const result = {
    level: level.name,
    timestamp: new Date().toISOString(),
  };
  logger.method && (result.method = logger.method);
  logger.module && (result.module = logger.module);
  logger.path && (result.path = logger.path);
  result.message = tokensToString(transport, tokens).messages.join('');

  return JSON.stringify(result);
}

/**
 * @function hasRedactables
 * Return `true` if there is text that would be redacted if the transport's
 * `showSensitive` property is set to `false`, and `false` if the log message
 * would never be redacted.
 * @param {Array} tokens 
 * @returns {boolean}
 */
function hasRedactables(tokens) {
  for (let t of tokens) {
    if (t.type === tokenizer.TYPES_PRAGMA &&
      tokenizer.REDACTIONS.includes(t.pragma)) {
      return true;
    }
  }
  return false;
}

function log(logger, level, message, ...data) {
  let transports = Array.isArray(logger.transport)
    ? [...logger.transport]
    : (isNil(logger.transport) ? [] : [logger.transport]);

  // log to each transport
  const allTransports = getTransports();

  let tokens; // lazy-loaded
  transport:
  for (let i = 0; i < transports.length; i++) {
    const t = (() => {
      let result = transports[i];
      if (typeof result === 'string') {
        result = allTransports.find(t => t.name === result);
      }
      return result;
    })();

    // if it's a group, log to each member of the group
    if (transports[i] === TYPE_GROUP) {
      transports.splice(i+1, 0, t.members);
      continue;
    }

    // first check the level
    if (t.levelLimit && level > t.levelLimit) {
      continue;
    }

    // tokens needed, parse them once.
    tokens ||= tokenizer.tokenizer(message, ...data);

    if (t.showSensitive === false) {
      for (let token of tokens) {
        if (token.type === tokenizer.TYPES_PRAGMA) {
          if (token.pragma === tokenizer.REDACT_ALL) {
            continue transport;
          }
        }
      }
    }

    // build log message
    let outputMessage = '';
    let levelObj = normalizeLevel(level);
    switch (t.format) {
    case 'ansi-text':
      outputMessage = formatAnsiText(logger, levelObj, t, tokens);
      break;
    case 'json':
      outputMessage = formatJson(logger, levelObj, t, tokens);
      break;
    case 'text':
      outputMessage = formatText(logger, levelObj, t, tokens);
      break;
    }

    // send output to destination
    console.log(outputMessage);
  }
}

function normalizeLevel(level) {
  let levelObj = ['string', 'number'].includes(typeof level)
    ? levels.levels[level]
    : level;
    return levelObj;
}

/**
 * @function registerStream
 * Registers a stream with a name. This is to allow code to set up a stream
 * while the config file registers it. This should be called before logging to
 * that stream.
 * @param {string} name the name of the stream
 * @param {Writable} stream the actual stream
 */
function registerStream(name, stream) {
  Object.hasOwn(streams, name) || (streams[name] = []);
  streams[name].push(stream);
}

function ansiTokensToCore(transport, tokens, level) {
  let warnings = [];
  let internalErrors = [];
  let results = [];

  let isRedacting = false;

  const ansiPrefix = function(message, ...codes) {
    codes = (codes && codes.length) ? [...codes] : [];
    if (isRedacting) {
      if (transport.showSensitive) {
        codes.push(4);
      } else {
        message = '[redacted]';
      }
    }
    if (level.level >= level.debug) {
      let colors = codes.map(c => {
        if (Number.isNumber(c)) {
          if (c >= 30 && c <= 38) {
            return true;
          }
          if (c >= 90 && c <= 98) {
            return true;
          }
        }
        return false;
      });
      if (colors.length === 0) {
        codes.push(level.name === levels.DEBUG ? 37 : 90);
      }
    }
    return codes.length
      ? { prefix: '\x1b['+codes.join(';')+'m',
          message,
          suffix: '\x1b[0m'
        }
      : { message };
  }

  for (let token of tokens) {
    switch(token.type) {
    case tokenizer.TYPE_PRAGMA:
      switch(token.pragma) {
      case tokenizer.REDACT_ALL:
        if (!transport.showSensitive) {
          return null;
        }
        break;
      case tokenizer.REDACT_START:
      case tokenizer.REDACT_REMAINDER:
        isRedacting = true;
      break;
      case tokenizer.REDACT_END:
        isRedacting = false;
        break;
      default:
        // should be impossible, but I'll put something there in case I
        // add a new pragma later and forget to account for it
        internalErrors.push(`Unknown pragma ${token.pragma}`);
      }
      break;
    case tokenizer.TYPE_WARNING:
      warnings += token.message;
      break;
    case tokenizer.TYPE_BOOLEAN:
      results.push(
        ansiPrefix(new Boolean.toString(token.token), 33)
      );
      break;
    case tokenizer.TYPE_FUNCTION:
      results.push(
        ansiPrefix(`[${
          tokenizer.token.name
            ? 'anonymous function'
            : `function ${token.token.name}`
          }]`, 35, 4)
      );
      break;
    case tokenizer.TYPE_NUMBER:
      results.push(
        ansiPrefix(token.token, 33, 4)
      );
      break;
    case tokenizer.TYPE_NIL:
      results.push(
        ansiPrefix(JSON.stringify(token.token), 34)
      );
      break;
    case tokenizer.TYPE_STRING:
      results.push(
        ansiPrefix(token.token)
      );
      break;
    case tokenizer.TYPE_SYMBOL:
      results.push(
        ansiPrefix(token.token.toString(), 34)
      );
      break;
    case tokenizer.TYPE_OBJECT:
      results.push(
        ansiPrefix(token.token.toString())
      );
      break;
    case tokenizer.TYPE_UNSUPPORTED:
      results.push(ansiPrefix('[unsupported type]', 35));
      warnings.push('Unsupported type in log data')
      break;
    default:
      // should be impossible, but I'll put something there in case I
      // add a new pragma later and forget to account for it
      internalErrors.push(`Unknown type ${token.type}`);
      break;
    }
  }

  let result = {
    messages: results
  }
  warnings && (result.warnings = warnings);
  internalErrors && (result.internalErrors = internalErrors);

  return result;
}

function textTokensToCore(transport, tokens) {
  
  let warnings = [];
  let internalErrors = [];
  let results = [];

  let isRedacting = false;

  for (let token of tokens) {
    switch(token.type) {
    case tokenizer.TYPE_PRAGMA:
      switch(token.pragma) {
      case tokenizer.REDACT_ALL:
        if (!transport.showSensitive) {
          return null;
        }
        break;
      case tokenizer.REDACT_START:
      case tokenizer.REDACT_REMAINDER:
        if (!transport.showSensitive) {
          results.push('[redacted]');
          isRedacting = true;
        }
        break;
      case tokenizer.REDACT_END:
        isRedacting = false;
        break;
      default:
        // should be impossible, but I'll put something there in case I
        // add a new pragma later and forget to account for it
        internalErrors.push(`Unknown pragma ${token.pragma}`);
      }
      break;
    case tokenizer.TYPE_WARNING:
      warnings += token.message;
      break;
    case tokenizer.TYPE_BOOLEAN:
      if (!isRedacting) {
        results.push(new Boolean.toString(token.token));
      }
      break;
    case tokenizer.TYPE_FUNCTION:
      if (!isRedacting) {
        results.push(`[${
          tokenizer.token.name
            ? 'anonymous function'
            : `function ${token.token.name}`
          }]`);
      }
      break;
    case tokenizer.TYPE_NUMBER:
      if (!isRedacting) {
        results.push(new Number.toString(token.token));
      }
      break;
    case tokenizer.TYPE_NIL:
      if (!isRedacting) {
        results.push(JSON.stringify(token.token));
      }
      break;
    case tokenizer.TYPE_STRING:
      if (!isRedacting) {
        results.push(token.token);
      }
      break;
    case tokenizer.TYPE_SYMBOL:
      if (!isRedacting) {
        results.push(token.token.toString());
      }
      break;
    case tokenizer.TYPE_OBJECT:
      if (!isRedacting) {
        results.push(token.token.toString());
      }
      break;
    case tokenizer.TYPE_UNSUPPORTED:
      if (!isRedacting) {
        results.push('[unsupported type]');
      }
      break;
    default:
      // should be impossible, but I'll put something there in case I
      // add a new pragma later and forget to account for it
      internalErrors.push(`Unknown type ${token.type}`);
      break;
    }
  }

  let result = {
    messages: results
  }
  warnings && (result.warnings = warnings);
  internalErrors && (result.internalErrors = internalErrors);

  return result;
}

function tokensToAnsiString(transport, tokens, level) {
  let result = ansiTokensToCore(transport, tokens, normalizeLevel(level));
  result.messages = result.messages.map(a => {
    let result = a.message;
    if (Object.hasOwn(a, 'prefix')) {
      result = a.prefix + a.message;
      result += Object.hasOwn(a, 'suffix')
        ? a.suffix
        : '\x1b[0m';
    }
    return result;
  }).join('');
  return result;
}

function tokensToString(transport, tokens) {
  let result = textTokensToCore(transport, tokens);
  result.message = result.messages.map(a => a.message).join('');
  return result;
}

export default build
export {
  build,
  log,
  registerStream,
  TYPE_CONSOLE,
  TYPE_FILE,
  TYPE_GROUP,
  TYPE_STREAM,
  VALID_FORMATS,
  VALID_TYPES
}
