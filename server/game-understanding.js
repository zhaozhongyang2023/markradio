// 常见游戏世界感映射
const GAME_WORLDS = {
  '巫师3': { world: ['中世纪', '篝火', '孤独旅程', '开放世界'], music: ['LoFi', '低频', '民谣感', '沉浸'] },
  '巫师三': { world: ['中世纪', '篝火', '孤独旅程', '开放世界'], music: ['LoFi', '低频', '民谣感', '沉浸'] },
  'gta5': { world: ['霓虹城市', '夜晚', '电子感', '都市孤独'], music: ['电子', 'Synthwave', '低频', '城市感'] },
  '原神': { world: ['开放世界', '奇幻', '探索', '元素'], music: ['管弦', '治愈', '冒险感', '氛围'] },
  '星露谷物语': { world: ['田园', '温暖', '慢节奏', '经营'], music: ['LoFi', '治愈', '轻快', '田园'] },
  '星露谷': { world: ['田园', '温暖', '慢节奏', '经营'], music: ['LoFi', '治愈', '轻快', '田园'] },
  '艾尔登法环': { world: ['黑暗奇幻', '史诗', '压迫', '孤独'], music: ['低频', '管弦', '沉浸', '压抑'] },
  '法环': { world: ['黑暗奇幻', '史诗', '压迫', '孤独'], music: ['低频', '管弦', '沉浸', '压抑'] },
  '塞尔达': { world: ['冒险', '自由', '治愈', '探索'], music: ['治愈', '轻快', '管弦', '冒险感'] },
  '赛博朋克2077': { world: ['赛博朋克', '霓虹', '压抑', '未来'], music: ['电子', 'Synthwave', '低频', '工业感'] },
  '2077': { world: ['赛博朋克', '霓虹', '压抑', '未来'], music: ['电子', 'Synthwave', '低频', '工业感'] },
  '空洞骑士': { world: ['地下', '孤独', '静谧', '虫类'], music: ['LoFi', '治愈', '低频', '沉浸'] },
  '死亡搁浅': { world: ['孤独', '配送', '旅程', '后启示录'], music: ['LoFi', '氛围', '低频', '孤独感'] },
  '我的世界': { world: ['建造', '自由', '孤独', '像素'], music: ['LoFi', '治愈', '轻快', '像素感'] },
  'minecraft': { world: ['建造', '自由', '孤独', '像素'], music: ['LoFi', '治愈', '轻快', '像素感'] },
  'p5r': { world: ['都市', '青春', '怪盗', '爵士'], music: ['爵士', 'City Pop', '轻快', '都市感'] },
  '女神异闻录': { world: ['都市', '青春', '怪盗', '爵士'], music: ['爵士', 'City Pop', '轻快', '都市感'] },
  '荒野大镖客': { world: ['西部', '荒野', '孤独', '旅程'], music: ['民谣', '低频', '氛围', '西部感'] },
  'rdr2': { world: ['西部', '荒野', '孤独', '旅程'], music: ['民谣', '低频', '氛围', '西部感'] },
};

// 关键词匹配
const VIBE_KEYWORDS = {
  '跑图': { world: ['探索', '重复', '沉浸'], music: ['LoFi', '氛围', '长时间循环'] },
  '刷素材': { world: ['重复', '沉浸', '肝'], music: ['LoFi', '低频', '背景感'] },
  '挂机': { world: ['安静', '陪伴', '背景'], music: ['LoFi', '治愈', '极低刺激'] },
  '探索': { world: ['自由', '冒险', '沉浸'], music: ['氛围', '管弦', '低频'] },
  '深夜': { world: ['安静', '孤独', '夜晚'], music: ['LoFi', '治愈', '低频'] },
  'jrpg': { world: ['旅程', '伙伴', '回忆', '日式'], music: ['JRPG OST', '管弦', '治愈', '怀旧'] },
};

export function getGameDNA(gameName) {
  if (!gameName) return null;
  const lower = gameName.toLowerCase();
  const key = Object.keys(GAME_WORLDS).find(k => lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower));
  if (key) return GAME_WORLDS[key];
  return null;
}

export function getVibeDNA(vibe) {
  if (!vibe) return null;
  const lower = vibe.toLowerCase();
  const key = Object.keys(VIBE_KEYWORDS).find(k => lower.includes(k.toLowerCase()) || k.toLowerCase().includes(lower));
  if (key) return VIBE_KEYWORDS[key];
  return null;
}

export function buildGameContext(gameName, gameVibe) {
  const gameDna = getGameDNA(gameName);
  const vibeDna = getVibeDNA(gameVibe);
  if (!gameDna && !vibeDna) {
    if (gameName) {
      return { game_name: gameName, game_state: gameVibe || '' };
    }
    return null;
  }
  return {
    game_name: gameName || '',
    game_state: gameVibe || '',
    game_vibe: [...(gameDna?.world || []), ...(vibeDna?.world || [])].join('、'),
    music_direction: [...(gameDna?.music || []), ...(vibeDna?.music || [])]
  };
}
