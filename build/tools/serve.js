import {spawn} from 'child_process';

spawn('npm', [
  'run',
  'watch',
], {
  shell: true,
  stdio: 'inherit',
});

spawn('npm', [
  'run',
  'serve',
], {
  shell: true,
  stdio: 'inherit',
});

