import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const outDir = path.join(root, 'release');
fs.mkdirSync(outDir, { recursive: true });

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed`);
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const appTar = path.join(outDir, `moodwave-v${pkg.version}.tar.gz`);
const pluginZip = path.join(outDir, 'moodwave-deck-companion.zip');
const installer = path.join(outDir, 'install-moodwave.sh');

run('tar', [
  '--exclude=node_modules',
  '--exclude=.git',
  '--exclude=data',
  '--exclude=dist',
  '--exclude=release',
  '-czf',
  appTar,
  '-C',
  root,
  '.'
]);

fs.copyFileSync(path.join(root, 'scripts', 'install-steamdeck.sh'), installer);
fs.chmodSync(installer, 0o755);

if (fs.existsSync(path.join(root, 'deck-companion'))) {
  run('npm', ['install'], { cwd: path.join(root, 'deck-companion') });
  run('npm', ['run', 'build'], { cwd: path.join(root, 'deck-companion') });
  run('zip', ['-qr', pluginZip, 'deck-companion', '-x', 'deck-companion/node_modules/*'], { cwd: root });
}

const checksumFiles = [appTar, installer, pluginZip].filter((file) => fs.existsSync(file));
const checksum = spawnSync('shasum', ['-a', '256', ...checksumFiles], { encoding: 'utf8' });
if (checksum.status === 0) {
  fs.writeFileSync(path.join(outDir, 'checksums.txt'), checksum.stdout);
}

console.log(`Release files written to ${outDir}`);
