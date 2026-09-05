import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function loadConfig() {
  const path = join(__dirname, '..', '.vault-admin-config.local.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

function baseUrl(config) {
  return `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents`;
}

// Creates a "pages" document the same way the app itself does: an
// auto-generated Firestore document ID, mirrored into the "id" field.
export async function createPage(config, { title, tag = '', desc = '', code, createdAt }) {
  if (!title || !code) throw new Error('title and code are required');

  const createRes = await fetch(`${baseUrl(config)}/pages?key=${config.apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fields: {
        title: { stringValue: title },
        tag: { stringValue: tag },
        desc: { stringValue: desc },
        code: { stringValue: code },
        createdAt: { timestampValue: new Date(createdAt || Date.now()).toISOString() }
      }
    })
  });
  const created = await createRes.json();
  if (!createRes.ok) throw new Error('Create failed: ' + JSON.stringify(created));

  const docId = created.name.split('/').pop();

  const patchRes = await fetch(`${baseUrl(config)}/pages/${docId}?updateMask.fieldPaths=id&key=${config.apiKey}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { id: { stringValue: docId } } })
  });
  const patched = await patchRes.json();
  if (!patchRes.ok) throw new Error('Set id field failed: ' + JSON.stringify(patched));

  return { id: docId, title, tag, desc };
}
