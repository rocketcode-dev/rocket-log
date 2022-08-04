'use strict';

import stringify from 'fast-safe-stringify';
import winston from 'winston';
import _ from 'lodash';

const MODULE = 'capn-log';

const logLevels = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4, 
  trace: 5
};

const FATAL='fatal';
const ERROR='error';
const WARN='warn';
const INFO='info';
const DEBUG='debug';
const TRACE='trace';

const colors = {
  fatal: '\x1b[1;101;97m[FATAL ]\x1b[m',
  error:  '\x1b[1;41;97m[ERROR ]\x1b[m',
  warn:  '\x1b[1;104;97m[ warn ]\x1b[m',
  info:        '\x1b[92m[  info]\x1b[m',
  debug:       '\x1b[94m[   dbg]\x1b[m',
  trace:               '[    tr]'
};

let loggers = {};

let configs = [];
function c(path) {
  for (let i = configs.length - 1; i >= 0; i--) {
    if (_.has(configs[i], path)) {
      return _.get(configs[i], path);      
    }
  }
  return undefined;
}

function setConfigs(newConfigs) {

  if (Array.isArray(newConfigs)) {
    configs = newConfigs;
  } else {
    configs = [newConfigs];
  }
  
  loggers = {};
}

function getLevel(module, method) {

  let level;
  let moduleLevel = _.find(c('debug.logging.modules'), {name:module});
  if (!_.isNil(moduleLevel)) {
    if (_.has(moduleLevel, 'methods')) {
      let moduleMethod = _.find(moduleLevel.methods, {name: method});
      moduleMethod && (level = moduleMethod.level);
    }
    if (_.isNil(level)) {
      level = moduleLevel.level;
    }
  }
  if (_.isNil(level)) {
    level = c('debug.logging.level');
  }
  if (_.isNil(level) || !_.has(logLevels, level)) {
    level = INFO;
  }
  return level;
}

function getShowSensitive(module, method) {

  let showSensitive = undefined;
  let moduleLevel = _.find(c('debug.logging.modules'), {name:module});
  if (!_.isNil(moduleLevel)) {
    if (_.has(moduleLevel, 'methods')) {
      let moduleMethod = _.find(moduleLevel.methods, {name: method});
      if (moduleMethod && _.has(moduleMethod, 'showSensitive')) {
        showSensitive = moduleMethod.showSensitive;
      }
    }
    if (_.isNil(showSensitive)) {
      if (_.has(moduleLevel, 'showSensitive')) {
        showSensitive = moduleLevel.showSensitive;
      }
    }
  }
  if (_.isNil(showSensitive)) {
    let sc = c('debug.logging.showSensitive');
    if (!_.isNil(sc)) {
      showSensitive = sc;
    }
  }
  if (_.isNil(showSensitive)) {
    showSensitive = false;
  }

  return showSensitive;
}

const moduleFormat = winston.format((info, opts) => {

  let { module, method, path } = opts;
  
  // calculate log level for the module/method
  // TODO we can speed this up by precalculating the log levels.
  let level = getLevel(module, method);
  let showSensitive = getShowSensitive(module, method);

  if (logLevels[info.level] > logLevels[level]) {
    return false;
  }

  // TODO give modules different colours

  if (method) {
    if (path) {
      method = '.\x1b[32m'+method+'['+path+']\x1b[m';
    } else {
      method = '.\x1b[36m'+method+'\x1b[m';
    }
    module += method;
  } else {
    if (module.match(/Error$/)) {
      module = '\x1b[31m'+module+'\x1b[m';
    }
  }

  info.module = module;
  info.showSensitive = showSensitive;
  return info;
});

const lineFormat = winston.format.printf(
  logMessage => {
    let { level, message, timestamp, module, showSensitive } = logMessage;
    let metadata = _.omit(
      logMessage, ['level', 'message', 'timestamp', 'module', 'showSensitive']);
    let msg = `${timestamp} ${colors[level]} ${module}: ${message}`;
    if(metadata && _.size(metadata)) {
      let objString = objTypeByHeuristics(metadata);
      let detailString;
      if (objString === false) {
        detailString =
          '\n' + typeof metadata + ': ' + stringify(metadata, 0, 3);
      } else if (_.isString(objString)) {
        detailString = ` ${objString}`;
      }
      return redact(!showSensitive, message, detailString);
    }
    return redact(!showSensitive, msg, undefined);
  }
);

function createLogger(module, method, path) {
  
  let result = winston.createLogger({
    format: winston.format.combine(
      winston.format.splat(),
      winston.format.timestamp(),
      moduleFormat({module, method, path}),
      lineFormat
    ),
    levels: logLevels,
    transports: [
      // keep this at trace -- we've filtered out the logs we don't need
      // earlier
      new winston.transports.Console({level: TRACE})
    ]
  });

  return result;
}

/**
 * @method redact
 * Checks a message for markers indicating it's sensitive, and if necessary,
 * removes the sensitive information.
 * @param {Boolean} doRedact
 * @param {String} message 
 * @param {String} detail 
 */
function redact(doRedact, message, detail) {
  
  if (!doRedact) {
    let returnString = message
      .replace('§§', '')
      .replace(/§([^§]*)§/g, '\x1b[4m$1\x1b[24m')
      .replace('§', '\x1b[97;101m § \x1b[0m');
    detail && (returnString += detail);
    return returnString;
  }
  if (doRedact && message.startsWith('§§')) {
    return '[redacted]';
  }
  if (doRedact && message.endsWith('§§')) {
    detail = ' [redacted]';
  }
  let redacting = false;
  let result = '';
  for (let i = 0; i < message.length; i++) {
    let c = message.charAt(i);
    if (c === '§') {
      redacting = !redacting;
    } else if (redacting) { 
      result += '*';
    } else {
      result += c;
    }
  }
  return result + (detail ? detail : '');
}

function objTypeByHeuristics(obj) {
  let keyRange = {
    max: Number.MIN_SAFE_INTEGER,
    min: Number.MAX_SAFE_INTEGER
  };
  let numbersDetected = {};
  let objString = '';
  for (let key of (Object.keys(obj))) {
    let parsedKey = Number.parseInt(key);
    if (_.isNaN(parsedKey)) {
      // not a numeric key
      return false;
    }
    let v = obj[key]
    if (!_.isString(v) || v.length !== 1) {
      // not a single-character string
      return false;
    }
    keyRange = {
      max: Math.max(keyRange.max, parsedKey),
      min: Math.min(keyRange.min, parsedKey)
    };
    numbersDetected[parsedKey] = obj[key];
  }
  if (keyRange.max < keyRange.min) {
    // could be an empty string or an empty object
    return undefined;
  }
  if (keyRange.min != 0) {
    // not a valid index for the first character of a stirng
    return false
  }
  for (let i = keyRange.min; i <= keyRange.max; i++) {
    if (!_.has(numbersDetected, i)) {
      // gap in string
      return false;
    }
    objString += numbersDetected[i];
  }
  return objString;
}

/**
 * Create or retreives a logger for a module/method.
 * @param {String} module the name of the module or route
 * @param {String|Function} method the name of the method, or for http end
 *  points, the verb (e.g. GET, POST, PUT...). Also accepts named functions;
 *   it'll get the method name from `method.name`
 * @param {String} [path] only provide for http end points - the path.
 */
function getLogger(module, method, path) {
  let log;
  if (module !== MODULE && method !== getLogger.name) {
    log = getLogger(MODULE, getLogger.name);
  }

  let key = `${module}-${method}=${path}`;

  if (typeof method === 'function') {
    method = method.name;
  }

  if (loggers[key]) {
    return loggers[key];
  } else {
    let newLogger = createLogger(module, method, path);
    (log || newLogger).debug('Creating logger %s %s:%s%s',
        colors[getLevel(module, method)],
        module, method, path ? ` path ${path}` : '');
    loggers[key] = newLogger;
    return newLogger;
  }
}

export default {
  FATAL,
  ERROR,
  WARN,
  INFO,
  DEBUG,
  TRACE,
  getLogger,
  logLevels,
  setConfigs
};