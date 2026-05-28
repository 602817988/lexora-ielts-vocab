import { spawn } from 'node:child_process';

const processes = [
  spawn('node', ['server.mjs'], { stdio: 'inherit' }),
  spawn('npx', ['vite', '--host', '0.0.0.0'], { stdio: 'inherit' }),
];

function shutdown(signal) {
  for (const child of processes) {
    child.kill(signal);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

for (const child of processes) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      shutdown('SIGTERM');
      process.exit(code);
    }
  });
}
