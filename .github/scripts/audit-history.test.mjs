import assert from 'node:assert/strict';
import test from 'node:test';
import { fingerprint, latestIssue, lcpId, marker, observation, recoveryMarker, transition } from './audit-history.mjs';

const key = fingerprint('https://example.org/', false, 'unused-javascript');
const bot = { login: 'github-actions[bot]' };
const issue = { number: 24, state: 'closed', closed_at: '2026-11-01T01:00:00Z', user: bot, body: marker(key) };
const fix = { number: 26, mergedAt: '2026-11-01T00:59:59Z' };
const passedAt = '2026-11-02T01:00:00Z';
const later = '2026-11-03T01:00:00Z';
const comment = { user: bot, issue_url: 'https://api.github.com/repos/example/calendar/issues/24',
  body: recoveryMarker(key, fix.number, passedAt) };
const state = { key, issue, fix, observed: 'finding', measuredAt: later, comments: [] };

test('a closed issue needs an actual fix and a measured recovery before a later failure can recur', () => {
  assert.equal(transition(state), 'none');
  assert.equal(transition({ ...state, observed: 'pass', fix: null }), 'none');
  assert.equal(transition({ ...state, measuredAt: issue.closed_at, observed: 'pass' }), 'none');
  assert.equal(transition({ ...state, measuredAt: passedAt, observed: 'pass' }), 'record');
  assert.equal(transition({ ...state, observed: 'pass', comments: [comment] }), 'none');
  assert.equal(transition({ ...state, comments: [comment] }), 'recur');
  assert.equal(transition({ ...state, measuredAt: passedAt, comments: [comment] }), 'none');
  assert.equal(transition({ ...state, measuredAt: issue.closed_at, comments: [comment] }), 'none');
});

test('missing data and evidence from another issue, user or fix cannot start a recurrence', () => {
  assert.equal(transition({ ...state, observed: 'unknown' }), 'none');
  for (const changed of [{ user: { login: 'contributor' } }, { issue_url: 'repos/example/calendar/issues/25' },
    { body: recoveryMarker(key, 28, passedAt) }]) {
    assert.equal(transition({ ...state, comments: [{ ...comment, ...changed }] }), 'none');
  }
});

test('the latest marked issue deduplicates a replay and supports older markers on human-authored issues', () => {
  const humanIssue = { ...issue, user: { login: 'owner' }, body: 'Original description' };
  const legacy = { ...comment, body: marker(key) };
  assert.equal(latestIssue(key, [humanIssue], [legacy]), humanIssue);
  const recurrence = { ...issue, number: 32, state: 'open' };
  assert.equal(latestIssue(key, [recurrence, humanIssue], [legacy]), recurrence);
  assert.equal(transition({ ...state, issue: recurrence, comments: [comment] }), 'none');
  assert.notEqual(fingerprint('https://example.org/', true, 'unused-javascript'), key);
});

test('a missing or errored measurement never proves an opportunity or LCP recovered', () => {
  for (const id of ['unused-javascript', lcpId]) {
    assert.equal(observation(id), 'unknown');
    assert.equal(observation(id, { score: 1, numericValue: 1800, errorMessage: 'NO_FCP' }), 'unknown');
  }
  assert.equal(observation('unused-javascript', { score: null }), 'unknown');
  assert.equal(observation('unused-javascript', { score: 1 }), 'pass');
  assert.equal(observation('unused-javascript', { score: 0.8, details: { overallSavingsBytes: 1234 } }), 'finding');
  assert.equal(observation(lcpId, { numericValue: 2500 }), 'pass');
  assert.equal(observation(lcpId, { numericValue: 2501 }), 'finding');
});
