// PreToolUse hook: block hand edits to generated or sensitive files.
// Receives the tool call as JSON on stdin; exits 0 with a JSON decision.
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PROTECTED = [
  {
    test: (p) => /(^|\/)server\/data\/(cards|heroes|meta)\.json$/.test(p),
    why: 'server/data/*.json is generated. Run `npm run seed:cards` (or the /refresh-cards skill) instead of editing it.',
  },
  {
    test: (p) => /(^|\/)package-lock\.json$/.test(p),
    why: 'package-lock.json is managed by npm. Change package.json and run `npm install`.',
  },
  {
    test: (p) => /(^|\/)\.env$/.test(p),
    why: 'Do not write secrets into .env; update .env.example and tell the user.',
  },
];

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  process.exit(0);
}
const file = input?.tool_input?.file_path ?? input?.tool_input?.path ?? '';
if (!file) process.exit(0);
const rel = path
  .relative(process.env.CLAUDE_PROJECT_DIR ?? process.cwd(), path.resolve(file))
  .replaceAll('\\', '/');

const hit = PROTECTED.find((rule) => rule.test(rel));
if (hit) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason: `Blocked edit to ${rel}: ${hit.why}`,
      },
    }),
  );
}
process.exit(0);
