import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DJ_PERSONA, TIME_ATMOSPHERE_MAP, WEATHER_ATMOSPHERE_MAP,
  FORBIDDEN_PHRASES, FORBIDDEN_STYLES,
  buildSystemPrompt, buildOutputSchema, periodName
} from '../server/prompts.js';

test('DJ_PERSONA includes core identity markers', () => {
  assert.match(DJ_PERSONA, /不是 AI 助手/);
  assert.match(DJ_PERSONA, /MoodWave AI DJ/);
  assert.match(DJ_PERSONA, /温柔/);
  assert.match(DJ_PERSONA, /陪伴感/);
  assert.match(DJ_PERSONA, /10~40/);
  assert.match(DJ_PERSONA, /JSON/);
});

test('TIME_ATMOSPHERE_MAP covers all periods', () => {
  assert.ok(TIME_ATMOSPHERE_MAP['清晨']);
  assert.ok(TIME_ATMOSPHERE_MAP['深夜']);
  assert.ok(TIME_ATMOSPHERE_MAP['下午']);
  assert.match(TIME_ATMOSPHERE_MAP['深夜'], /安静/);
  assert.match(TIME_ATMOSPHERE_MAP['清晨'], /慢慢开始/);
});

test('WEATHER_ATMOSPHERE_MAP covers common conditions', () => {
  assert.ok(WEATHER_ATMOSPHERE_MAP['晴']);
  assert.ok(WEATHER_ATMOSPHERE_MAP['雨']);
  assert.ok(WEATHER_ATMOSPHERE_MAP['雪']);
  assert.match(WEATHER_ATMOSPHERE_MAP['雨'], /柔和/);
  assert.match(WEATHER_ATMOSPHERE_MAP['雪'], /温暖/);
});

test('FORBIDDEN_PHRASES includes doc-specified terms', () => {
  assert.ok(FORBIDDEN_PHRASES.includes('为您推荐以下歌曲'));
  assert.ok(FORBIDDEN_PHRASES.includes('推荐结果如下'));
  assert.ok(FORBIDDEN_PHRASES.includes('智能推荐'));
  assert.ok(FORBIDDEN_PHRASES.includes('根据您的偏好'));
});

test('FORBIDDEN_STYLES includes doc-specified tones', () => {
  assert.ok(FORBIDDEN_STYLES.includes('客服语气'));
  assert.ok(FORBIDDEN_STYLES.includes('搜索引擎结果页口吻'));
  assert.ok(FORBIDDEN_STYLES.includes('说明书'));
});

test('periodName maps hours correctly', () => {
  assert.equal(periodName(3), '深夜');
  assert.equal(periodName(7), '清晨');
  assert.equal(periodName(10), '上午');
  assert.equal(periodName(13), '中午');
  assert.equal(periodName(16), '下午');
  assert.equal(periodName(19), '傍晚');
  assert.equal(periodName(23), '夜晚');
});

test('buildSystemPrompt radio mode includes radio-specific rules', () => {
  const prompt = buildSystemPrompt({
    mode: 'radio',
    timePeriod: '夜晚',
    weather: '雨',
    configuredTaste: { taste: '安静的歌' }
  });

  assert.match(prompt, /MoodWave AI DJ/);
  // Let me check specific content
  assert.match(prompt, /MoodWave AI DJ/);
  assert.match(prompt, /长时间播放/);
  assert.match(prompt, /长时间播放/);
  assert.doesNotMatch(prompt, /寻歌模式/);
  assert.doesNotMatch(prompt, /游戏电台/);
});

test('buildSystemPrompt search mode includes search-specific rules', () => {
  const prompt = buildSystemPrompt({
    mode: 'search',
    timePeriod: '下午'
  });

  assert.match(prompt, /MoodWave AI DJ/);
  assert.match(prompt, /寻歌模式额外要求/);
  assert.match(prompt, /不要解释关键词/);
  assert.match(prompt, /模糊表达/);
  assert.doesNotMatch(prompt, /\n电台模式额外要求/);
  assert.doesNotMatch(prompt, /游戏电台模式额外要求/);
});

test('buildSystemPrompt game mode includes game-specific rules', () => {
  const prompt = buildSystemPrompt({
    mode: 'game',
    timePeriod: '深夜'
  });

  assert.match(prompt, /MoodWave AI DJ/);
  assert.match(prompt, /游戏电台模式额外要求/);
  assert.match(prompt, /Steam Deck/);
  assert.match(prompt, /不抢游戏注意力/);
  assert.match(prompt, /长时间循环/);
  assert.doesNotMatch(prompt, /\n电台模式额外要求/);
  assert.doesNotMatch(prompt, /寻歌模式额外要求/);
});

test('buildSystemPrompt includes time and weather atmosphere', () => {
  const prompt = buildSystemPrompt({
    mode: 'radio',
    timePeriod: '深夜',
    weather: '雨'
  });

  assert.match(prompt, /安静/);
  assert.match(prompt, /柔和/);
});

test('buildSystemPrompt includes user taste when provided', () => {
  const prompt = buildSystemPrompt({
    mode: 'radio',
    configuredTaste: { taste: '喜欢后摇和氛围音乐' },
    neteaseTaste: { summary: '常听落日飞车、Deca Joins；偏好中文。' }
  });

  assert.match(prompt, /喜欢后摇和氛围音乐/);
  assert.match(prompt, /落日飞车/);
  assert.match(prompt, /网易云听歌数据/);
});

test('buildOutputSchema radio mode has no scene field', () => {
  const schema = buildOutputSchema('radio');
  assert.equal(schema.scene, undefined);
  assert.equal(schema.gameScene, undefined);
  assert.ok(schema.say);
  assert.match(schema.say, /电台开场白/);
});

test('buildOutputSchema search mode has scene field', () => {
  const schema = buildOutputSchema('search');
  assert.ok(schema.scene);
  assert.match(schema.scene, /场景/);
  assert.equal(schema.gameScene, undefined);
});

test('buildOutputSchema game mode has gameScene field', () => {
  const schema = buildOutputSchema('game');
  assert.ok(schema.gameScene);
  assert.match(schema.gameScene, /游戏/);
  assert.match(schema.say, /游戏电台/);
  assert.equal(schema.scene, undefined);
});
