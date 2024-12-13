'use strict';

import { validLevel } from "./levels.js";

const validHttpMethods = [
  'DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'
];

const DEFAULTS = Symbol('DEFAULTS');

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

  if (Object.hasOwn(manager.config, 'defaults')) {
    errors.push(...validateConfigItem(
      manager,
      '[defaults]',
      manager.config.defaults,
      DEFAULTS
    ));
  } else {
    errors.push('Config must have a defaults section');
  }


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
