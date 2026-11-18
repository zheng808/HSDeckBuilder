export const meta = {
  name: 'feature-plan',
  description:
    'Design a feature three ways (MVP-first, data-model-first, UX-first), judge them, and return one synthesized implementation plan',
  whenToUse:
    'Before implementing a non-trivial feature; pass the feature description as args.feature',
  phases: [
    { title: 'Design', detail: 'three independent proposals' },
    { title: 'Judge', detail: 'score and synthesize' },
  ],
};

const feature = typeof args === 'string' ? args : args && args.feature;
if (!feature) throw new Error('Pass the feature description as args (string) or args.feature');

const PLAN_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
    files: { type: 'array', items: { type: 'string' } },
    risks: { type: 'array', items: { type: 'string' } },
  },
  required: ['summary', 'steps', 'files', 'risks'],
};

const lenses = [
  { key: 'mvp', brief: 'Smallest change that delivers the user-visible value; reuse what exists.' },
  {
    key: 'data-model',
    brief:
      'Get the shared types, zod schemas, SQLite shape and API contract right first; the UI follows.',
  },
  {
    key: 'ux',
    brief:
      'Start from the user flow in the builder and deck pages; derive the API from the screens.',
  },
];

const context =
  'Repository: Hearthstone deck builder monorepo (shared/ domain rules, server/ Hono+SQLite, client/ React+Vite). Read CLAUDE.md, docs/ARCHITECTURE.md and docs/API.md first. Follow .claude/rules/project.md for the contract-change order.';

const plans = await parallel(
  lenses.map(
    (l) => () =>
      agent(
        `${context}\n\nFeature: ${feature}\n\nDesign lens: ${l.brief}\nProduce an implementation plan: concrete steps, files to touch (existing paths), and risks.`,
        {
          label: `design:${l.key}`,
          phase: 'Design',
          schema: PLAN_SCHEMA,
        },
      ).then((p) => (p ? { lens: l.key, ...p } : null)),
  ),
);

const candidates = plans.filter(Boolean);
log(`${candidates.length} candidate plans`);

const final = await agent(
  `${context}\n\nFeature: ${feature}\n\nHere are ${candidates.length} candidate plans:\n${JSON.stringify(candidates, null, 2)}\n\nJudge them for correctness against the codebase (verify file paths exist), effort, and risk. Produce ONE synthesized plan taking the best of each, in the contract-change order from .claude/rules/project.md, with a test list.`,
  { label: 'judge+synthesize', phase: 'Judge', schema: PLAN_SCHEMA },
);

return { feature, candidates, final };
