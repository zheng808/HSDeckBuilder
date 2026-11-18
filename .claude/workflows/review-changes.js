export const meta = {
  name: 'review-changes',
  description:
    'Review changed files across deck-rules, API-contract, UI/a11y and type-safety dimensions, then adversarially verify each finding',
  whenToUse: 'After a feature or refactor touching several workspaces, before a commit or PR',
  phases: [
    { title: 'Review', detail: 'one reviewer per dimension' },
    { title: 'Verify', detail: 'two skeptics per finding; keep what survives' },
  ],
};

const scope =
  args && args.files
    ? `Limit yourself to these files: ${args.files.join(', ')}.`
    : 'Use `git diff --name-only` (or, without git, the most recently modified files under shared/, server/, client/) to find what changed.';

const DIMENSIONS = [
  {
    key: 'deck-rules',
    prompt: `Review deck-legality correctness. ${scope} Read .claude/skills/deck-rules/SKILL.md for the rules of record. Look for decks the code accepts but the game rejects (and vice versa), reprint/copy-limit mistakes, rune-limit mistakes, Standard/Wild mix-ups, and deck-code encoding errors.`,
  },
  {
    key: 'api-contract',
    prompt: `Review the HTTP API against docs/API.md. ${scope} Check status codes, error envelope { error: { code, message, issues? } }, ownership rules (401/403/404 behaviour for drafts), validation via shared zod schemas, and that server tests cover each change.`,
  },
  {
    key: 'ui',
    prompt: `Review client/ changes for accessibility and state discipline per .claude/rules/client.md. ${scope} Flag colour-only signals, non-button clickables, fetch outside src/api, deck limits re-implemented outside @hsdeck/shared, and ManaCurve violations of the dataviz rules.`,
  },
  {
    key: 'types-tests',
    prompt: `Run \`npm run typecheck\` and \`npm test\` from the repo root and review test quality for the changed files. ${scope} Report type errors, failing tests, untested branches, and tests that cannot fail.`,
  },
];

const FINDINGS_SCHEMA = {
  type: 'object',
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'number' },
          severity: { type: 'string', enum: ['high', 'medium', 'low'] },
          detail: { type: 'string' },
          fix: { type: 'string' },
        },
        required: ['title', 'file', 'severity', 'detail'],
      },
    },
  },
  required: ['findings'],
};

const VERDICT_SCHEMA = {
  type: 'object',
  properties: { refuted: { type: 'boolean' }, reason: { type: 'string' } },
  required: ['refuted', 'reason'],
};

const results = await pipeline(
  DIMENSIONS,
  (d) =>
    agent(`${d.prompt} Return only concrete, reproducible findings with file and line.`, {
      label: `review:${d.key}`,
      phase: 'Review',
      schema: FINDINGS_SCHEMA,
    }),
  (review, d) =>
    parallel(
      (review ? review.findings : []).map(
        (f) => () =>
          parallel(
            [0, 1].map(
              (i) => () =>
                agent(
                  `Try to REFUTE this ${d.key} review finding by reading the code and, where possible, running the relevant test or a quick script. Finding: "${f.title}" in ${f.file}${f.line ? ':' + f.line : ''}. Detail: ${f.detail}. Skeptic #${i + 1}. If you cannot reproduce a real defect, set refuted=true.`,
                  { label: `verify:${d.key}:${f.file}`, phase: 'Verify', schema: VERDICT_SCHEMA },
                ),
            ),
          ).then((votes) => ({
            ...f,
            dimension: d.key,
            refutations: votes.filter(Boolean).filter((v) => v.refuted).length,
          })),
      ),
    ),
);

const all = results.flat().filter(Boolean);
const confirmed = all.filter((f) => f.refutations === 0);
log(`${all.length} findings reviewed, ${confirmed.length} survived adversarial verification`);
return { confirmed, dropped: all.filter((f) => f.refutations > 0).map((f) => f.title) };
