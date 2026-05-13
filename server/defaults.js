export const station = {
  title: '十三哥的音乐之声',
  subtitle: 'mark radio',
  apiHost: '192.168.2.33',
  webPort: 8080,
  apiPort: 8765
};

export const demoTracks = [
  {
    id: 'demo-1',
    title: 'Monday Night Exhale',
    artist: 'Bread',
    album: 'Private Memory',
    duration: 207,
    mood: ['平静', '悲伤'],
    energy: 0.38,
    reason: '像夜里轻轻落下的灯，适合把心慢慢放回原处。'
  },
  {
    id: 'demo-2',
    title: 'Sign of the Times',
    artist: 'Harry Styles',
    album: 'Memory Signal',
    duration: 341,
    mood: ['悲伤', '平静'],
    energy: 0.58,
    reason: '宏大的失落感里带一点往前走的力量。'
  },
  {
    id: 'demo-3',
    title: 'If',
    artist: 'Bread',
    album: 'Soft Radio',
    duration: 155,
    mood: ['平静', '开心'],
    energy: 0.34,
    reason: '很轻的一首歌，适合在重要日子里留一点温柔。'
  },
  {
    id: 'demo-4',
    title: '夜空中最亮的星',
    artist: '逃跑计划',
    album: 'Chinese Classics',
    duration: 252,
    mood: ['开心', '欢乐'],
    energy: 0.72,
    reason: '明亮、开阔，适合把今天重新点亮。'
  },
  {
    id: 'demo-5',
    title: '倔强',
    artist: '五月天',
    album: 'Release',
    duration: 260,
    mood: ['愤怒', '欢乐'],
    energy: 0.86,
    reason: '先把情绪接住，再把它变成能量。'
  },
  {
    id: 'demo-6',
    title: 'Weightless',
    artist: 'Marconi Union',
    album: 'Calm',
    duration: 480,
    mood: ['焦虑', '平静'],
    energy: 0.18,
    reason: '低刺激、稳定，适合让紧绷的神经慢慢松开。'
  }
];

export const defaultTaste = {
  taste: '偏爱有记忆感、旋律清晰、能在夜晚独处时慢慢听进去的歌。不要太吵，情绪要有层次。',
  routines: '早晨需要轻微提神；夜晚需要平静和回忆；重要日期优先播放有纪念感的歌。',
  moodRules: '开心要明亮，欢乐要有节奏，悲伤要被接住，平静要低刺激，焦虑要稳定，愤怒要先释放再回落。'
};
