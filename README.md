# aggregate-commands

Run a bunch of commands in a single process and log them apart. It has been essentially developed for being used in a [npm script](https://docs.npmjs.com/misc/scripts), instead of `command1 & command2 & command 3`.

## Globally

Install

```sh
npm install -g aggregate-commands
```

Usage

```sh
aggregate-commands /path/to/commands-file.json
```

or

```sh
aggregate-commands key
```

where key is declared in a `aggregate-commands` object of `package.json`

## In a npm script

Install as dev dependency

## ```sh
```

Use in a script (in your `package.json`)

```json
{
  "scripts": {
    "my-script": "aggregate-commands commands-file.json"
  }
}
```

## Commands format

The command file is a collection of commands, each command being defined by a "command key" used for output, and the command to run.

### Short format

You can declare your commands as an object of string, as a more compact format:

```json
{
  "js": "npm run build-js",
  "hello": "echo hello"
}
```

All commands are run concurrently, if any command **fails** the global execution is terminated with a non-zero status code.

If your command has parameters with whitespace, you **cannot use this format**. For example, ``{ "commit": "git commit -m 'commit message'" }`` will try to execute ``git commit -m "'commit" "message'"``, which is absolutely wrong.

### Whitespace in parameters: longer format

You can declare your command as an array, each part being a parameter of your command. Everything will be escaped transparently:

```json
{
  "hello-world": ["echo", "hello, world"],
  "commit": ["git", "commit", "-m", "commit message"]
}
```

### Fine-grained flow control: full format

The full format (originally the only one supported) lets you control the way you react to the end of any command. In this case the commands are an array of arrays, each one having the following members:

* (optional) is the command required?
  * `true` the master will exit as soon as this command dies (normally or not)
  * `false` the master will ignore death of this command (normal or not)
  * otherwise (set to `null` if you want to be explicit) default behavior for the master is to exit if command dies with non-0 exit code
* (required) the command key, used for logging
* (required) the command's main binary
* (optional) the rest of the array are command's arguments

Example:

```json
[
  [ null,   "logger1",  "node", "-e", "console.log('I exit (code = 0) just after my work, but master won\\'t care')" ],
  [ true,   "required", "node", "-e", "console.log('I die (code ≠ 0) in 2 seconds and that will kill master'); setTimeout(process.exit.bind(process, 14), 2000)" ],
  [ false,  "ignored",  "node", "-e", "console.log('I die (code ≠ 0) in 1.5 seconds but matster won\\'t care'); setTimeout(process.exit.bind(process, 16), 1500)" ],
  [ null,   "logger2",  "node", "-e", "console.log('I die (code = 0) in 2.5 seconds but I\\'ll be killed first'); setTimeout(process.exit.bind(process, 0), 2500)" ]
]
```

This sample command file will produce following output:

```
2014-11-19 22:46:13 [logger1 ] I exit (code = 0) just after my work, but master won't care
2014-11-19 22:46:13 [ignored ] I die (code ≠ 0) in 1.5 seconds but matster won't care
2014-11-19 22:46:13 [logger1 ] Terminated with code 0
2014-11-19 22:46:13 [logger2 ] I die (code = 0) in 2.5 seconds but I'll be killed first
2014-11-19 22:46:13 [required] I die (code ≠ 0) in 2 seconds and that will kill master
2014-11-19 22:46:15 [ignored ] Terminated with code 16
2014-11-19 22:46:15 [required] Terminated with code 14
2014-11-19 22:46:15 Terminated by previous command, killing remaining processes…
2014-11-19 22:46:15 [logger2 ] Terminated with code 143
```

Note: You can declare your commands file as JSON (`.json`) or plain Node module (`.js`, don't forget `module.exports = …`) if you want to add comments

### Declare commands in package.json

If you don't want to use a separate file, you can embed your commands descriptor in `package.json` under the `aggregate-commands` key:

```js
{
  "aggregate-commands": {
    "my-commands": … // Your commands go here
  }
}
```

Simply run `aggregate-commands my-commands` and it will use this configuration.

## Why not using simply "command1 & command2"?

* If `command1` fails, it won't fail the whole script
* If `command2` ends, `command1` stays in background (possibly forever, meaning you'll have to `ps` and `kill` it)
* You cannot distinguish outputs and logs get all mixed up

It's better to have a single master process, but it's a pain to write, so here it's already done.

## Real life example

Your `package.json`:

```json
{
  "devDependencies": {
    "aggregate-commands": "^1.0.0",
    …
  },
  "scripts": {
    "watch-css": "the script that watches and compiles your CSS",
    "watch-templates": "the script that watches and compiles your HTML templates",
    "watch-js": "the watchify command building your JS",
    "watch": "aggregate-commands watch"
  },
  "aggregate-commands": {
    "watch": [
      ["css",  "npm", "run", "watch-css"],
      ["tpls", "npm", "run", "watch-templates"],
      ["js",   "npm", "run", "watch-js"]
    ]
  }
}
```

## Known limitations

* Some tools could disable colors because of no ``tty``, if they don't provide an options to force them, well that sucks
* Tools run this way cannot read stdin (i.e. you can't type ``rs`` to restart your server using ``nodemon``)
