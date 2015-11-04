var delay = Number(process.argv[2]);
var status = Number(process.argv[3]);

setTimeout(function () {
  console.log("Exit %s after %s ms", status, delay);
  process.exit(status);
}, delay);
