import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const limit = 3;
const waiting = new Set(['queued', 'pending', 'requested', 'waiting']);

export function checkBudget(runs, { title, id, attempt }) {
  // Pagination can repeat a row when a new run arrives between two pages.
  const matching = new Map(runs.filter(run => run.display_title === title).map(run => [run.id, run]));
  if (matching.get(id)?.run_attempt !== attempt) {
    throw new Error('Current attempt missing from Actions history');
  }

  let used = 0;
  for (const run of matching.values()) {
    if (!Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1) {
      throw new Error('Invalid run_attempt in Actions history');
    }
    // Workflow-level concurrency admits one run at a time. A queued rerun
    // still owes every previous attempt, including cancellations and timeouts.
    used += run.run_attempt;
    if (run.id !== id && waiting.has(run.status)) used -= 1;
  }
  return { used, allowed: used <= limit };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { PR_NUMBER, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, GITHUB_OUTPUT } = process.env;
  const history = JSON.parse(readFileSync(0, 'utf8'));
  const { used, allowed } = checkBudget(history, {
    title: `OpenCode PR #${PR_NUMBER}`,
    id: Number(GITHUB_RUN_ID),
    attempt: Number(GITHUB_RUN_ATTEMPT),
  });
  console.log(`OpenCode PR #${PR_NUMBER}: attempt ${used}, limit ${limit}`);
  if (!allowed) {
    appendFileSync(GITHUB_OUTPUT, 'reason=limit_exhausted\n');
    process.exitCode = 1;
  }
}
