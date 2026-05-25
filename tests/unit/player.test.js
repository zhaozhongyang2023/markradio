import test from 'node:test';
import assert from 'node:assert/strict';
import { getPlayerState, stop } from '../../server/player.js';

test('getPlayerState returns idle when nothing playing', () => {
  stop();
  const state = getPlayerState();
  assert.equal(state.state, 'idle');
  assert.equal(state.pid, null);
});

test('stop resets player to idle', () => {
  stop();
  const state = getPlayerState();
  assert.equal(state.state, 'idle');
});

test('getPlayerState returns expected shape', () => {
  const state = getPlayerState();
  assert.ok('state' in state);
  assert.ok('pid' in state);
  assert.ok(state.state === 'idle' || state.state === 'playing');
});

test('stop is idempotent (no crash on double stop)', () => {
  stop();
  assert.equal(getPlayerState().state, 'idle');
  stop();
  assert.equal(getPlayerState().state, 'idle');
});
