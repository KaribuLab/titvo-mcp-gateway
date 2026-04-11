const http = require('http');
function logFail(message) {
  const line = `${new Date().toISOString()} [HEALTHCHECK][FAIL] ${message}\n`;
  try {
    process.stderr.write(line);
  } catch (_) {
    process.stdout.write(line);
  }
}
const req = http.get('http://127.0.0.1:3000/health', (res) => {
  if (res.statusCode === 200) {
    process.exit(0);
    return;
  }
  logFail(`status=${res.statusCode}`);
  process.exit(1);
});
req.on('error', (e) => {
  logFail(`error=${e.message}`);
  process.exit(1);
});
req.setTimeout(4000, () => {
  logFail('timeout');
  req.destroy();
  process.exit(1);
});