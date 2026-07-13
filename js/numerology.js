/*
 * Движок нумерологических расчётов.
 * Порт формул из приложения Nomerolog (org.glerus.nomerolog).
 * Чистая арифметика — без побочных эффектов, без сети.
 * Подробный разбор формул см. в ФОРМУЛЫ.md
 */

// --- 0. Базовые операции ---

/** Цифровой корень в диапазоне 1..9 (девятка не сворачивается в 0). 0 остаётся 0. */
export function reduceToOneDigit(n) {
  if (n < 0) throw new Error('value must be non-negative');
  if (n === 0) return 0;
  const r = n % 9;
  return r === 0 ? 9 : r;
}

/** Цифры даты: склейка str(day)+str(month)+str(year) без ведущих нулей, затем все цифры. */
export function dateDigits(day, month, year) {
  const s = `${day}${month}${year}`;
  const out = [];
  for (const ch of s) {
    const d = ch.charCodeAt(0) - 48;
    if (d >= 0 && d <= 9) out.push(d);
  }
  return out;
}

/** Сумма цифр целого числа (для года). */
function digitSum(n) {
  let s = 0;
  for (const ch of String(Math.abs(n))) s += ch.charCodeAt(0) - 48;
  return s;
}

// --- Календарь ---

function isLeapYear(y) {
  return y % 400 === 0 || (y % 4 === 0 && y % 100 !== 0);
}

function daysInMonth(month, year) {
  switch (month) {
    case 1: case 3: case 5: case 7: case 8: case 10: case 12: return 31;
    case 4: case 6: case 9: case 11: return 30;
    case 2: return isLeapYear(year) ? 29 : 28;
    default: return 0;
  }
}

// --- 1. Личная карта ---

/** @typedef {{day:number, month:number, year:number}} BirthDate */

const LINES = [
  { key: 'money',          title: 'Линия денег',         numbers: [1, 4, 7], description: 'Цель, решение и действие складываются в крепкую материальную опору.' },
  { key: 'understanding',  title: 'Линия понимания',     numbers: [2, 5, 8], description: 'Общение, спокойствие и опыт учат понимать людей и процессы.' },
  { key: 'service',        title: 'Линия служения',      numbers: [3, 6, 9], description: 'Знание, любовь и дело раскрываются через пользу для других.' },
  { key: 'health',         title: 'Линия здоровья',      numbers: [1, 2, 3], description: 'Внутренняя энергия, чуткость и анализ дают устойчивость.' },
  { key: 'intellect',      title: 'Линия интеллекта',    numbers: [4, 5, 6], description: 'Замысел, логика и зрелость помогают развивать идеи вширь.' },
  { key: 'transformation', title: 'Линия трансформации', numbers: [7, 8, 9], description: 'Запас силы для перемен, результата и глубоких сдвигов в жизни.' },
  { key: 'communication',  title: 'Линия коммуникации',  numbers: [1, 5, 9], description: 'Инициатива, контакт и действие рождают дружбу и движение.' },
  { key: 'success',        title: 'Линия успеха',        numbers: [3, 5, 7], description: 'Анализ, общение и быстрое воплощение усиливают возможности.' },
];

/** Матрица: сколько раз каждая цифра 1..9 встречается в цифрах даты. */
export function calculateMatrix(birth) {
  const counts = {};
  for (let d = 1; d <= 9; d++) counts[d] = 0;
  for (const d of dateDigits(birth.day, birth.month, birth.year)) {
    if (d >= 1 && d <= 9) counts[d] += 1;
  }
  return counts;
}

/** Активные линии: те, у которых все цифры присутствуют в матрице. */
export function detectActiveLines(matrix) {
  return LINES.filter(line => line.numbers.every(n => matrix[n] > 0));
}

/** Личный год: reduce( reduce(day+month) + reduce(суммаЦифр(year)) ). */
export function calculatePersonalYear(birth, year) {
  const base = reduceToOneDigit(birth.day + birth.month);
  const yr = reduceToOneDigit(digitSum(year));
  return reduceToOneDigit(base + yr);
}

/** Личный месяц: reduce(личныйГод + календарныйМесяц). */
export function calculatePersonalMonth(birth, year, month) {
  return reduceToOneDigit(calculatePersonalYear(birth, year) + month);
}

/** Личный день: reduce(личныйМесяц + календарныйДень). */
export function calculatePersonalDay(birth, year, month, day) {
  return reduceToOneDigit(calculatePersonalMonth(birth, year, month) + day);
}

/** Возраст на дату (year, month, day). */
export function calculateAge(birth, year, month, day) {
  let a = year - birth.year;
  if (month < birth.month || (month === birth.month && day < birth.day)) a -= 1;
  return Math.max(a, 0);
}

/**
 * Полная карта по дате рождения.
 * @param {BirthDate} birth
 * @param {number} [refYear] опорный год (по умолчанию текущий)
 */
export function calculateMap(birth, refYear = new Date().getFullYear()) {
  const consciousness = reduceToOneDigit(birth.day);
  const digits = dateDigits(birth.day, birth.month, birth.year);
  const mission = reduceToOneDigit(digits.reduce((a, b) => a + b, 0));
  const sphere = reduceToOneDigit(2 * mission - 1);
  const personalYear = calculatePersonalYear(birth, refYear);
  const matrix = calculateMatrix(birth);
  const activeLines = detectActiveLines(matrix);
  return { birth, consciousness, mission, sphere, personalYear, matrix, activeLines };
}

// --- Разбор строки даты ---

/**
 * Парсит дату рождения из свободного ввода.
 * @returns {{ok:true, value:BirthDate} | {ok:false, error:string}}
 */
/** Строгий разбор целого (аналог Kotlin toIntOrNull): только цифры целиком. */
function toIntStrict(s) {
  return /^\d+$/.test(String(s).trim()) ? parseInt(s, 10) : NaN;
}

export function parseBirthDate(input) {
  const raw = String(input || '').trim();
  if (!raw) return { ok: false, error: 'Введите дату рождения' };

  const onlyDigits = raw.replace(/[^0-9]/g, '');
  let day, month, year;

  if (onlyDigits.length === 8) {
    day = parseInt(onlyDigits.slice(0, 2), 10);
    month = parseInt(onlyDigits.slice(2, 4), 10);
    year = parseInt(onlyDigits.slice(4, 8), 10);
  } else {
    const parts = raw.split(/[./\- ]+/).filter(Boolean);
    if (parts.length !== 3) return { ok: false, error: 'Введите дату полностью: ДД.ММ.ГГГГ' };
    day = toIntStrict(parts[0]);
    month = toIntStrict(parts[1]);
    year = toIntStrict(parts[2]);
  }

  if ([day, month, year].some(Number.isNaN)) {
    return { ok: false, error: 'Дата должна состоять только из цифр' };
  }
  const nowYear = new Date().getFullYear();
  if (year < 1900) return { ok: false, error: 'Укажите год не раньше 1900' };
  if (year > nowYear) return { ok: false, error: 'Год не может быть в будущем' };
  if (month < 1 || month > 12) return { ok: false, error: 'Месяц должен быть от 01 до 12' };
  if (day < 1 || day > daysInMonth(month, year)) return { ok: false, error: 'Такой даты не существует' };

  const now = new Date();
  const d = new Date(year, month - 1, day);
  now.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  if (d > now) return { ok: false, error: 'Дата рождения не может быть в будущем' };

  return { ok: true, value: { day, month, year } };
}

/**
 * Разбор календарной даты, которая МОЖЕТ быть в будущем (дата свадьбы, дата события).
 * Повторяет MarriageDateCalculator.parseDate / EventDateCalculator.parseEventDate:
 * 8 цифр ДДММГГГГ, год 1900–2100, без проверки «не в будущем».
 * @param {string} input
 * @param {string} emptyMsg сообщение при пустом вводе
 */
export function parseFutureDate(input, emptyMsg = 'Введите дату') {
  const raw = String(input || '').trim();
  if (!raw) return { ok: false, error: emptyMsg };
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length !== 8) return { ok: false, error: 'Введите дату полностью: ДД.ММ.ГГГГ' };
  const day = parseInt(digits.slice(0, 2), 10);
  const month = parseInt(digits.slice(2, 4), 10);
  const year = parseInt(digits.slice(4, 8), 10);
  if (year < 1900 || year > 2100) return { ok: false, error: 'Укажите год в диапазоне 1900–2100' };
  if (month < 1 || month > 12) return { ok: false, error: 'Месяц должен быть от 01 до 12' };
  if (day < 1 || day > daysInMonth(month, year)) return { ok: false, error: 'Такой даты не существует' };
  return { ok: true, value: { day, month, year } };
}

// --- Маска ввода даты (порт BirthDateInputFormatter) ---

export function dateDigitCount(input) {
  let n = 0;
  for (const ch of String(input || '')) if (ch >= '0' && ch <= '9') n++;
  return Math.min(n, 8);
}

/** Форматирует ввод в ДД.ММ.ГГГГ по мере набора (точки после 2-й и 4-й цифры). */
export function formatDateInput(input) {
  let digits = '';
  for (const ch of String(input || '')) if (ch >= '0' && ch <= '9') digits += ch;
  digits = digits.slice(0, 8);
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i === 2 || i === 4) out += '.';
    out += digits[i];
  }
  return out;
}

export function dateHelperText(input) {
  const n = dateDigitCount(input);
  if (n === 0) return 'Введите 8 цифр: день, месяц и год';
  if (n >= 8) return 'Формат готов: ДД.ММ.ГГГГ';
  return `Набрано ${n} из 8 цифр`;
}

export function isDateComplete(input) {
  return dateDigitCount(input) === 8;
}

// --- 2. Совместимость (базовая) ---

function goalGroup(cn) {
  switch (cn) {
    case 1: case 3: case 8: return 'material';
    case 2: case 4: case 9: return 'relationships';
    case 5: return 'communication';
    case 6: return 'comfort';
    case 7: return 'spiritual';
    default: return 'unknown';
  }
}

function isConflictPair(a, b) {
  const s = new Set([a, b]);
  return (s.has(1) && s.has(7)) || (s.has(3) && s.has(6));
}

function commonLineTitles(mapA, mapB) {
  const a = new Set(mapA.activeLines.map(l => l.title));
  const b = new Set(mapB.activeLines.map(l => l.title));
  return [...a].filter(t => b.has(t));
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/**
 * Базовая совместимость двух карт.
 * @returns {{score:number, verdict:string, strengths:string[], tensions:string[], group:string}}
 */
export function calculateCompatibility(mapA, mapB) {
  let score = 50;
  const strengths = [];
  const tensions = [];

  // Сознание
  if (mapA.consciousness === mapB.consciousness) {
    score += 12;
  } else if (goalGroup(mapA.consciousness) === goalGroup(mapB.consciousness)) {
    score += 8;
  } else {
    score += 2;
  }

  // Миссия
  if (mapA.mission === mapB.mission) {
    score += 8;
  } else if (mapA.mission === mapB.consciousness || mapB.mission === mapA.consciousness) {
    score += 7;
  } else {
    score += 1;
  }

  // Общие линии
  const common = commonLineTitles(mapA, mapB);
  if (common.length > 0) score += Math.min(common.length * 4, 12);

  // Конфликтная пара
  if (isConflictPair(mapA.consciousness, mapB.consciousness)) score -= 10;

  // Личный год
  if (mapA.personalYear === mapB.personalYear) score += 4;

  score = clamp(score, 25, 95);

  let verdict;
  if (score >= 80) verdict = 'сильная совместимость';
  else if (score >= 65) verdict = 'хороший потенциал';
  else if (score >= 50) verdict = 'рабочая совместимость';
  else verdict = 'требуется осознанная настройка';

  return { score, verdict, commonLines: common };
}

// --- 3. Карта пары ---

export function calculatePairMap(mapA, mapB) {
  const pairCode = reduceToOneDigit(mapA.consciousness + mapB.consciousness);
  const pairMission = reduceToOneDigit(mapA.mission + mapB.mission);
  const common = commonLineTitles(mapA, mapB);
  const energiesA = Object.keys(mapA.matrix).filter(k => mapA.matrix[k] > 0).map(Number);
  const energiesB = new Set(Object.keys(mapB.matrix).filter(k => mapB.matrix[k] > 0).map(Number));
  const commonEnergies = energiesA.filter(e => energiesB.has(e)).sort((a, b) => a - b);
  return { pairCode, pairMission, commonLines: common, commonEnergies };
}

// --- 4. Глубокая совместимость ---

export function calculateDeepCompatibility(mapA, mapB) {
  const base = calculateCompatibility(mapA, mapB);
  let score = base.score;

  const pairCode = reduceToOneDigit(mapA.consciousness + mapB.consciousness);
  const pairMission = reduceToOneDigit(mapA.mission + mapB.mission);
  const common = commonLineTitles(mapA, mapB);

  // Общие ПРИСУТСТВУЮЩИЕ энергии (для текста отчёта)
  const energiesA = Object.keys(mapA.matrix).filter(k => mapA.matrix[k] > 0).map(Number);
  const energiesB = new Set(Object.keys(mapB.matrix).filter(k => mapB.matrix[k] > 0).map(Number));
  const commonEnergies = energiesA.filter(e => energiesB.has(e)).sort((a, b) => a - b);

  // Общие НЕДОСТАЮЩИЕ энергии (обе матрицы == 0) — именно на них штраф в оригинале
  const commonMissing = [];
  for (let d = 1; d <= 9; d++) {
    if (mapA.matrix[d] === 0 && mapB.matrix[d] === 0) commonMissing.push(d);
  }

  if (pairCode === pairMission) score += 5;
  if (common.length >= 2) score += 4;
  if (commonMissing.length >= 3) score -= 5;
  if (Math.abs(mapA.consciousness - mapB.consciousness) >= 5) score -= 3;

  score = clamp(score, 20, 98);

  let verdict;
  if (score >= 85) verdict = 'глубокий ресурсный союз';
  else if (score >= 70) verdict = 'сильная пара с точками роста';
  else if (score >= 55) verdict = 'пара для осознанной настройки';
  else verdict = 'союз с высокой учебной нагрузкой';

  // Взаимодополняющие энергии (есть у одного, нет у другого)
  const complementary = [];
  for (let d = 1; d <= 9; d++) {
    const inA = mapA.matrix[d] > 0;
    const inB = mapB.matrix[d] > 0;
    if (inA !== inB) complementary.push(d);
  }

  return { score, verdict, pairCode, pairMission, commonLines: common, commonEnergies, commonMissing, complementary };
}

// --- 5. Дата свадьбы ---

export function calculateMarriageDate(marriage, mapA, mapB) {
  const dayEnergy = reduceToOneDigit(dateDigits(marriage.day, marriage.month, marriage.year).reduce((a, b) => a + b, 0));
  const pairCode = reduceToOneDigit(mapA.consciousness + mapB.consciousness);
  const dateMission = reduceToOneDigit(dayEnergy + pairCode + reduceToOneDigit(mapA.mission + mapB.mission));
  const common = commonLineTitles(mapA, mapB);

  let score = 58;
  if (dayEnergy === 2 || dayEnergy === 6) score += 12;
  if (dateMission === 2 || dateMission === 6) score += 10;
  if (dayEnergy === pairCode) score += 9;
  if (mapA.sphere === mapB.sphere) score += 5;
  if (mapA.mission === mapB.mission) score += 4;
  score += common.length * 3;
  if (mapA.personalYear === dayEnergy || mapB.personalYear === dayEnergy) score += 4;
  if (dayEnergy === 7 || dayEnergy === 8) score -= 5;

  score = clamp(score, 35, 96);

  let verdict;
  if (score >= 84) verdict = 'очень гармоничная дата';
  else if (score >= 70) verdict = 'хорошая дата';
  else if (score >= 56) verdict = 'нейтральная дата';
  else verdict = 'дата требует мягкой настройки';

  return { score, verdict, dayEnergy, dateMission };
}

// --- 6. Дата события ---

export function calculateEventDate(event) {
  const number = reduceToOneDigit(dateDigits(event.day, event.month, event.year).reduce((a, b) => a + b, 0));
  return { number };
}

// --- 7. Карта семьи ---

export function calculateFamilyMap(maps) {
  const familyCode = reduceToOneDigit(maps.reduce((a, m) => a + m.consciousness, 0));
  const familyMission = reduceToOneDigit(maps.reduce((a, m) => a + m.mission, 0));

  // Линии, активные минимум у 2 участников
  const lineCount = {};
  for (const m of maps) {
    for (const l of m.activeLines) lineCount[l.title] = (lineCount[l.title] || 0) + 1;
  }
  const commonLines = Object.keys(lineCount).filter(t => lineCount[t] >= 2).sort();

  // Агрегированная матрица
  const matrix = {};
  for (let d = 1; d <= 9; d++) matrix[d] = 0;
  for (const m of maps) for (let d = 1; d <= 9; d++) matrix[d] += m.matrix[d];

  return { familyCode, familyMission, commonLines, matrix, size: maps.length };
}

// --- 8. Текстовый код ---

const LAT = 'abcdefghijklmnopqrstuvwxyz';
const CYR = 'абвгдеёжзийклмнопрстуфхцчшщъыьэюя';

function letterValue(ch) {
  const c = ch.toLowerCase();
  let i = LAT.indexOf(c);
  if (i < 0) i = CYR.indexOf(c);
  if (i < 0) return 0;
  return (i % 9) + 1;
}

/** Код имени: сумма значений букв, свёрнутая к одной цифре. Мин. 2 буквы. */
export function calculateNameCode(input) {
  const s = String(input || '').trim();
  if (s.length < 2) return { ok: false, error: 'Введите имя или название минимум из 2 букв' };
  const vals = [];
  for (const ch of s) {
    const v = letterValue(ch);
    if (v > 0) vals.push(v);
  }
  if (vals.length === 0) return { ok: false, error: 'В тексте должны быть буквы' };
  const number = reduceToOneDigit(vals.reduce((a, b) => a + b, 0));
  return { ok: true, number, source: s };
}

/** Код объекта (номер/адрес): цифры и буквы. */
export function calculateObjectCode(input) {
  const s = String(input || '').trim();
  if (!s) return { ok: false, error: 'Введите номер, адрес или короткий текст' };
  const vals = [];
  for (const ch of s) {
    if (ch >= '0' && ch <= '9') {
      const d = ch.charCodeAt(0) - 48;
      if (d > 0) vals.push(d);
    } else if (/[a-zа-яё]/i.test(ch)) {
      const v = letterValue(ch);
      if (v > 0) vals.push(v);
    }
  }
  if (vals.length === 0) return { ok: false, error: 'Нужны цифры или буквы для расчёта' };
  const number = reduceToOneDigit(vals.reduce((a, b) => a + b, 0));
  return { ok: true, number, source: s };
}
