'use strict';

const FAULT='fault';
const ERROR='error';
const WARN='warn';
const INFO='info';
const VERBOSE='verbose';
const DEBUG='debug';
const TRACE='trace';

const logLevels = [ FAULT, ERROR, WARN, INFO, VERBOSE, DEBUG, TRACE ];

const ansiColors = {
  fault: '\x1b[1;101;97m',
  error:  '\x1b[1;41;97m',
  warn:  '\x1b[1;104;97m',
  info:        '\x1b[92m',
  verbose:     '\x1b[94m',
  debug:       '\x1b[94m',
  trace:               ''
};

const textTags = {
  fault:   '[*FAULT*]',
  error:   '[ ERROR ]',
  warn:    '[  warn ]',
  info:    '[   info]',
  verbose: '[    vrb]',
  debug:   '[     db]',
  trace:   '[      t]'
};

const levels = [];
for (const level of logLevels) {
  const levelObject = {
    name: level,
    level: levels.length,
    prefix: {
      ansiText: `${ansiColors[level]}${textTags[level]}\x1b[m`,
      text: textTags[level]
    }
  };
  levels.push(levelObject);
  levels[level] = levelObject;
}

function validLevel(level) {
  return !! levels[level];
}

export default levels;
export {
  levels, FAULT, ERROR, WARN, INFO, VERBOSE, DEBUG, TRACE, validLevel
}
