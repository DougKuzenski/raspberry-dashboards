import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MANUAL_DIR } from '../src/server/paths.js';
import { validateManualFile, DataValidationError } from '../src/server/providers/validate.js';

// Validate data/manual/events.json without starting the server.
async function main() {
  const file = path.join(MANUAL_DIR, 'events.json');
  try {
    const data = validateManualFile(JSON.parse(await readFile(file, 'utf8')));
    console.log(`✓ events.json — ${data.sources.length} sources, ${data.events.length} events`);
    console.log('Manual data is valid.');
  } catch (err) {
    if (err instanceof DataValidationError) console.error(`✗ ${err.message}`);
    else console.error(err);
    process.exit(1);
  }
}

main();
