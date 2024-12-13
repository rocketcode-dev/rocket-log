'use strict';

import levels from "./levels.js";
import { log } from "./transport.js";
import validateConfig from "./validate-config.js";

class Logger {

  #manager;
  #mmpHash;

  #config;

  constructor(manager, mmpHash) {
    this.#manager = manager;
    this.#mmpHash = mmpHash;
    this.reconfig();
  }

  // get the level and transports from the current config. Allows the logger
  // to pick up changes to the config post-initialization.
  reconfig() {
    let maxLevel =
      levels[this.#manager.getMmpProperty('level', this.#mmpHash)];

    let transport
      = this.#manager.getMmpProperty('transport', this.#mmpHash);

    this.#config = {
      maxLevel,
      transport
    };

    for (let level of levels) {
      let enabled = (level.level <= maxLevel.level)
      let logFunc = enabled
        ? function (...m) { this.log(level, ...m); }
        : () => {};
      if (Object.hasOwn(this, level.name)) {
        delete this[level.name]
      }
      Object.defineProperty(this, level.name, {
        value: logFunc,
        writable: false,
        configurable: true,
        enumerable: true
      });
      Object.defineProperty(this[level.name], 'enabled', {
        value: enabled,
        writable: false,
        configurable: true,
        enumerable: true
      });
    }
  }

  get level() {
    return this.#config.maxLevel;
  }

  get method() {
    return this.#mmpHash.method;
  }

  get module() {
    return this.#mmpHash.module;
  }

  get transport() {
    return this.#config.transport;
  }

  get path() {
    return this.#mmpHash.path;
  }

  log(level, ...message) {
    if (this[level.name].enabled) {
      log(this, level, ...message);
    }
  }

  toString() {
    return `${this.#mmpHash.toString()}-(${this.#config.maxLevel.name
      }/${this.#config.transport}) - ${JSON.stringify(this.#config)}`;
  }
}

class LoggerManager {

  #config = {};
  #loggers = {};

  /**
   * @method getMmpProperty
   * Gets a property from the config, using the module/method/path hierarchy.
   * If a property is not defined for a module/method/math, it'll check the
   * module/method, then the module, then the default config.
   * @param {string} property the name of the property to get.
   * @param {MMPHash} mmpHash the hash value for the module/method/path,
   *  expressed as an MMPHash object.
   * @returns {string|null|undefined} the value of the property, or undefined if
   *  the property does not exist.
   */
  getMmpProperty(property, mmpHash) {
    let result = undefined;

    if (mmpHash.module && Object.hasOwn(this.#config, 'modules')) {
      const moduleObj = this.#config.modules.find(m => {
        return (m.name === mmpHash.module)
      });
      if (moduleObj) {
        if (mmpHash.method && Object.hasOwn(moduleObj, 'methods')) {
          const methodObj = moduleObj.methods.find(m => {
            return (m.name === mmpHash.method);
          });
          if (methodObj) {
            if (mmpHash.path && Object.hasOwn(methodObj, 'paths')) {
              result = methodObj[property];
              const pathObj = methodObj.paths.find(m => {
                return (m.name === mmpHash.path);
              });
              if (pathObj) {
                if (Object.hasOwn(pathObj, property)) {
                  result = pathObj[property];
                }
              }
            }
            if (result === undefined && Object.hasOwn(methodObj, property)) {
              result = methodObj[property];
            }
          }
        }
        if (result === undefined && Object.hasOwn(moduleObj, property)) {
          result = moduleObj[property];
        }
      }
    }
    if (result === undefined &&
      Object.hasOwn(this.#config.defaults, property)
    ) {
      result = this.#config.defaults[property];
    }

    return result;
  }

  set config(newConfig) {
    this.#config = newConfig?.debug?.logging;
    if (!this.#config) {
      throw new Error('Invalid configuration -- new config must be under ' +
        'debug.logging');
    }
    const configErrors = validateConfig(this);
    if (configErrors) {
      console.error('Log configuration errors:');
      for (let error of configErrors) {
        console.error('  %s', error);
      }
      throw new Error('Log configuration errors');
    }
    for (let logger of Object.values(this.#loggers)) {
      logger.reconfig();
    }
  };

  get config() {
    return this.#config;
  }

  get defaultLevel() {
    return this.#config.level
      ? levels[this.#config.level]
      : levels['info'];
  }

  get transports() {
    return this.#config.transports;
  }

  getLogger(module, method, path) {
    const mmpHash = new MMPHash(module, method, path);
    let result = this.#loggers[mmpHash.toString()];
    if (!result) {
      result = new Logger(this, mmpHash);
    }
    return result;
  }
}

/**
 * @class MMPHash
 * Immutable objects that represent a module/method/path combination. It's used
 * for identifying a logger.
 */
class MMPHash {

  /**
   * @property {string} #hash
   * The hash value for this module/method/path as a JSON string, with no
   * null values, no additional white space, and in order. The hash is stable
   * and predictable, and can be used as a key in a map.
   */
  #hash;

  /**
   * @property {string} #method
   */
  #method;
  /**
   * @property {string} #module
   */
  #module;
  /**
   * @property {string} #path
   */
  #path;

  /**
   * @constructor
   * Create a new MMPHash object. Every time this class is instantiated with
   * same module/method/path, the same hash value will be generated and the
   * `.toString()` methods will return the same value.
   * @param {string|object} [module] the name of the module, or an object that
   *  contains the module, method, and path, or a JSON string that parses to
   *  such an object.
   * @param {string} [method] the name of the method. This can be a JavaScript
   *  method or an HTTP verb. Conventionally, HTTP verbs should be uppercase and
   *  JavaScript methods should start with a lowercase letter.
   * @param {string} [path] the name of the path. This is typically only used
   *  when the method is an HTTP verb.
   */
  constructor(module, method, path) {

    let moduleObj = null;
    if (typeof module === 'object') {
      moduleObj = module;
    } else if (typeof module === 'string' && module.startsWith('{')) {
      moduleObj = JSON.parse(module);
    }

    if (moduleObj) {
      const mmp = JSON.parse(module);
      module = mmp.module;
      method = mmp.method;
      path = mmp.path;
    }

    if (path) {
      if (!(method && module)) {
        throw new Error('Path requires method and module');
      }
      if (typeof path !== 'string') {
        throw new Error('Path must be a string');
      }
    }
    if (method) {
      if (!module) {
        throw new Error('Method requires module');
      }
      if (typeof method !== 'string') {
        throw new Error('Method must be a string');
      }
    }
    if (module && typeof module !== 'string') {
      throw new Error('Module must be a string');
    }

    this.#module = module || null;
    this.#method = method || null;
    this.#path = path || null;

    this.#hash = this.#makeHash(module, method, path);
  }

  #makeHash(module, method, path) {
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
    return result;
  }

  get hash() {
    return this.#hash;
  }
  get method() {
    return this.#method;
  }
  get module() {
    return this.#module;
  }
  get path() {
    return this.#path;
  }

  toString() {
    return this.#hash;
  }
}

function logger(module, method, path) {
  return loggerManager.getLogger(module, method, path);
}

function getTransports() {
  return loggerManager.transports;
}

const loggerManager = new LoggerManager();
Object.defineProperty(logger, 'config', {
  set: function (newConfig) {
    loggerManager.config = newConfig;
  }
});

export default logger;
export {
  logger, getTransports
}
