import test from 'node:test';
import assert from 'node:assert/strict';
import { isNeteaseSongLiked } from '../../server/providers/netease.js';

test('isNeteaseSongLiked matches numeric and string ids', () => {
  assert.equal(isNeteaseSongLiked([1, '2', 3], '2'), true);
  assert.equal(isNeteaseSongLiked([1, '2', 3], 3), true);
  assert.equal(isNeteaseSongLiked([1, '2', 3], '4'), false);
});

test('isNeteaseSongLiked handles empty input', () => {
  assert.equal(isNeteaseSongLiked([], '1'), false);
  assert.equal(isNeteaseSongLiked(null, '1'), false);
  assert.equal(isNeteaseSongLiked(['1'], ''), false);
});
