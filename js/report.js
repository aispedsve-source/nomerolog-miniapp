/*
 * Сборка и рендеринг структурированных отчётов.
 * Модель повторяет StructuredReport оригинала:
 *   StructuredReport { title, subtitle, meta, chips:[{k,v}], summary:[{label,value}], sections:[Section] }
 *   Section { title, subtitle?, values:[{label,value}], bulletGroups:[{title,bullets:[]}] }
 * Состав секций личной карты воспроизводит ReportComposer.composePersonalMap.
 */
import {
  calculateMap, calculatePersonalMonth, calculatePersonalDay, calculateAge,
} from './numerology.js';
import { DICT } from './data.js';

const pad = (n, w) => String(n).padStart(w, '0');
const reportDate = b => `${pad(b.day, 2)}.${pad(b.month, 2)}.${pad(b.year, 4)}`;

function lifeStageForAge(age) {
  const stages = DICT.lifeStages || [];
  for (const s of stages) {
    if (age >= s.minAge && age <= s.maxAge) return s;
  }
  return stages[stages.length - 1] || null;
}

const V = (label, value) => ({ label, value: String(value) });
const BG = (title, bullets) => ({ title, bullets: bullets || [] });

/**
 * «Средняя» карта — понятно и коротко: 5 карточек человеческим языком.
 * По умолчанию показываем именно её; полный разбор — по кнопке.
 */
export function composeMediumReport(birth, name) {
  const map = calculateMap(birth);
  const cn = map.consciousness, mn = map.mission, sn = map.sphere, py = map.personalYear;
  const num = DICT.numbers[cn];
  const mission = DICT.missions[mn];
  const sphere = DICT.spheres[sn];
  const year = DICT.personalYears[py];
  const money = DICT.money[cn];
  const now = new Date();
  const pMonth = calculatePersonalMonth(birth, now.getFullYear(), now.getMonth() + 1);
  const periodM = DICT.periods[pMonth];

  const sections = [];

  // 1. Кто ты
  sections.push({
    title: `Кто ты · ${num.archetype}`,
    subtitle: num.essence,
    values: [V('Чего хочешь по натуре', num.wants)],
    bulletGroups: [
      { title: 'Твои сильные стороны', bullets: num.strengths, chips: 'gold' },
      { title: 'Иногда мешает', bullets: num.shadows, chips: 'shadow' },
    ],
    badge: cn,
  });

  // 2. Миссия и где реализуешься
  sections.push({
    title: `Твоя миссия · ${mission.title}`,
    subtitle: mission.essence,
    values: [
      V('Куда расти', `${mission.growthTitle}. ${mission.growthAdvice}`),
      V('Где раскрываешься', sphere.constructiveVector),
    ],
    bulletGroups: [],
    badge: mn,
  });

  // 3. Что сейчас
  sections.push({
    title: `Сейчас · ${year.title}`,
    subtitle: `Твой личный год — ${py}. ${year.plus}`,
    values: [
      V('Совет на год', year.recommendation),
      V('Этот месяц', periodM.monthFocus),
    ],
    bulletGroups: [],
    badge: py,
  });

  // 4. Деньги и роли
  sections.push({
    title: 'Деньги и сильные роли',
    subtitle: money.moneyChannel,
    values: [],
    bulletGroups: [{ title: 'Тебе идут роли', bullets: money.strongRoles, chips: 'gold' }],
    badge: cn,
  });

  // 5. Матрица (визуально) + что наработать
  const missing = [];
  for (let d = 1; d <= 9; d++) if (map.matrix[d] === 0) missing.push(d);
  const growBits = missing.slice(0, 3).map(d => `${d} — ${DICT.matrixEnergy[d].meaning}`);
  sections.push({
    title: 'Матрица даты',
    subtitle: 'Какие энергии в твоей дате сильны, а каких меньше.',
    values: growBits.length ? [V('Стоит наработать', growBits.join('; '))] : [],
    bulletGroups: [],
    matrix: map.matrix,
    badge: '▦',
  });

  return {
    title: (name && name.trim()) ? name.trim() : 'Твоя карта',
    subtitle: 'Карта чисел',
    meta: `Дата рождения: ${reportDate(birth)}`,
    chips: [
      { k: 'Ты', v: cn }, { k: 'Миссия', v: mn },
      { k: 'Сфера', v: sn }, { k: 'Год', v: py },
    ],
    sections,
    map,
  };
}

/**
 * Персональная карта → StructuredReport (8 секций + сводка). Полный разбор (для PDF и «Подробнее»).
 * @param {object} birth {day,month,year}
 * @param {string} [name]
 */
export function composePersonalReport(birth, name) {
  const map = calculateMap(birth);
  const cn = map.consciousness, mn = map.mission, sn = map.sphere, py = map.personalYear;

  const num = DICT.numbers[cn];
  const day = DICT.consciousnessDays[birth.day];
  const shadow = DICT.shadows[cn];
  const karmic = DICT.karmic[cn];
  const money = DICT.money[cn];
  const mission = DICT.missions[mn];
  const sphere = DICT.spheres[sn];
  const year = DICT.personalYears[py];

  const now = new Date();
  const pMonth = calculatePersonalMonth(birth, now.getFullYear(), now.getMonth() + 1);
  const pDay = calculatePersonalDay(birth, now.getFullYear(), now.getMonth() + 1, now.getDate());
  const periodM = DICT.periods[pMonth];
  const periodD = DICT.periods[pDay];
  const age = calculateAge(birth, now.getFullYear(), now.getMonth() + 1, now.getDate());
  const stage = lifeStageForAge(age);
  const ageCycle = DICT.ageCycles[cn];

  const title = (name && name.trim()) ? name.trim() : 'Моя карта';

  // --- Сводка (12 значений) ---
  const summary = [
    V('Число Сознания', `${cn} · ${num.archetype} · ${num.planet}`),
    V('Точный день ЧС', `${birth.day} · ${day.title}`),
    V('Триггер ЧС', shadow.coreTrigger),
    V('Кармическая задача', karmic.coreTask),
    V('Деньги и реализация', money.title),
    V('Миссия', `${mn} · ${mission.title}`),
    V('Сфера', `${sn} · ${sphere.title}`),
    V('Личный год', `${py} · ${year.title}`),
    V('Личный месяц', `${pMonth} · ${periodM.title}`),
    V('Личный день', `${pDay} · ${periodD.title}`),
    V('Возрастной этап', `${age} лет · ${stage ? stage.title : '—'}`),
    V('Зрелость ЧС', ageCycle.maturityPoint),
  ];

  const sections = [];

  // 0. Обзор карты (14 значений)
  sections.push({
    title: 'Обзор карты',
    subtitle: (name && name.trim()) ? `Главные акценты профиля ${name.trim()}` : 'Главные акценты текущей карты',
    values: [
      V('Ключевая энергия', num.essence),
      V('Точный день ЧС', `${birth.day} · ${day.title}`),
      V('Главный триггер', shadow.coreTrigger),
      V('Кармическая задача', karmic.coreTask),
      V('Денежный канал', money.moneyChannel),
      V('Главная задача миссии', mission.goal),
      V('Вектор роста', `${mission.growthNumber} · ${mission.growthTitle}. ${mission.growthAdvice}`),
      V('Сфера реализации', sphere.constructiveVector),
      V('Тема личного года', year.plus),
      V('Личный месяц', `${pMonth} · ${periodM.monthFocus}`),
      V('Личный день', `${pDay} · ${periodD.dayFocus}`),
      V('Возрастной цикл', `${age} лет · ${stage ? stage.focus : '—'}`),
      V('Акцент зрелости ЧС', ageCycle.maturityPoint),
      V('Фокус периода', year.recommendation),
    ],
    bulletGroups: [],
  });

  // 1. Сознание и точный день
  sections.push({
    title: 'Сознание и точный день',
    subtitle: num.wants,
    values: [
      V('Число Сознания', `${cn} · ${num.archetype}. ${num.essence}`),
      V('Точный день', `${birth.day} · ${day.title}`),
      V('Формула', day.formula),
      V('Суть дня', day.essence),
      V('Риск дня', day.risk),
      V('Вектор роста', day.growthFocus),
      V('Практика', day.practice),
    ],
    bulletGroups: [
      BG('Сильные стороны', num.strengths),
      BG('Тени', num.shadows),
      BG('Триггеры', num.triggers),
      BG('Ресурс точного дня', day.strengths),
    ],
  });

  // 2. Триггеры и тени
  sections.push({
    title: 'Триггеры и тени',
    subtitle: shadow.title,
    values: [
      V('Главный триггер', shadow.coreTrigger),
      V('Теневая программа', shadow.shadowPattern),
      V('Защитная реакция', shadow.defensiveReaction),
      V('Риск в отношениях', shadow.relationshipRisk),
      V('Риск в работе', shadow.workRisk),
      V('Вернуться в плюс', shadow.returnToPlus),
      V('Вопрос настройки', shadow.selfQuestion),
    ],
    bulletGroups: [
      BG('Сигналы ухода в минус', shadow.triggerSignals),
      BG('Антидоты', shadow.antidotes),
    ],
  });

  // 3. Кармическая задача
  sections.push({
    title: 'Кармическая задача',
    subtitle: karmic.title,
    values: [
      V('Главный урок', karmic.coreTask),
      V('Повторяющийся сценарий', karmic.repeatingPattern),
      V('Что отпустить', karmic.whatToRelease),
      V('Что развивать', karmic.whatToDevelop),
      V('В отношениях', karmic.inRelationships),
      V('В работе', karmic.inWork),
      V('Связь с тенью', shadow.shadowPattern),
      V('Связь с миссией', `Миссия ${mn}: ${mission.goal}`),
      V('Точный день подсказывает', day.growthFocus),
      V('Фраза настройки', karmic.affirmation),
    ],
    bulletGroups: [BG('Практики', karmic.practices)],
  });

  // 4. Деньги и реализация
  sections.push({
    title: 'Деньги и реализация',
    subtitle: money.title,
    values: [
      V('Денежный канал', money.moneyChannel),
      V('Стиль реализации', money.realizationStyle),
      V('Как зарабатывать', money.earningMode),
      V('Сфера реализации', `Сфера ${sn}: ${sphere.professionFocus}`),
      V('Связь с миссией', `Миссия ${mn}: ${mission.growthAdvice}`),
      V('Кармический урок в деньгах', karmic.whatToDevelop),
      V('Теневая ловушка', shadow.workRisk),
      V('Практика', money.growthPractice),
    ],
    bulletGroups: [
      BG('Сильные рабочие роли', money.strongRoles),
      BG('Где деньги блокируются', money.moneyBlocks),
      BG('Риски в реализации', money.workRisks),
      BG('Что усиливает доход', money.recommendations),
    ],
  });

  // 5. Личный месяц и день
  sections.push({
    title: 'Личный месяц и день',
    subtitle: 'Текущий тактический фокус периода.',
    values: [
      V('Личный год', `${year.title}. ${year.recommendation}`),
      V('Личный месяц', `${periodM.monthFocus} Плюс: ${periodM.plus}. Тень: ${periodM.shadow}.`),
      V('Личный день', `${periodD.dayFocus} Практика: ${periodD.practice}`),
      V('Чего избегать', periodM.avoid),
    ],
    bulletGroups: [BG('Подходящие действия', periodM.actions)],
  });

  // 6. Возрастные циклы
  sections.push({
    title: 'Возрастные циклы',
    subtitle: ageCycle.title,
    values: [
      V('Текущий этап', stage ? `${stage.task} ${stage.recommendation}` : '—'),
      V('Точка созревания', ageCycle.maturityPoint),
      V('Ранний паттерн', ageCycle.earlyPattern),
      V('Период включения', ageCycle.activationPeriod),
      V('Зрелый фокус', ageCycle.matureFocus),
      V('Ключевой вызов', ageCycle.keyChallenge),
      V('Ресурс зрелости', ageCycle.resourceAfterMaturity),
    ],
    bulletGroups: [BG('Практики', ageCycle.practices)],
  });

  // 7. Матрица даты
  const matrixLine = [];
  for (let d = 1; d <= 9; d++) matrixLine.push(`${d}:${map.matrix[d]}`);
  const matrixBullets = [];
  if (map.activeLines.length) {
    matrixBullets.push(BG('Активные линии',
      map.activeLines.map(l => `${l.title} (${l.numbers.join('-')}) — ${l.description}`)));
  }
  const missing = [];
  for (let d = 1; d <= 9; d++) if (map.matrix[d] === 0) missing.push(d);
  if (missing.length) {
    matrixBullets.push(BG('Энергии для наработки',
      missing.map(d => `${d} — ${DICT.matrixEnergy[d].absenceAdvice}`)));
  }
  sections.push({
    title: 'Матрица даты',
    subtitle: 'Повторяющиеся и недостающие энергии даты рождения.',
    values: [V('Матрица', matrixLine.join('  '))],
    bulletGroups: matrixBullets,
    matrix: map.matrix, // спец-поле для графического рендера
  });

  return {
    title: `Nomerolog · ${title}`,
    subtitle: 'Персональная карта',
    meta: `Дата рождения: ${reportDate(birth)}`,
    chips: [
      { k: 'ЧС', v: cn }, { k: 'Миссия', v: mn },
      { k: 'Сфера', v: sn }, { k: 'Год', v: py },
    ],
    summary,
    sections,
    map,
  };
}
