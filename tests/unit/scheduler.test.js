import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWorldContinuity,
  calcEmotionMomentum,
  fallbackGameVibeSentence,
  fillQueueTracks,
  buildTrackReason,
  buildIntroText,
  buildTimeContext,
  periodName
} from '../../server/scheduler.js';

// ─── periodName ───
test('periodName maps hours correctly', () => {
  assert.equal(periodName(3), '深夜');
  assert.equal(periodName(7), '清晨');
  assert.equal(periodName(10), '上午');
  assert.equal(periodName(13), '午后');
  assert.equal(periodName(16), '下午');
  assert.equal(periodName(20), '夜晚');
  assert.equal(periodName(23), '夜深');
});

// ─── buildTimeContext ───
test('buildTimeContext returns expected keys', () => {
  const ctx = buildTimeContext(new Date('2026-05-25T21:30:00+08:00'));
  assert.ok(ctx.iso);
  assert.ok(ctx.local.includes('05-25'));
  assert.ok(ctx.period === '夜晚' || ctx.period);
  assert.ok(ctx.refreshSeed);
});

// ─── buildWorldContinuity ───
test('buildWorldContinuity null inputs return null', () => {
  assert.equal(buildWorldContinuity(null, {}), null);
  assert.equal(buildWorldContinuity({}, null), null);
  assert.equal(buildWorldContinuity({ condition: null }, { condition: '晴' }), null);
  assert.equal(buildWorldContinuity({ condition: '阴' }, { condition: null }), null);
});

test('buildWorldContinuity empty city returns null (城市不匹配)', () => {
  // 空城市与'北京'不匹配，应返回 null
  assert.equal(
    buildWorldContinuity(
      { condition: '晴', city: '' },
      { condition: '阴', city: '北京', date: '2020-01-01' }
    ),
    null
  );
});

test('buildWorldContinuity same day returns null', () => {
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(
    buildWorldContinuity({ condition: '阴', city: '北京' }, { condition: '阴', city: '北京', date: today }),
    null
  );
});

test('buildWorldContinuity different day same weather', () => {
  const result = buildWorldContinuity(
    { condition: '阴', city: '北京' },
    { condition: '阴', city: '北京', date: '2020-01-01' }
  );
  assert.ok(result);
  assert.match(result, /还是没放晴/);
});

test('buildWorldContinuity different weather same city', () => {
  const result = buildWorldContinuity(
    { condition: '晴', city: '北京' },
    { condition: '阴', city: '北京', date: '2020-01-01' }
  );
  assert.ok(result);
  assert.match(result, /变成了晴/);
});

test('buildWorldContinuity different city returns null', () => {
  assert.equal(
    buildWorldContinuity(
      { condition: '晴', city: '上海' },
      { condition: '阴', city: '北京', date: '2020-01-01' }
    ),
    null
  );
});

// ─── calcEmotionMomentum ───
test('calcEmotionMomentum detects quiet pattern', () => {
  const result = calcEmotionMomentum({
    recentPlays: () => Array(18).fill({ mood: '平静' })
  });
  assert.ok(result);
  assert.match(result, /安静|内敛/);
});

test('calcEmotionMomentum detects active pattern', () => {
  const result = calcEmotionMomentum({
    recentPlays: () => Array(18).fill({ mood: '开心' })
  });
  assert.ok(result);
  assert.match(result, /活跃/);
});

test('calcEmotionMomentum balanced mood returns null', () => {
  const plays = [];
  for (let i = 0; i < 10; i++) {
    plays.push({ mood: '平静' }, { mood: '开心' });
  }
  assert.equal(calcEmotionMomentum({ recentPlays: () => plays }), null);
});

test('calcEmotionMomentum empty history returns null', () => {
  assert.equal(calcEmotionMomentum({ recentPlays: () => [] }), null);
});

// ─── fillQueueTracks ───
test('fillQueueTracks fills to limit from candidates', () => {
  const selected = [{ id: 'a' }, { id: 'b' }];
  const candidates = [{ id: 'c' }, { id: 'd' }, { id: 'e' }];
  const playedSet = new Set();
  const result = fillQueueTracks(selected, candidates, 4, playedSet);
  assert.equal(result.length, 4);
  assert.deepEqual(result.map(t => t.id), ['a', 'b', 'c', 'd']);
  assert.ok(playedSet.has('a'));
  assert.ok(playedSet.has('c'));
});

test('fillQueueTracks skips already played', () => {
  const selected = [{ id: 'a' }];
  const candidates = [{ id: 'a' }, { id: 'b' }];
  const playedSet = new Set(['a']);
  const result = fillQueueTracks(selected, candidates, 3, playedSet);
  assert.equal(result.length, 2);
  assert.equal(result[1].id, 'b');
});

test('fillQueueTracks selected tracks always included (超出限制也保留)', () => {
  // AI 选曲优先，全部保留，limit 只限制候选补全
  const selected = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const candidates = [{ id: 'd' }, { id: 'e' }];
  const result = fillQueueTracks(selected, candidates, 2, new Set());
  assert.equal(result.length, 3, 'selected 全部保留，不受 limit 限制');
  assert.deepEqual(result.map(t => t.id), ['a', 'b', 'c']);
});

test('fillQueueTracks handles null tracks in selected', () => {
  const selected = [{ id: 'a' }, null, { id: 'b' }];
  const candidates = [{ id: 'c' }];
  const result = fillQueueTracks(selected, candidates, 5, new Set());
  assert.equal(result.length, 3);
  assert.deepEqual(result.map(t => t.id), ['a', 'b', 'c']);
});

// ─── buildTrackReason ───
test('buildTrackReason first track includes say', () => {
  const reason = buildTrackReason(
    { title: '夜曲', artist: '周杰伦', album: '十一月的萧邦' },
    0,
    { say: '夜晚从一首经典开始。', reason: '', segue: '' },
    '平静'
  );
  assert.match(reason, /夜曲/);
  assert.match(reason, /周杰伦/);
  assert.match(reason, /夜晚/);
});

test('buildTrackReason non-first includes segue', () => {
  const reason = buildTrackReason(
    { title: 'Song2', artist: 'Artist', album: 'Album' },
    2,
    { reason: '适合此刻', segue: '下一首，继续。' },
    '平静'
  );
  assert.match(reason, /下一首/);
  assert.match(reason, /适合此刻/);
  assert.match(reason, /Song2/);
});

// ─── buildIntroText ───
test('buildIntroText includes special date', () => {
  const result = buildIntroText({
    plan: { say: '夜慢慢深了。' },
    specialDates: [{ name: '元旦', importance: 'high' }],
    track: { title: 'A' }
  });
  assert.match(result, /元旦/);
  assert.match(result, /夜慢慢深了/);
});

test('buildIntroText no special date', () => {
  const result = buildIntroText({
    plan: { say: '晚安。' },
    specialDates: [],
    track: { title: 'A' }
  });
  assert.match(result, /晚安/);
  assert.doesNotMatch(result, /今天靠近/);
});

// ─── fallbackGameVibeSentence ───
test('fallbackGameVibeSentence matches assassin creed', () => {
  const result = fallbackGameVibeSentence('平静', '刺客信条·影', '');
  const valid = ['灯火远一点，脚步轻一点。', '从屋檐下经过。', '刀收好，夜还长。'];
  assert.ok(valid.includes(result), `got: ${result}`);
});

test('fallbackGameVibeSentence matches witcher 3', () => {
  const result = fallbackGameVibeSentence('平静', '巫师3·狂猎', '');
  const valid = ['百果园的雨，慢慢走。', '篝火旁边，不用说话。', '猎魔人的路，一个人走。'];
  assert.ok(valid.includes(result), `got: ${result}`);
});

test('fallbackGameVibeSentence unknown game falls back to mood', () => {
  const result = fallbackGameVibeSentence('治愈', '未知游戏', '');
  const valid = ['外面下雨，适合慢慢走。', '今晚别太累。'];
  assert.ok(valid.includes(result), `got: ${result}`);
});

test('fallbackGameVibeSentence unknown mood falls back to 平静', () => {
  const result = fallbackGameVibeSentence('不存在的mood', '', '');
  const valid = ['夜色压低一点。', '慢慢走，不赶路。'];
  assert.ok(valid.includes(result), `got: ${result}`);
});

test('fallbackGameVibeSentence empty gameName skips game matching', () => {
  const result = fallbackGameVibeSentence('开心', '', '');
  const valid = ['节奏跟上来。', '今晚速度别停。'];
  assert.ok(valid.includes(result), `got: ${result}`);
});
