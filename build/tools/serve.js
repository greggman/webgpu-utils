import {spawn} from 'child_process';

spawn('npm', [
  'run',
  'watch',
], {
  shell: true,
  stdio: 'inherit',
});

spawn('./node_modules/.bin/servez', [
], {
  shell: true,
  stdio: 'inherit',
});

