/**
 * Generates src/generated/changelog.json from the git history so the in-app
 * "What's New" page reflects every change. Runs automatically before dev/build
 * (see package.json prebuild/predev), so each deploy — which happens on every
 * push — republishes an up-to-date changelog pulled straight from the commits.
 *
 * The repo is private, so we cannot read commits from the browser without
 * shipping a token; generating at build time keeps the changelog live and
 * secure.
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'src', 'generated');
const outFile = join(outDir, 'changelog.json');

const SEP = '\x1f';
let raw = '';
try {
  raw = execSync(`git log -200 --no-merges --pretty=format:%H${SEP}%aI${SEP}%s`, {
    encoding: 'utf8',
    cwd: root,
  });
} catch {
  raw = '';
}

const versionRe = /\(v(\d+\.\d+)\)/; // matches "(v0.17)" anywhere
const trailingParenRe = /\s*\([^)]*v\d+\.\d+[^)]*\)\s*$/; // trailing "(…v0.17)" to strip

const entries = raw
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    const [hash, date, subject = ''] = line.split(SEP);
    const versionMatch = subject.match(versionRe);
    return {
      hash: (hash ?? '').slice(0, 7),
      date,
      version: versionMatch ? versionMatch[1] : null,
      subject: subject.replace(trailingParenRe, '').trim(),
    };
  })
  // Drop internal/no-op commits that aren't meaningful to end users.
  .filter((e) => e.subject && !/^Initial commit/i.test(e.subject));

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, `${JSON.stringify(entries, null, 2)}\n`);
console.log(`changelog: ${entries.length} entries → ${outFile}`);
