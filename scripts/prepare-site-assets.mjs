import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptsDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptsDirectory, '..');
const assetsDirectory = resolve(projectDirectory, 'site', 'assets');

await mkdir(assetsDirectory, { recursive: true });
await Promise.all([
    copyFile(resolve(projectDirectory, 'images', 'icon.png'), resolve(assetsDirectory, 'icon.png')),
    copyFile(resolve(projectDirectory, 'images', 'demo.gif'), resolve(assetsDirectory, 'demo.gif')),
]);
