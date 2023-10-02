# Cap'n Log: the official RocketCode Logger

Flexible and externally-configurable and redactable logging engine with these great features:

- Finely configurable, to the method level. Different methods can have different logging levels.
- Easily mark text in your logs as redactable with `%<` and `%>` so they can be excluded from logs by enabling a configuration.
- Logs can be output in several formats: `text`, `ansi-text` (text coloured for readability), and `json`, and can be routed to transports `console`, `stream`, `file` or `group` (any combination of transports).
- No external dependencies.

## Configuration

This doesn't have a configuration file _per se_ but a configuration object. This would normally be a part of you project's larger configuration file. If your file were in, for example, JSON or YAML format, it could be parsed into an object this would accept that configuration and use its part.

All configurations are under `debug.logging`.

### Sections

#### `defaults` (required)

This section specifies the default values for modules, methods, and paths that are not listed in this configuration. There are two configs here:

- `debug.logging.defaults.transport` the name of the default transport
- `debug.logging.defaults.level` the default log level

#### `transports` (optional)

(_Default: logging ansi text to console_)

This section specifies the configuration for each type of transport. Transports have these members:

- `name` the name of the transport.
- `type` the type of transport. Default `console`. Right now only `console` is supported. Future versions may include `file`, `stream`, `http-post`, `mq`, etc but `console` will always be the default.
- `format` format for output. `json`, `text`, or `ansi-text`. Default: `ansi-text`. The `text` format is plain text but the `ansi-text` format uses ansi codes to colour-highlight text in a terminal. JSON outputs one complete JSON object per log entry.
- `showSensitive` whether or not to show sensitive information. If this is set to `false`, it'll replace all the information marked sensitive with `[redacted]`. Sensitive text may be highlighed if `showSensitive` is set to `true`. If using `ansi-text` format, sensitive text will be underlined. Default value is `false`.

#### `modules` (optional)

This section provides specific configurations for modules, methods, and paths. By default, this section is an empty array, which implies everything logged using the default settings.

Each element in the `modules` array is an object with:

- `name` the name of the module
- `transport` (optional) the transport to use for this module, if you want to use a different transport from that specified in the `defaults` section.
- `level` (optional) the log level to use for this module, if you wan to use a different level from that specified in the `defaults` section.
- `methods` (optional) method-specific configurations, if you want to give single methods different logging levels or transports. In this context, a method can be a JavaScript method or an HTTP method. The `methods` array has a similar format, except if it's an HTTP method, it'll also have a `paths` config, which can be used to give single paths different logging levels or transports.

## Usage

A simple example of loading the config and then logging in a method.

```javascript
import logger from `capn-log`;

const MODULE = 'myModule';

// Set the configuration. The JSON.parse bit is just an example.
logger.config = JSON.parse(fs.readFileSync('configFile.json').toString());

function myMethod(param1, param2) {
  const log = logger(MODULE, myModule);

  // the %< and %> mark the second parameter as sensitive
  log.debug('Called with params (%s, %<%s%>)', param1, param2);
}
```

### APIs

#### `logger.config` setter that sets the logger configuration

Before this setter is called, it's assumed that all logs at level `info` or lower should be written to `console` in `ansi-text` format, with text marked as sensitive redacted.

```javascript
logger.config = JSON.parse(
  fs.readFileSync('configFile.json').toString()
);
```

#### `logger(module, method, [path])` gets a logger

Creates or gets a logger for a `module` and `method`. A method can be a JavaScript method or an HTTP method. If `method` is an HTTP method, include a third parameter for `path`. `method` can be a named (i.e. not anonymous) function or a `string`.

```javascript
function myFunction() {
  const log = logger('myModule', myFunction);
  // [stuff]
}

function myFunction() {
  const log = logger('myModule', 'myFunction');
  // [stuff]
}

router.get('/mypath', (req, res, next) => {
  const log = logger('myRoute', 'GET', '/mypath');
  // [stuff]
});
```

#### `fault`, `error`, `warn`, `info`, `verbose`, `debug`, `trace`

Log to the different levels. The logs are filtered based on level and the level is indicated in the log. The parameters are similar to `util.format` (and, hence, `console.log`) with a few differences:

- `%<` and `%>` -- mark a section of text as sensitive. Anything between these marks will be redacted unless `showSensitive` is set to `true` for the transport.
- `%s` substitute a `string` parameter here
- `%d` substitute a `number` parameter here
- `%%` print `%`

```javascript
function myFunction() {
  const log = logger('myModule', myFunction);

  log.info('Called with %s at %d%%', 'string param', 100);
  // '[   info] myModule.myFunction: Called with string param at 100%'
}
```

## Style guide

This section is a purely a suggestion. This logging engine will not break if you choose not to follow these conventions, nor will it enforce them, but they will allow a more usable log.

- Expect production apps to have their maximum logging level set to `info`. Excessive logging to `info` and lower (`fault` is lowest, `trace` is highest) will affect the performance of production applications and make the logs less useful.
- Each log entry to `verbose` or higher should fit into a single line.
  - `fault`, `error`, and `warn` lines should be a single log with additional information added with `info` log.
  - Each `info` log should be a single line, but many info logs can be used together to explain a single issue.
  - `verbose` is typically of development and debugging interest.
- `verbose` and `trace` logs can take multiple lines, such as stringifications of complex objects
- If you choose to use this logging engine in a package, such as `npm` module names should be prefixed `<package_name>/<module>`

### Log Levels

| Level | Name | Description
| --- | --- | ---
| 0 | `FAULT` | Application errors, especially those that could cause the application to exit in error, such as misconfiguration or unhandled exceptions.
| 1 | `ERROR` | Runtime errors that would make a task impossible, such as invalid inputs or downstream errors.
| 2 | `WARN` | Conditions that don't look right and could indicate or cause problems.
| 3 | `INFO` | Informational logging that would be useful to have in production.
| 4 | `VERBOSE` | Additional logging that would be useful for diagnosing problems with production or development apps, but not as noisy as `DEBUG`.
| 5 | `DEBUG` | Detailed information about objects, useful for solving bugs
| 6 | `TRACE` | Most detailed information, and comes with stack traces.
