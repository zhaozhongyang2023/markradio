const fixedDates = [
  {
    id: 'birthday-self',
    type: 'birthday',
    name: '我的生日',
    month: 5,
    day: 14,
    importance: 'high',
    moodHints: ['温暖', '纪念', '回望', '祝福']
  },
  {
    id: 'birthday-important',
    type: 'birthday',
    name: '特别重要人的生日',
    month: 5,
    day: 16,
    importance: 'high',
    moodHints: ['柔和', '珍重', '克制', '想念']
  },
  {
    id: 'new-year-day',
    type: 'festival',
    name: '元旦',
    month: 1,
    day: 1,
    importance: 'high',
    moodHints: ['更新', '出发', '回望', '祝福']
  }
];

const solarTerms = [
  ['小寒', 1, 5], ['大寒', 1, 20], ['立春', 2, 4], ['雨水', 2, 19],
  ['惊蛰', 3, 5], ['春分', 3, 20], ['清明', 4, 4], ['谷雨', 4, 20],
  ['立夏', 5, 5], ['小满', 5, 21], ['芒种', 6, 5], ['夏至', 6, 21],
  ['小暑', 7, 7], ['大暑', 7, 22], ['立秋', 8, 7], ['处暑', 8, 23],
  ['白露', 9, 7], ['秋分', 9, 23], ['寒露', 10, 8], ['霜降', 10, 23],
  ['立冬', 11, 7], ['小雪', 11, 22], ['大雪', 12, 7], ['冬至', 12, 21]
];

const lunarNewYears = {
  2026: [2, 17],
  2027: [2, 6],
  2028: [1, 26],
  2029: [2, 13],
  2030: [2, 3],
  2031: [1, 23],
  2032: [2, 11],
  2033: [1, 31],
  2034: [2, 19],
  2035: [2, 8]
};

function dateOnly(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dayDiff(target, now) {
  const ms = dateOnly(target).getTime() - dateOnly(now).getTime();
  return Math.round(ms / 86400000);
}

function fixedDateInYear(item, year) {
  return new Date(year, item.month - 1, item.day);
}

export function getSpecialDates(date = new Date(), customDates = []) {
  const year = date.getFullYear();
  const fixed = [...fixedDates, ...customDates];
  const hits = [];

  for (const item of fixed) {
    for (const target of [fixedDateInYear(item, year), fixedDateInYear(item, year + 1)]) {
      const daysAway = dayDiff(target, date);
      if (daysAway >= 0 && daysAway <= 3) {
        hits.push({ ...item, daysAway, date: target.toISOString().slice(0, 10) });
        break;
      }
    }
  }

  for (const [name, month, day] of solarTerms) {
    const target = new Date(year, month - 1, day);
    const daysAway = dayDiff(target, date);
    if (daysAway >= 0 && daysAway <= 1) {
      hits.push({
        id: `solar-${month}-${day}`,
        type: 'solar-term',
        name,
        importance: daysAway === 0 ? 'medium' : 'low',
        moodHints: ['节气', '季节', '天气', '时间感'],
        daysAway,
        date: target.toISOString().slice(0, 10)
      });
    }
  }

  for (const lookupYear of [year, year + 1]) {
    const lunar = lunarNewYears[lookupYear];
    if (!lunar) continue;
    const target = new Date(lookupYear, lunar[0] - 1, lunar[1]);
    const daysAway = dayDiff(target, date);
    if (daysAway >= 0 && daysAway <= 3) {
      hits.push({
        id: `lunar-new-year-${lookupYear}`,
        type: 'festival',
        name: '春节/新年',
        importance: 'high',
        moodHints: ['团圆', '更新', '祝福', '回望'],
        daysAway,
        date: target.toISOString().slice(0, 10)
      });
      break;
    }
  }

  return hits.sort((a, b) => a.daysAway - b.daysAway);
}

export function getDefaultSpecialDateConfig() {
  return fixedDates;
}
