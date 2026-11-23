import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const limit = 3;
const waiting = new Set(['queued', 'pending', 'requested', 'waiting']);

function wasRejected(job) {
  const steps = job?.steps ?? [];
  const refusal = steps.find(step => step.name === 'Reject untrusted command');
  if (refusal) return refusal.conclusion === 'success';

  // Before the explicit marker existed, a clean trust refusal was the only
  // successful command job that skipped its budget check.
  return job?.conclusion === 'success'
    && steps.some(step => step.name === 'Verify PR and sender' && step.conclusion === 'success')
    && steps.some(step => step.name === 'Check command budget' && step.conclusion === 'skipped');
}

export function checkBudget(runs, { title, id, attempt }, jobForAttempt) {
  // Pagination can repeat a row when a new run arrives between two pages.
  const matching = new Map(runs.filter(run => run.display_title === title).map(run => [run.id, run]));
  if (matching.get(id)?.run_attempt !== attempt) {
    throw new Error('Current attempt missing from Actions history');
  }

  let used = 1; // Only the current, admitted caller reaches the guard.
  for (const run of matching.values()) {
    if (!Number.isSafeInteger(run.run_attempt) || run.run_attempt < 1) {
      throw new Error('Invalid run_attempt in Actions history');
    }
    // A queued rerun still owes its earlier attempts. The current attempt
    // already occupies the workflow-level lock and is included in used.
    const skipLatest = run.id === id || waiting.has(run.status);
    const last = run.run_attempt - Number(skipLatest);
    for (let previous = last; previous >= 1; previous--) {
      if (wasRejected(jobForAttempt(run.id, previous))) continue;
      used++;
      if (used > limit) return { used, allowed: false };
    }
  }
  return { used, allowed: true };
}

function commandJob(runId, attempt) {
  const endpoint = `repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100`;
  const json = execFileSync('gh', ['api', endpoint, '--jq', '[.jobs[] | select(.name == "command")][0]'], { encoding: 'utf8' });
  // gh outputs nothing for null. A run cancelled before a runner started
  // may have no job or steps. Only confirmed trust refusals are exempt.
  return json.trim() ? JSON.parse(json) : null;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { PR_NUMBER, GITHUB_RUN_ID, GITHUB_RUN_ATTEMPT, GITHUB_OUTPUT } = process.env;
  const history = JSON.parse(readFileSync(0, 'utf8'));
  const { used, allowed } = checkBudget(history, {
    title: `OpenCode PR #${PR_NUMBER}`,
    id: Number(GITHUB_RUN_ID),
    attempt: Number(GITHUB_RUN_ATTEMPT),
  }, commandJob);
  console.log(`OpenCode PR #${PR_NUMBER}: attempt ${used}, limit ${limit}`);
  if (!allowed) {
    appendFileSync(GITHUB_OUTPUT, 'reason=limit_exhausted\n');
    process.exitCode = 1;
  }
}
