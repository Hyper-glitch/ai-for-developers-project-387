import { createHash } from 'node:crypto';

export const opportunities = ['unused-javascript', 'unused-css-rules', 'render-blocking-insight', 'render-blocking-resources',
  'unminified-javascript', 'unminified-css', 'uses-text-compression', 'image-delivery-insight'];
export const lcpId = 'largest-contentful-paint';

export function fingerprint(url, training, id) {
  const key = JSON.stringify([url, training, id]);
  return createHash('sha256').update(key).digest('hex');
}

export function marker(key) {
  return `<!-- calendar-lighthouse:${key} -->`;
}

export function observation(id, audit) {
  if (!audit || audit.errorMessage || ['error', 'manual'].includes(audit.scoreDisplayMode)) return 'unknown';
  if (id === lcpId) {
    if (!Number.isFinite(audit.numericValue) || audit.numericValue <= 0) return 'unknown';
    return audit.numericValue > 2500 ? 'finding' : 'pass';
  }
  if (!Number.isFinite(audit.score)) return 'unknown';
  if (audit.score === 1) return 'pass';
  if (audit.score < 1 && (audit.details?.overallSavingsBytes > 0 || audit.details?.overallSavingsMs > 0 ||
    Object.values(audit.metricSavings ?? {}).some(ms => ms > 0))) return 'finding';
  return 'unknown';
}

function recoveryPrefix(key, pr) {
  return `<!-- calendar-lighthouse-recovery:${key}:pr-${pr}:`;
}

export function recoveryMarker(key, pr, measuredAt) {
  return `${recoveryPrefix(key, pr)}${new Date(measuredAt).toISOString()} -->`;
}

export function latestIssue(key, issues, comments) {
  const marked = entry => entry.user.login === 'github-actions[bot]' && entry.body?.trimEnd().endsWith(marker(key));
  const numbers = new Set(comments.filter(marked).map(comment => Number(comment.issue_url.split('/').pop())));
  return issues.filter(issue => marked(issue) || numbers.has(issue.number)).sort((a, b) => b.number - a.number)[0];
}

export function transition({ issue, fix, measuredAt, observed, key, comments }) {
  if (!issue || !fix || issue.state !== 'closed' || observed === 'unknown') return 'none';
  const afterFix = Math.max(Date.parse(issue.closed_at), Date.parse(fix.mergedAt));
  const measured = Date.parse(measuredAt);
  if (!(measured > afterFix)) return 'none';
  const prefix = recoveryPrefix(key, fix.number);
  const recoveries = comments.filter(comment => comment.user.login === 'github-actions[bot]' &&
      Number(comment.issue_url.split('/').pop()) === issue.number)
    .map(comment => (comment.body ?? '').trimEnd().split('\n').at(-1))
    .filter(line => line.startsWith(prefix) && line.endsWith(' -->'))
    .map(line => Date.parse(line.slice(prefix.length, -4)))
    .filter(time => time > afterFix);
  if (observed === 'pass' && !recoveries.length) return 'record';
  if (observed === 'finding' && recoveries.some(time => measured > time)) return 'recur';
  return 'none';
}
