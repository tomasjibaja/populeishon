// Levanta la API y la web a la vez, con la salida de cada una identificada. Ctrl+C detiene ambas.
import { spawn } from 'node:child_process';

const tasks = [
  { name: 'api', args: ['run', 'dev', '-w', '@partituras/api'] },
  { name: 'web', args: ['run', 'dev', '-w', '@partituras/web'] },
];

const children = tasks.map(({ name, args }) => {
  const child = spawn('npm', args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  const prefix = (stream, out) => {
    let pending = '';
    stream.on('data', (chunk) => {
      const lines = (pending + chunk.toString()).split('\n');
      pending = lines.pop() ?? '';
      for (const line of lines) out.write(`[${name}] ${line}\n`);
    });
  };
  prefix(child.stdout, process.stdout);
  prefix(child.stderr, process.stderr);
  child.on('exit', (code) => {
    console.log(`[${name}] terminó (código ${code ?? 'señal'}).`);
    stopAll();
  });
  return child;
});

let stopping = false;
function stopAll() {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill('SIGTERM');
  setTimeout(() => process.exit(), 500);
}
process.on('SIGINT', stopAll);
process.on('SIGTERM', stopAll);
