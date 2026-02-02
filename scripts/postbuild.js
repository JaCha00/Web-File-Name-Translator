import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distPath = join(__dirname, '..', 'dist', 'index.html');

let html = readFileSync(distPath, 'utf-8');

// Remove type="module" and crossorigin to allow file:// protocol
html = html.replace(/<script type="module" crossorigin>/g, '<script>');

writeFileSync(distPath, html, 'utf-8');

console.log('Postbuild: Converted module script to regular script for file:// protocol support');
