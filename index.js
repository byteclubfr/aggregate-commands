"use strict";

var path = require("path");
var spawn = require("child_process").spawn;

var interrupted = false;


// Pad a date item (1 or 2 chars)
function datePad (str) {
  if (str.length < 2) {
    str = "0" + str;
  }

  return str;
}

// String for current time
function now () {
  var d = new Date();

  var YYYY = String(d.getFullYear());
  var MM = datePad(String(d.getMonth() + 1));
  var DD = datePad(String(d.getDate()));
  var hh = datePad(String(d.getHours()));
  var mm = datePad(String(d.getMinutes()));
  var ss = datePad(String(d.getSeconds()));

  return YYYY + "-" + MM + "-" + DD + " " + hh + ":" + mm + ":" + ss;
}

// Logger for "data" event handler
function log (out, key) {
  return function (message) {
    out.write(now() + " [" + key + "] " + String(message).trimRight() + "\n");
  };
}

// Last process ended was supposed to end myself
function interrupt (processes, success) {
  // If I'm already interrupted by previous finished command, do not recurse
  if (interrupted) {
    return;
  }
  interrupted = true;

  // Get remaining processes
  var remaining = processes.filter(function (proc) {
    return proc.exitCode === null && proc.signalCode === null;
  });

  function done () {
    process.exit(success ? 0 : 5);
  }

  // Kill remaining processes
  if (remaining.length === 0) {
    done();
    return;
  }

  (success ? process.stdout : process.stderr).write(now() + " Terminated by previous command, killing remaining processes…\n");

  var waiting = remaining.length;

  remaining.forEach(function (proc) {
    proc.kill();
    proc.on("exit", function () {
      waiting--;
      if (waiting === 0) {
        done();
      }
    });
  });
}

// Handler for when a command finishes
function exit (processes, required, key) {
  return function (code, signal) {
    var success, reason;
    if (typeof code === "number") {
      // Program finished normally
      success = (code === 0);
      reason = "Terminated with code " + code;
    } else if (signal) {
      // Program was killed by parent (should not happen, I'm the parent, I should know)
      success = false;
      reason = "Killed with signal '" + signal + "'";
    } else if (code) {
      // Error
      success = false;
      reason = "Failed (" + String(code) + ")";
    } else {
      // No parameter at all, I guess it's a success then
      success = true;
      reason = "Terminated with no information";
    }

    log(success ? process.stdout : process.stderr, key)(reason);

    // If command was required, or failed and not "unrequired", then exit main process
    if (required === true || (required !== false && !success)) {
      interrupt(processes, success);
    }
  };
}

// Spawn process and log its output
function spawnAndLog (processes) {
  return function (command) {
    var required = command[0];
    var key = command[1];
    var bin = command[2];
    var args = command.slice(3);

    var proc = spawn(bin, args);

    proc.key = key;
    processes.push(proc);

    proc.stdout.on("data", log(process.stdout, key));
    proc.stderr.on("data", log(process.stderr, key));

    var onExit = exit(processes, required, key);
    proc.on("error", onExit);
    proc.on("exit", onExit);

    return proc;
  };
}

// Show error
function error (str, code) {
  console.error(str);
  process.exit(code || 1);
}

// Attempt to read aggregate-commands key from package.json
function getCommandsFromPackage (key) {
  key = path.basename(key);
  var pkg;

  try {
    pkg = require(path.resolve("package.json"));
    return pkg["aggregate-commands"][key];
  } catch (e) {
    // no explicit error to allow fallback on config file
    return null;
  }
}

// Grab from external configuration file
function getCommandsFromConfigFile (file) {
  if (!file.match(/\./)) {
    file += ".json";
  }
  try {
    return require(path.resolve(file));
  } catch (e) {
    if (e.code === "ENOENT") {
      error("Could not find config file '" + file + "'", 2);
    } else {
      error("Failed loading config file '" + file + "' (" + String(e) + ")", 2);
    }
  }
}

// Convert commands format
// from { label: "the command" } or { label: ["the", "command"] }
// into [ label, "the", "command" ]
function buildCommandsFromObject (commands) {
  return Object.keys(commands).map(function (key) {
    var command = commands[key];
    if (!Array.isArray(command)) {
      command = command.split(/\s+/);
    }
    return [key].concat(command);
  });
}

// Load commands
function main (file) {

  // Read from package.json then fallback on dedicated file
  var commands = getCommandsFromPackage(file);
  if (!commands) {
    commands = getCommandsFromConfigFile(file);
  }

  // Check commands
  if (!Array.isArray(commands) && typeof commands === "object") {
    commands = buildCommandsFromObject(commands);
  }
  if (!Array.isArray(commands)) {
    error("Invalid config : array expected");
  }
  commands.forEach(function (command, i) {
    if (!Array.isArray(command)) {
      error("Invalid config (item #" + i + "): array expected");
    }
    if (command.length < 2) {
      error("Invalid config (item #" + i + "): at least 2 elements expected");
    }
  });

  // Insert "required" directive default value where missing
  commands.forEach(function (command) {
    if (typeof command[0] === "string") {
      command.unshift(null);
    }
  });

  // Pad keys
  var keyLen = 0;
  commands.forEach(function (command) {
    keyLen = Math.max(keyLen, command[1].length);
  });
  commands.forEach(function (command) {
    while (command[1].length < keyLen) {
      command[1] += " ";
    }
  });

  // Run commands
  commands.forEach(spawnAndLog([], []));
}


module.exports = {
  "main": main,
  "error": error,
  "log": log
};
