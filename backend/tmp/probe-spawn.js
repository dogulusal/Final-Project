const { spawnSync } = require('child_process');
const path = require('path');

const backend = path.resolve(__dirname, '..');
const log = path.join(backend, 'ablation-probe.log');
const cmd = `npx ts-node --project tsconfig.scripts.json src/scripts/debug-ml.ts > "${log}" 2>&1`;

const run = spawnSync('cmd.exe', ['/d', '/s', '/c', cmd], {
  cwd: backend,
  encoding: 'utf8',
});

console.log(JSON.stringify({
  status: run.status,
  signal: run.signal,
  error: run.error ? run.error.message : null,
  stdout: (run.stdout || '').slice(0, 500),
  stderr: (run.stderr || '').slice(0, 500),
}, null, 2));
