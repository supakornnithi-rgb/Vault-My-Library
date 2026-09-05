// Usage: node scripts/bulk-import.mjs path/to/export.json
// export.json: array of { id, title, tag, desc, code, createdAt } — the exact
// shape the OLD localStorage-based html-vault.html used to store under the
// key "htmlvault_v2" (createdAt as epoch milliseconds).
import { readFileSync } from 'node:fs';
import { loadConfig, createPage } from './firestore-lib.mjs';

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node scripts/bulk-import.mjs path/to/export.json');
  process.exit(1);
}

const config = loadConfig();
const items = JSON.parse(readFileSync(inputPath, 'utf8'));

if (!Array.isArray(items)) {
  console.error('Expected a JSON array of pages.');
  process.exit(1);
}

for (const item of items) {
  try {
    const result = await createPage(config, item);
    console.log('OK  ', result.id, '-', result.title);
  } catch (err) {
    console.error('FAIL', item.title, '-', err.message);
  }
}
