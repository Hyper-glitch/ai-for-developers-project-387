import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkBudget } from './pr-budget.mjs';

const title = 'OpenCode PR #12';
const run = (id, run_attempt, status, display_title = title) => ({ id, run_attempt, status, display_title });
const current = { id: 20, attempt: 1, title };
const accepted = () => ({ conclusion: 'success', steps: [{ name: 'Check command budget', conclusion: 'success' }] });

test('three denied commands leave all three attempts available to the first writer', () => {
  const history = [run(13, 1, 'completed'), run(14, 1, 'completed'), run(15, 1, 'completed'), run(20, 1, 'in_progress')];
  const denied = { conclusion: 'success', steps: [{ name: 'Reject untrusted command', conclusion: 'success' }] };
  assert.deepEqual(checkBudget(history, current, () => denied), { used: 1, allowed: true });
});

test('handles old refusals and charges cancelled and timed-out attempts separately on the same run', () => {
  const history = [run(15, 3, 'completed'), run(20, 1, 'in_progress')];
  const older = [
    { conclusion: 'success', steps: [{ name: 'Verify PR and sender', conclusion: 'success' }, { name: 'Check command budget', conclusion: 'skipped' }] },
    { conclusion: 'cancelled', steps: [] },
    { conclusion: 'timed_out', steps: [{ name: 'Reject untrusted command', conclusion: 'skipped' }] },
  ];
  assert.deepEqual(checkBudget(history, current, (_runId, attempt) => older[attempt - 1]), { used: 3, allowed: true });
});

test('the third request can run while the next one waits for the same PR lock', () => {
  const history = [run(16, 1, 'completed'), run(18, 1, 'completed'), run(20, 1, 'in_progress'), run(22, 1, 'pending')];
  assert.deepEqual(checkBudget(history, current, accepted), { used: 3, allowed: true });
  history[2].status = 'completed';
  history[3].status = 'in_progress';
  assert.deepEqual(checkBudget(history, { ...current, id: 22 }, accepted), { used: 4, allowed: false });
});

test('rerunning an old command charges the new attempt and every newer completed command', () => {
  const history = [run(16, 2, 'in_progress'), run(18, 1, 'completed'), run(20, 1, 'completed')];
  assert.deepEqual(checkBudget(history, { title, id: 16, attempt: 2 }, accepted), { used: 4, allowed: false });
});

test('queued rerun retains the charges for earlier attempts regardless of their conclusion', () => {
  const history = [run(16, 3, 'queued'), run(20, 1, 'in_progress')];
  assert.deepEqual(checkBudget(history, current, accepted), { used: 3, allowed: true });
});

test('ignores unrelated PRs, bot responses, and duplicate rows across pages', () => {
  const history = [run(14, 4, 'completed', 'OpenCode PR #21'), run(15, 2, 'completed', 'Ignored comment'),
    run(16, 2, 'completed'), run(16, 2, 'completed'), run(20, 1, 'in_progress')];
  assert.deepEqual(checkBudget(history, current, accepted), { used: 3, allowed: true });
});

test('denies calls when Actions cannot confirm the current attempt', () => {
  assert.throws(() => checkBudget([], current), /missing/);
  assert.throws(() => checkBudget([run(20, 1, 'in_progress')], { ...current, attempt: 2 }), /missing/);
});

test('the fourth PR command exits before OpenCode and reports limit_exhausted to Actions', t => {
  const scratch = mkdtempSync(join(tmpdir(), 'pr-command-budget-'));
  t.after(() => rmSync(scratch, { recursive: true, force: true }));
  const output = join(scratch, 'github-output');
  writeFileSync(output, '');
  // The Actions jobs endpoint returns one result per attempt. Include a
  // cancelled attempt with no job to check it still consumes its place.
  writeFileSync(join(scratch, 'gh'), `#!/bin/sh
case "$2" in
  repos/calendar/test/actions/runs/12/attempts/1/jobs*|repos/calendar/test/actions/runs/15/attempts/1/jobs*)
    echo '{"conclusion":"success","steps":[{"name":"Check command budget","conclusion":"success"}]}' ;;
  repos/calendar/test/actions/runs/12/attempts/2/jobs*) echo 'null' ;;
  *) exit 2 ;;
esac
`, { mode: 0o755 });
  const history = [
    { ...run(12, 2, 'completed'), event: 'pull_request_review_comment' },
    { ...run(15, 1, 'completed'), event: 'issue_comment' },
    { ...run(20, 1, 'in_progress'), event: 'pull_request_review_comment' },
  ];
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./pr-budget.mjs', import.meta.url))], {
    env: {
      ...process.env, PR_NUMBER: '12', GITHUB_RUN_ID: '20', GITHUB_RUN_ATTEMPT: '1', GITHUB_OUTPUT: output,
      GITHUB_REPOSITORY: 'calendar/test', PATH: `${scratch}:${process.env.PATH}`,
    },
    input: JSON.stringify(history),
    encoding: 'utf8',
  });
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stdout, /attempt 4, limit 3/);
  assert.equal(readFileSync(output, 'utf8'), 'reason=limit_exhausted\n');
});
