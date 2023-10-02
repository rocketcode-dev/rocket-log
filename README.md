# RocketLog: the official RocketCode Logger

Flexible and externally-configurable and redactable logging engine with these great features:

- Finely configurable, to the method level. Different methods can have different logging levels.
- Easily mark text in your logs as redactable with `%<` and `%>` so they can be excluded from logs by enabling a configuration.
- Logs can be output in several formats: `text`, `ansi-text` (text coloured for readability), and `json`, and can be routed to transports `console`, `stream`, `file` or `group` (any combination of transports).

## Configuration

### Log Levels

| Level | Name | Description
| --- | --- | ---
| 0 | `FAULT` | Application errors, especially those that could cause the application to exit, such as misconfiguration or unhandled exceptions.
| 1 | `ERROR` | Runtime errors that would make a task impossible, such as invalid inputs or downstream errors.
| 2 | `WARN` | Conditions that don't look right and could indicate or cause problems.
| 3 | `INFO` | Informational logging that would be useful to have in production.
| 4 | `VERBOSE` | Additional logging that would be useful for diagnosing problems with production or development apps, but not as noisy as `DEBUG`.
| 5 | `DEBUG` | Detailed information about objects, useful for solving bugs
| 6 | `TRACE` | Most detailed information, and comes with stack traces.

## Style guide

This section is a purely a suggestion. This logging engine will not break if you choose not to follow these conventions, nor will it enforce them, but they will allow a more usable log.

- Expect production apps to have their maximum logging level set to `info`. Excessive logging to `info` and lower (`fault` is lowest, `trace` is highest) will affect the performance of production applications.
- Each log entry to `verbose` or higher should fit into a single line.
  - `fault`, `error`, and `warn` lines should be a single log with additional information added with `info` log.
  - Each `info` log should be a single line, but many info logs can be used together to explain a single issue.
  - `verbose` is typically of development and debugging interest.
- `verbose` and `trace` logs can take multiple lines, such as stringifications of complex objects
- If you choose to use this logging engine in a package, such as `npm` module names should be prefixed `<package_name>/<module>`
