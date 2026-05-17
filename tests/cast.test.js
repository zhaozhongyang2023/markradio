import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUpnpFriendlyName } from '../server/cast.js';

test('parseUpnpFriendlyName reads friendly device names', () => {
  const xml = '<root><device><friendlyName>客厅音箱 &amp; MarkRadio</friendlyName></device></root>';
  assert.equal(parseUpnpFriendlyName(xml), '客厅音箱 & MarkRadio');
});

test('parseUpnpFriendlyName falls back to empty string', () => {
  assert.equal(parseUpnpFriendlyName('<root />'), '');
});
