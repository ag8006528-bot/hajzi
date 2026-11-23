import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeNext } from '../../src/lib/safe-next';

test('after login, customers only go back to a field page on this site (no open redirect)', () => {
  assert.equal(safeNext('/fields/6-yard-sports-entertainment'), '/fields/6-yard-sports-entertainment');
  assert.equal(safeNext('/fields/green-line-arena?date=2026-12-01&time=19:00'), '/fields/green-line-arena?date=2026-12-01&time=19:00');
  for (const bad of [
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    'javascript:alert(1)',
    '/admin',
    '/fields/x?date=2026-12-01&next=https://evil.example',
    '/fields/../admin',
    '',
    undefined,
    null,
  ]) {
    assert.equal(safeNext(bad), '/account', String(bad));
  }
  assert.equal(safeNext(['/fields/a', '//evil']), '/fields/a');
});
