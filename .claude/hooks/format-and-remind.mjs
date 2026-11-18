// PostToolUse hook: prettier-format the edited file and remind about follow-ups
// when domain-critical files change. Never fails the tool call.
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}
const file = input?.tool_input?.file_path ?? '';
if (!file || !existsSync(file)) process.exit(0);

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const rel = path.relative(root, path.resolve(file)).replaceAll('\\', '/');
const ext = path.extname(file);

if (
  ['.ts', '.tsx', '.css', '.json', '.md', '.mjs'].includes(ext) &&
  !rel.startsWith('node_modules/')
) {
  const prettier = path.join(root, 'node_modules', '.bin', 'prettier');
  if (existsSync(prettier))
    spawnSync(prettier, ['--write', '--log-level', 'silent', file], { stdio: 'ignore' });
}

const reminders = [];
if (/^shared\/src\/(deck-rules|deckstring|constants)\.ts$/.test(rel)) {
  reminders.push(
    'Deck rules / deck-code logic changed: run `npm test -w shared` and keep .claude/skills/deck-rules/SKILL.md in sync.',
  );
}
if (/^server\/src\/.*routes\.ts$/.test(rel) || /^shared\/src\/schemas\.ts$/.test(rel)) {
  reminders.push(
    'API surface changed: update docs/API.md, the client hooks in client/src/api, and server/src/__tests__/api.test.ts.',
  );
}
if (/^shared\/src\/constants\.ts$/.test(rel)) {
  reminders.push(
    'If STANDARD_SETS changed, re-run `npm test -w server` (the API tests sample Standard-legal cards).',
  );
}
if (reminders.length) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: reminders.join(' ') },
    }),
  );
}
process.exit(0);
