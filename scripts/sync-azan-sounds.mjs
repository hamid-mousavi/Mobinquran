import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve('public/audio/azan');
const DEST_DIR = path.resolve('android/app/src/main/res/raw');

if (!fs.existsSync(DEST_DIR)) {
  fs.mkdirSync(DEST_DIR, { recursive: true });
}

if (!fs.existsSync(SRC_DIR)) {
  console.log(`Source directory not found: ${SRC_DIR}`);
  process.exit(0);
}

const files = fs.readdirSync(SRC_DIR);
let count = 0;

for (const file of files) {
  if (!file.endsWith('.mp3')) continue;
  
  // Android raw resource names must be lowercase letters, numbers, and underscores only
  const baseName = path.basename(file, '.mp3').toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const targetFileName = baseName.startsWith('azan_') ? `${baseName}.mp3` : `azan_${baseName}.mp3`;
  
  const srcFile = path.join(SRC_DIR, file);
  const destFile = path.join(DEST_DIR, targetFileName);
  
  fs.copyFileSync(srcFile, destFile);
  count++;
  console.log(`Copied ${file} -> raw/${targetFileName}`);
}

console.log(`Synced ${count} azan audio files to Android res/raw successfully.`);
