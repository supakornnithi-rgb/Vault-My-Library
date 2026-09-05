// Usage: node scripts/add-page.mjs path/to/page.json
// page.json: { "title": "...", "tag": "...", "desc": "...", "code": "<html>...</html>" }
import { readFileSync } from 'node:fs';
import { loadConfig, createPage } from './firestore-lib.mjs';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/add-page.mjs path/to/page.json');
  process.exit(1);
}

const config = loadConfig();
const input = JSON.parse(readFileSync(inputPath, 'utf8'));

const result = await createPage(config, input);
console.log('Saved:', result.id, '-', result.title);
