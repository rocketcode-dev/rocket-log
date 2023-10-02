'use strict';

import { validLevel } from "./levels.js";
import { TYPE_GROUP, build } from "./transport.js";

const validHttpMethods = [
  // FIXME this is not a complete list
  'DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'
];

const DEFAULTS = Symbol('DEFAULTS');

/**
 * @module validateConfig
 * Validates a config file. Configs should look like
 * logging:
 *   transports:
 *     - name: default
 *   modules:
 *     - name: module-name
 *       transport: default
 *       level: info
 *       methods:
 *         - name: getConfig
 *           level: debug
 */
function OLD____validateConfig(config) {
  const transportSpecs = config?.debug?.logging?.transports;
  const transports = [];
  const errors = [];
  const level = config?.debug?.logging?.level || levels.INFO;
  let modules = [];
  
  const validateTransport = (transportConfig) => {
    try {
      let transportBuild = build(transportConfig);
      transports.push(transportBuild);
    } catch(e) {
      errors.concat(e);
    }
  }
  
  // first validate the non-groups, then the groups
  let groups = [];
  let nonGroups = [];
  if (transportSpecs?.length) {
    for (const t of transportSpecs) {
      if (t && typeof t === 'object' && t.type === TYPE_GROUP) {
        groups.push(t);
      } else {
        nonGroups.push(t);
      }
    }
    for (let t of [].concat(groups, nonGroups)) {
      validateTransport(t);
    }
  } else {
    validateTransport();
  }

  // transports validated, now validate the modules

  if (!levels.validLevel(level)) {
    errors.push({
      type: 'invalid-default-level',
      message: `Level ${level} not valid`
    });
  }

  const fromLowestConfig = (item, module, method, path) => {
    if (path && Object.hasOwn(path, item)) {
      return path[item];
    }

    if (method && Object.hasOwn(method, item)) {
      return method[item];
    }

    if (module && Object.hasOwn(module, item)) {
      return module[item];
    }

    if (config.debug.logging && Object.hasOwn(config.debug.logging, item)) {
      return config.debug.logging[item];
    }

    return undefined;
  }

  const idConfig = (module, method, path) => {
    let result = module && module.name
      ? `module "${module.name}"`
      : 'default config';
    method && (result += ` method "${method.name}"`);
    path && (result += ` path "${path.name}`);
    return result;
  }
  const idParentConfig = (prefix, module, method, path) => {
    let result = module ? `${prefix} module "${module.name}"` : '';
    path && (result += ` method "${method.name}"`);
    return result;
  }
  const existingNames = [];
  const testLevel = (module, method, path) => {
    let level = fromLowestConfig('level', module, method, path);
    if (level) {
      if (!levels.validLevel(level)) {
        errors.push({
          type: 'invalid-level',
          message: `Config level ${level} in ${idConfig(module, method, path)
            } not valid.`
        });
      }
    }
  }
  const testName = (module, method, path) => {
    let name = fromLowestConfig('name', module, method, path);
    let composedName = module?.name + '|' + method?.name + '|' + path?.name;
    if (!name) {
      errors.push({
        type: 'missing-name',
        message: `Config missing name${
          idParentConfig(' in ', module, method, path)}`
      });
      return false; // do not continue processing module/method/path
    }
    if (existingNames.includes(composedName)) {
      errors.push({
        type: 'duplicate-name',
        message: `Deplicate name in config for ${
          idConfig(module, method, path)}`
      });
      return false; // do not continue processing module/method/path
    } else {
      existingNames.push(composedName);
    }
    return true;
  }
  const testTransports = (module, method, path) => {

    let transportName = fromLowestConfig('transport', module, method, path);
    let availableTransports = config.debug.logging.transports;
    if (!availableTransports || availableTransports.length === 0) {
      errors.push({
        type: 'no-transports',
        message: `No transports defined in config`
      });
    }
    if (transportName) {
      if (Array.isArray(availableTransports)) {
        if (!availableTransports.find(t => t.name === transportName)) {
          errors.push({
            type: 'transport-does-not-exist',
            message: `Transport ${transportName} in ${
              idConfig(module, method, path)} does not exist`
          });
        }
      } else {
        errors.push({
          type: 'transport-not-array',
          message: 'Transports in debug.logging.config is not an array'
        });
      }
    } else {
      errors.push({
        type: 'transport-required',
        message: 'Transport not specified'
      });
    }
  }

  testLevel();
  testTransports();
  modules = config?.debug?.logging?.modules || [];
  if (Array.isArray(modules)) {
    for (const module of modules) {
      if (testName(module)) {
        if (module.level) {
          testLevel(module);
          testTransports(module);
        }
        if (module.methods) {
          if (Array.isArray(module.methods)) {
            for (let method of module.methods) {
              if (testName(module, method)) {
                testLevel(module, method);
                testTransports(module, method);
                if (method.paths) {
                  if (validHttpMethods.includes(method.paths)) {
                    errors.push({
                      type: 'path-with-non-http-method',
                      message: `Method "${method.name}" in module "${module.name
                        }" is not a supported HTTP method and cannot have paths. ` +
                        `Supported HTTP methods: ${validHttpMethods}`
                    });
                  } else if (Array.isArray(method.paths)) {
                    for (let path of method.paths) {
                      if (testName(module, method, path)) {
                        testLevel(module, method, path);
                        testTransports(module, method, path);
                      }
                    }
                  } else {
                    errors.push({
                      type: 'paths-not-array',
                      message: `Module "${module.name}" method "${method
                        }" paths config is not an array.`
                    });
                  }
                }
              }
            }
          } else {
            errors.push({
              type: 'methods-not-array',
              message: `Module "${module.name}" methods config is not an array.`
            });
          }
        }
      }
    }
  } else {
    errors.push({
      type: 'modules-not-array',
      message: `Modules config is not an array.`
    });
  }

  // and return the validated config

  if (errors.length) {
    return {
      errors,
      valid: false
    }
  } else {
    return {
      level,
      modules,
      transports,
      transport: config?.debug?.logging?.transport,
      valid: true
    };
  }

}

/**
 * @function validateConfig
 * Validates a config file. Configs should look like:
 * logging:
 *   defaults:
 *     level: <name>
 *     transport: <name> (optional, default is 'default')
 *   transports: (optional, default, called `default` logs ansi to console)
 *     - 
 *   modules: (optional, default is empty. Modules not specified use defaults)
 *     - name: <module name>
 *       level: <level>
 *       transport: <transport>
 *       methods: (optional, default is all methods)
 *       - level: <level>
 *         transport: <transport>
 *         paths: (optional, default is all paths)
 *         - level: <level>
 *           transport: <transport>
 * @param {*} manager 
 */
function validateConfig(manager) {
  const errors = [];

  errors.push(...validateConfigItem(
    manager,
    '[defaults]',
    manager.config.defaults,
    DEFAULTS
  ));

  if (Object.hasOwn(manager.config, 'modules')) {
    if (Array.isArray(manager.config.modules)) {
      for(const module of manager.config.modules) {
        errors.push(...validateConfigItem(
          manager,
          `module:${module.name}`,
          module,
          ['method', 'path']
        ));
      }
    } else {
      errors.push('Config modules must be an array');
    }
  } 
  return errors.length ? errors : null;
}

function validTransportName(manager, name) {
  if (typeof name !== 'string') {
    return false;
  }
  let thisTransport = manager.config.transports.find(t => t.name === name);
  if (!thisTransport) {
    return false;
  }

  return true;
}

function validateConfigItem(manager, name, item, subitemTypes) {
  const requireEverything = (subitemTypes === DEFAULTS);
  const errors = [];

  const stopValidation = new Set();

  for (const i of ['level', 'transport']) {
    if (requireEverything) {
      if (!Object.hasOwn(item, i)) {
        errors.push(`${name} requires ${i} config`);
        stopValidation.add(i)
      }
    }
    if (!stopValidation.has(i)) {
      if (Object.hasOwn(item, i) && typeof item[i] !== 'string') {
        errors.push(`${name} transport must be a string`);
        stopValidation.add(i);
      }
    }
  }
  
  if (subitemTypes !== DEFAULTS) {
    if (!item.name) {
      errors.push(`${name} name not set`);
    } else if (typeof item.name !== 'string') {
      errors.push(`${name} name must be a string`);
    }
  }

  // level
  if (!stopValidation.has('level') && Object.hasOwn(item, 'level')) {
    if (!validLevel(item.level)) {
      errors.push(`${name} level "${item.level}" invalid`);
    }
  }

  // transports
  if (!stopValidation.has('transport') && Object.hasOwn(item, 'transport')) {
    if (!validTransportName(manager, item.transport)) {
      errors.push(`${name} transport "${item.transport}" invalid`);
    }
  }

  if (Array.isArray(subitemTypes) && subitemTypes.length) {
    const subitemType = subitemTypes.shift();
    if (Object.hasOwn(item, subitemType)) {
      if (Array.isArray(item[subitemType])) {
        for (const subitem of item[subitemType]) {
          errors.push(...validateConfigItem(
            manager,
            `${name}, ${subitemType}:${subitem.name}`,
            subitem,
            subitemTypes
          ));
        }
      }
    }
  }

  return errors;
}

export default validateConfig;
