export const moods = ['开心', '平静', '忧郁', '悲伤', '治愈', '愤怒'];

export const moodProfiles = {
  开心: {
    energy: [0.48, 0.78],
    tempo: '中速到轻快',
    voice: '明亮、轻松、带微笑',
    avoid: '避免过度喧闹和强烈压迫感',
    tags: ['明亮', '温暖', '正向记忆']
  },
  忧郁: {
    energy: [0.22, 0.48],
    tempo: '缓慢、留白多',
    voice: '低沉、克制、像黄昏的独白',
    avoid: '避免明亮跳跃的旋律',
    tags: ['怀旧', '雨天', '独处', '叙事']
  },
  悲伤: {
    energy: [0.24, 0.58],
    tempo: '慢到中速',
    voice: '温柔、克制、少解释',
    avoid: '避免连续过度下沉',
    tags: ['怀旧', '失落', '安抚', '陪伴']
  },
  平静: {
    energy: [0.12, 0.48],
    tempo: '稳定、舒缓',
    voice: '低声、留白、像夜间电台',
    avoid: '避免尖锐音色和强鼓点',
    tags: ['舒缓', '阅读', '夜晚', '低刺激']
  },
  治愈: {
    energy: [0.30, 0.60],
    tempo: '温暖、徐徐推进',
    voice: '温暖、像朋友在身边轻声说话',
    avoid: '避免过于激烈或黑暗的歌词',
    tags: ['温暖', '希望', '拥抱', '痊愈']
  },
  愤怒: {
    energy: [0.55, 0.9],
    tempo: '先强后稳',
    voice: '先接住情绪，再逐步降温',
    avoid: '避免全程升级冲突感',
    tags: ['释放', '摇滚', '力量', '回落']
  }
};

export function normalizeMood(value) {
  return moods.includes(value) ? value : '平静';
}

export function recommendMood({ currentMood, specialDates = [], weather = null, hour = new Date().getHours() }) {
  if (currentMood && moods.includes(currentMood)) return currentMood;
  if (specialDates.some((item) => item.importance === 'high')) return '平静';
  if (weather?.condition?.includes('雨')) return '平静';
  if (hour >= 23 || hour < 7) return '平静';
  if (hour >= 7 && hour <= 10) return '开心';
  return '平静';
}

export function scoreTrackForMood(track, mood) {
  const profile = moodProfiles[normalizeMood(mood)];
  const moodHit = track.mood?.includes(mood) ? 0.45 : 0;
  const energy = typeof track.energy === 'number' ? track.energy : 0.5;
  const [min, max] = profile.energy;
  const inRange = energy >= min && energy <= max ? 0.35 : 0;
  const distance = energy < min ? min - energy : energy > max ? energy - max : 0;
  return moodHit + inRange - distance * 0.35;
}
