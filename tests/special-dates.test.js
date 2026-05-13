import test from 'node:test';
import assert from 'node:assert/strict';
import { getSpecialDates } from '../server/special-dates.js';

test('hits my birthday on 05-14', () => {
  const hits = getSpecialDates(new Date(2026, 4, 14), []);
  assert.ok(hits.some((item) => item.name === '我的生日' && item.daysAway === 0));
});

test('hits important birthday on 05-12', () => {
  const hits = getSpecialDates(new Date(2026, 4, 12), []);
  assert.ok(hits.some((item) => item.name === '特别重要人的生日' && item.daysAway === 0));
});

test('hits New Year on 01-01', () => {
  const hits = getSpecialDates(new Date(2026, 0, 1), []);
  assert.ok(hits.some((item) => item.name === '元旦' && item.daysAway === 0));
});

test('hits solar term around 立夏', () => {
  const hits = getSpecialDates(new Date(2026, 4, 5), []);
  assert.ok(hits.some((item) => item.name === '立夏'));
});

test('hits lunar new year from local year table', () => {
  const hits = getSpecialDates(new Date(2026, 1, 17), []);
  assert.ok(hits.some((item) => item.name === '春节/新年' && item.daysAway === 0));
});
