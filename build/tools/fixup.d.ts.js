import fs from 'fs';
import path from 'path';
import * as url from 'url';

const dirname = url.fileURLToPath(new URL('.', import.meta.url));
const readTextFile = n => fs.readFileSync(n, {encoding: 'utf-8'});

const pkg = JSON.parse(readTextFile(path.join(dirname, '..', '..', 'package.json')));
const majorVersion = pkg.version.split('.')[0];

const dtsFilename = path.join(dirname, '..', '..', 'dist', `${majorVersion}.x`, 'buffer-views.d.ts');
const s = readTextFile(dtsFilename);
const newS = s.replace(
  /export\s+type\s+ArrayBufferViews\s+=\s+{\s+views:\s+TypedArrayOrViews;/m,
  `export type ArrayBufferViews = {
    views: any; // because otherwise this is too much of a PITA to use in typescript`);
console.assert(s !== newS, `fixup failed: did you build first?\n`);
fs.writeFileSync(dtsFilename, newS);
