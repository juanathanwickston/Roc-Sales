/**
 * Cross-platform JavaScript syntax checker.
 * Recursively finds .js files under server/ and public/js/,
 * runs `node --check` on each, and exits nonzero on any syntax error.
 *
 * Used by: npm run ai:verify
 */

const { execSync } = require('child_process');
const { readdirSync, statSync } = require('fs');
const { join, resolve } = require('path');

const ROOT = resolve(__dirname, '..');
const DIRS = ['server', join('public', 'js')];

function findJsFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      results.push(...findJsFiles(full));
    } else if (entry.endsWith('.js')) {
      results.push(full);
    }
  }
  return results;
}

let files = [];
for (const dir of DIRS) {
  files.push(...findJsFiles(join(ROOT, dir)));
}

if (files.length === 0) {
  console.error('[ai:verify] No .js files found to check.');
  process.exit(1);
}

console.log(`[ai:verify] Checking ${files.length} JavaScript files...`);

let errors = 0;
for (const file of files) {
  try {
    execSync(`node --check "${file}"`, { stdio: 'pipe' });
  } catch (err) {
    errors++;
    console.error(`\n  SYNTAX ERROR: ${file}`);
    console.error(`  ${err.stderr.toString().trim()}`);
  }
}

if (errors > 0) {
  console.error(`\n[ai:verify] FAILED — ${errors} file(s) with syntax errors.`);
  process.exit(1);
} else {
  console.log(`[ai:verify] PASSED — ${files.length} files, zero syntax errors.`);
}
