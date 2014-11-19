"use strict";

var path = require("path");
var spawn = require("child_process").spawn;
var assert = require("assert");
var fs = require("fs");


process.chdir(path.dirname(__filename));

var expected_out = fs.readFileSync("./stdout.txt", "utf8").trim();
var expected_err = fs.readFileSync("./stderr.txt", "utf8").trim();

function prepare (output) {
  return output.trim().replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/gm, "****-**-** **:**:**");
}

function compare (stream, expected) {
  var str = "";
  stream.on("data", function (chunk) {
    str += chunk.toString("utf8");
  });
  stream.on("end", function () {
    assert.equal(prepare(str), expected);
  });
}

var proc = spawn("node", [path.resolve("../bin/aggregate-commands"), "./commands"]);

compare(proc.stdout, expected_out);
compare(proc.stderr, expected_err);

proc.on("exit", function (code) {
  assert.equal(code, 5, "should exit with code 5");
});
