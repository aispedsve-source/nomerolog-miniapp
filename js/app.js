import {
  parseBirthDate, formatDateInput, dateHelperText, calculateMap,
  calculatePersonalMonth, calculatePersonalDay, calculateAge,
} from './numerology.js';
import { DICT } from './data.js';
import { composePersonalReport, composeMediumReport } from './report.js';
import * as store from './store.js';
import * as tg from './telegram.js';
import { renderReport, sectionCard, el, esc, chipsHtml, toast } from './render.js';
import { initExtra } from './extra.js';
import { exportReportPdf } from './pdf.js';
import { initAi } from './ai.js';

tg.initTelegram();

// Контекст карты для ИИ (числа уже посчитаны; ИИ ничего не пересчитывает)
function aiContext() {
  if (!state.currentBirth) return null;
  const b = state.currentBirth;
  const m = calculateMap(b);
  const now = new Date();
  return {
    consciousness: m.consciousness,
    consciousnessArchetype: DICT.numbers[m.consciousness]?.archetype,
    mission: m.mission,
    sphere: m.sphere,
    personalYear: m.personalYear,
    personalMonth: calculatePersonalMonth(b, now.getFullYear(), now.getMonth() + 1),
    personalDay: calculatePersonalDay(b, now.getFullYear(), now.getMonth() + 1, now.getDate()),
    birthDateLabel: store.birthDateLabel(b),
    name: state.currentName || undefined,
  };
}
const ai = initAi({ tg, getContext: aiContext });

const state = {
  screen: 'map',
  currentBirth: null,   // {day,month,year}
  currentName: null,
  currentReport: null,
};

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

// ================= Навигация =================
function goto(screen) {
  state.screen = screen;
  $$('.screen').forEach(s => s.classList.toggle('is-active', s.dataset.screen === screen));
  $$('.nav-btn').forEach(b => b.classList.toggle('is-active', b.dataset.screen === screen));
  window.scrollTo({ top: 0, behavior: 'instant' });
  if (screen === 'numbers') renderNumbers();
  if (screen === 'profiles') renderProfiles();
  if (screen === 'mission') renderMission();
  if (screen === 'year') renderYear();
  if (screen === 'extra') renderExtra();
}
$('#nav').addEventListener('click', e => {
  const btn = e.target.closest('.nav-btn');
  if (!btn) return;
  tg.haptic('light');
  goto(btn.dataset.screen);
});

// ================= Маска ввода даты =================
function attachDateMask(input, helper) {
  input.addEventListener('input', () => {
    const start = input.selectionStart;
    const before = input.value;
    input.value = formatDateInput(input.value);
    if (helper) helper.textContent = dateHelperText(input.value);
    // грубая коррекция каретки при добавлении точки
    if (input.value.length > before.length && (start === 3 || start === 6)) {
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });
}
attachDateMask($('#birth-input'), $('#map-helper'));
attachDateMask($('#prof-date'), null);

// ================= Вкладка КАРТА =================
function calcCard() {
  const parsed = parseBirthDate($('#birth-input').value);
  const helper = $('#map-helper');
  if (!parsed.ok) { helper.textContent = parsed.error; $('#map-results').innerHTML = ''; tg.haptic('error'); return; }
  helper.textContent = '';
  tg.haptic('success');

  state.currentBirth = parsed.value;
  state.currentName = null;
  const medium = composeMediumReport(parsed.value);
  state.currentReport = medium;
  renderReport($('#map-results'), medium, { actions: personalActions(parsed.value, null) });
  $('#map-save').style.display = '';
  $('#map-results').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
$('#map-calc').addEventListener('click', calcCard);
$('#birth-input').addEventListener('keydown', e => { if (e.key === 'Enter') calcCard(); });

$('#map-save').addEventListener('click', async () => {
  if (!state.currentBirth) return;
  const name = (state.currentName || '').trim() ||
    (await promptName('Имя для профиля', store.birthDateLabel(state.currentBirth)));
  if (name === null) return;
  try {
    store.addProfile(name || 'Без имени', state.currentBirth);
    tg.haptic('success');
    toast('Профиль сохранён');
  } catch (e) { toast(e.message); }
});

// простой промпт (Telegram не даёт prompt, поэтому используем свой)
function promptName(title, def) {
  return new Promise(resolve => {
    const name = window.prompt ? window.prompt(title, def || '') : (def || 'Профиль');
    resolve(name);
  });
}

// Кнопки под картой: спросить ИИ + поделиться + PDF + сворачиваемый полный разбор
function personalActions(birth, name) {
  const container = el('div');
  container.style.marginTop = '4px';

  // ИИ — заметная кнопка
  const explain = el('button', 'btn btn-primary', '🔮 Спросить нумеролога');
  explain.style.marginBottom = '10px';
  explain.addEventListener('click', () => {
    tg.haptic('light');
    ai.open('Расскажи про меня подробнее и что мне сейчас важнее всего?');
  });
  container.appendChild(explain);

  const wrap = el('div', 'btn-row');
  const share = el('button', 'btn btn-ghost', '↗ Поделиться');
  share.addEventListener('click', () => {
    tg.haptic('light');
    const text = shareTextFromReport(composeMediumReport(birth, name));
    if (!tg.shareText(text)) {
      navigator.clipboard?.writeText(text).then(() => toast('Скопировано')).catch(() => {});
    }
  });
  wrap.appendChild(share);

  const pdf = el('button', 'btn btn-ghost', '⤓ PDF');
  pdf.addEventListener('click', async () => {
    if (!store.isPremiumUnlocked()) {
      toast('PDF-отчёты — в пакете «Экстра»');
      goto('extra');
      return;
    }
    pdf.disabled = true; pdf.textContent = 'Готовим…';
    try { await exportReportPdf(composePersonalReport(birth, name)); tg.haptic('success'); }
    catch (e) { toast('Не удалось создать PDF'); }
    finally { pdf.disabled = false; pdf.textContent = '⤓ PDF'; }
  });
  wrap.appendChild(pdf);
  container.appendChild(wrap);

  // Полный разбор — по желанию, свёрнут
  const moreBtn = el('button', 'btn btn-ghost btn-sm', 'Полный разбор ▾');
  moreBtn.style.marginTop = '10px';
  const fullBox = el('div');
  fullBox.style.display = 'none';
  let rendered = false;
  moreBtn.addEventListener('click', () => {
    tg.haptic('light');
    if (fullBox.style.display === 'none') {
      if (!rendered) {
        rendered = true;
        const full = composePersonalReport(birth, name);
        full.sections.forEach((s, i) => fullBox.appendChild(sectionCard(s, s.badge != null ? s.badge : String(i + 1))));
      }
      fullBox.style.display = 'block';
      moreBtn.textContent = 'Свернуть ▴';
      fullBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      fullBox.style.display = 'none';
      moreBtn.textContent = 'Полный разбор ▾';
    }
  });
  container.appendChild(moreBtn);
  container.appendChild(fullBox);

  return container;
}

function shareTextFromReport(report) {
  const lines = [report.title, report.subtitle, report.meta, ''];
  report.chips.forEach(c => lines.push(`${c.k}: ${c.v}`));
  lines.push('');
  (report.sections || []).slice(0, 4).forEach(s => { if (s.subtitle) lines.push(`• ${s.title}: ${s.subtitle}`); });
  lines.push('', 'Рассчитано в приложении «Нумеролог».');
  return lines.join('\n');
}

// ================= Вкладка МИССИЯ =================
function renderMission() {
  const box = $('#mission-results');
  if (!state.currentBirth) { box.innerHTML = ''; return; }
  const map = calculateMap(state.currentBirth);
  const mission = DICT.missions[map.mission];
  const sphere = DICT.spheres[map.sphere];
  const num = DICT.numbers[map.consciousness];
  box.innerHTML = '';
  box.appendChild(sectionCard({
    title: `Миссия ${map.mission} · ${mission.title}`,
    subtitle: mission.essence,
    values: [
      { label: 'Цель', value: mission.goal },
      { label: 'Как разрушается', value: mission.destroysBy },
      { label: 'Вектор роста', value: `${mission.growthNumber} · ${mission.growthTitle}. ${mission.growthAdvice}` },
    ],
    bulletGroups: [
      { title: 'Сильные стороны', bullets: mission.strengths },
      { title: 'Тени', bullets: mission.shadows },
      { title: 'Ошибочные сценарии', bullets: mission.wrongPatterns },
      { title: 'Практики', bullets: mission.practices },
    ],
  }, map.mission));
  box.appendChild(sectionCard({
    title: `Сфера ${map.sphere} · ${sphere.title}`,
    subtitle: 'Область реализации',
    values: [
      { label: 'Конструктивный вектор', value: sphere.constructiveVector },
      { label: 'Деструктивный вектор', value: sphere.destructiveVector },
      { label: 'Фокус профессии', value: sphere.professionFocus },
      { label: 'Рекомендация', value: sphere.recommendation },
    ],
    bulletGroups: [],
  }, map.sphere));
  box.appendChild(sectionCard({
    title: `Число Сознания ${map.consciousness} · ${num.archetype}`,
    subtitle: num.essence,
    values: [{ label: 'Совет по миссии', value: num.missionAdvice }],
    bulletGroups: [{ title: 'Сильные стороны', bullets: num.strengths }],
  }, map.consciousness));
}

// ================= Вкладка ГОД =================
function renderYear() {
  const box = $('#year-results');
  if (!state.currentBirth) { box.innerHTML = ''; return; }
  const b = state.currentBirth;
  const map = calculateMap(b);
  const now = new Date();
  const pMonth = calculatePersonalMonth(b, now.getFullYear(), now.getMonth() + 1);
  const pDay = calculatePersonalDay(b, now.getFullYear(), now.getMonth() + 1, now.getDate());
  const year = DICT.personalYears[map.personalYear];
  const periodM = DICT.periods[pMonth];
  const periodD = DICT.periods[pDay];

  box.innerHTML = '';
  box.appendChild(sectionCard({
    title: `Личный год ${map.personalYear} · ${year.title}`,
    subtitle: `${now.getFullYear()} год`,
    values: [
      { label: 'В плюсе', value: year.plus },
      { label: 'В минусе', value: year.minus },
      { label: 'Рекомендация', value: year.recommendation },
      { label: 'Чего избегать', value: year.avoid },
    ],
    bulletGroups: [],
  }, map.personalYear));
  box.appendChild(sectionCard({
    title: `Личный месяц ${pMonth} · ${periodM.title}`,
    subtitle: periodM.monthFocus,
    values: [
      { label: 'В плюсе', value: periodM.plus },
      { label: 'Тень', value: periodM.shadow },
      { label: 'Практика', value: periodM.practice },
    ],
    bulletGroups: [
      { title: 'Подходящие действия', bullets: periodM.actions },
      { title: 'Чего избегать', bullets: periodM.avoid ? [periodM.avoid] : [] },
    ],
  }, pMonth));
  box.appendChild(sectionCard({
    title: `Личный день ${pDay} · ${periodD.title}`,
    subtitle: periodD.dayFocus,
    values: [
      { label: 'В плюсе', value: periodD.plus },
      { label: 'Практика', value: periodD.practice },
    ],
    bulletGroups: [],
  }, pDay));
}

// ================= Вкладка ЧИСЛА (справочник) =================
let numbersRendered = false;
function renderNumbers() {
  if (numbersRendered) return;
  numbersRendered = true;
  const box = $('#numbers-results');
  box.innerHTML = '';

  // Секция: Числа Сознания
  box.appendChild(el('div', 'section-sub', 'ЧИСЛА СОЗНАНИЯ'));
  for (let n = 1; n <= 9; n++) {
    const num = DICT.numbers[n];
    box.appendChild(refItem(`${n} · ${esc(num.planet)}`, `${esc(num.archetype)}. ${esc(num.essence)}`, `
      <div class="bullet-group"><div class="bg-title">Плюс</div>${chipsHtml(num.strengths, 'chip gold')}</div>
      <div class="bullet-group"><div class="bg-title">Тень</div>${chipsHtml(num.shadows, 'chip shadow')}</div>
      <div class="value-row"><div class="vk">Хочет</div><div class="vv">${esc(num.wants)}</div></div>
      <div class="value-row"><div class="vk">Кармическая задача</div><div class="vv">${esc(num.karmicTask)}</div></div>
      <div class="value-row"><div class="vk">Профориентация</div><div class="vv">${esc(num.careerVector)}</div></div>`));
  }

  // Секция: Сферы реализации
  box.appendChild(el('div', 'section-sub', 'СФЕРЫ РЕАЛИЗАЦИИ'));
  for (let n = 1; n <= 9; n++) {
    const s = DICT.spheres[n];
    box.appendChild(refItem(`Сфера ${n}: ${esc(s.title)}`, esc(s.constructiveVector), `
      <div class="value-row"><div class="vk">Профессиональный фокус</div><div class="vv">${esc(s.professionFocus)}</div></div>
      <div class="value-row"><div class="vk">В минусе</div><div class="vv">${esc(s.destructiveVector)}</div></div>
      <div class="value-row"><div class="vk">Рекомендация</div><div class="vv">${esc(s.recommendation)}</div></div>`));
  }

  // Секция: Личные годы
  box.appendChild(el('div', 'section-sub', 'ЛИЧНЫЕ ГОДЫ'));
  for (let n = 1; n <= 9; n++) {
    const y = DICT.personalYears[n];
    box.appendChild(refItem(`Год ${n}: ${esc(y.title)}`, esc(y.plus), `
      <div class="value-row"><div class="vk">В минусе</div><div class="vv">${esc(y.minus)}</div></div>
      <div class="value-row"><div class="vk">Что делать</div><div class="vv">${esc(y.recommendation)}</div></div>
      <div class="value-row"><div class="vk">Избегать</div><div class="vv">${esc(y.avoid)}</div></div>`));
  }
}

function refItem(title, subtitle, bodyHtml) {
  const item = el('div', 'ref-item');
  item.innerHTML = `
    <div class="ref-head">
      <div class="r-title"><div class="rt">${title}</div><div class="rs">${subtitle}</div></div>
      <div class="chev">▾</div>
    </div>
    <div class="ref-body">${bodyHtml}</div>`;
  item.querySelector('.ref-head').addEventListener('click', () => {
    tg.haptic('light');
    item.classList.toggle('open');
  });
  return item;
}

// ================= Вкладка ПРОФИЛИ =================
function renderProfiles() {
  const list = $('#prof-list');
  const profiles = store.loadProfiles();
  list.innerHTML = '';
  if (!profiles.length) {
    list.innerHTML = `<p class="hint">Пока нет профилей. Добавьте первый: себя, партнёра, друга или клиента.</p>`;
    return;
  }
  profiles.slice().reverse().forEach(p => {
    const map = calculateMap(p.birthDate);
    const item = el('div', 'profile-item');
    item.innerHTML = `
      <div class="p-badge">${map.consciousness}</div>
      <div class="p-main">
        <div class="p-name">${esc(p.name)}</div>
        <div class="p-date">${esc(store.birthDateLabel(p.birthDate))} · ЧС ${map.consciousness} · Миссия ${map.mission}</div>
      </div>
      <div class="p-actions">
        <button class="icon-btn" data-act="open" title="Открыть">▸</button>
        <button class="icon-btn danger" data-act="del" title="Удалить">✕</button>
      </div>`;
    item.querySelector('[data-act="open"]').addEventListener('click', () => openProfile(p));
    item.querySelector('[data-act="del"]').addEventListener('click', async () => {
      const ok = await tg.showConfirm(`Удалить профиль «${p.name}»?`);
      if (ok) { store.removeProfile(p.id); tg.haptic('warning'); renderProfiles(); }
    });
    list.appendChild(item);
  });
}

function openProfile(p) {
  state.currentBirth = p.birthDate;
  state.currentName = p.name;
  const medium = composeMediumReport(p.birthDate, p.name);
  state.currentReport = medium;
  renderReport($('#map-results'), medium, { actions: personalActions(p.birthDate, p.name) });
  $('#birth-input').value = store.birthDateLabel(p.birthDate);
  $('#map-save').style.display = 'none';
  goto('map');
}

$('#prof-add').addEventListener('click', () => {
  const err = $('#prof-error');
  const parsed = parseBirthDate($('#prof-date').value);
  if (!parsed.ok) { err.textContent = parsed.error; tg.haptic('error'); return; }
  err.textContent = '';
  const name = $('#prof-name').value.trim();
  try {
    store.addProfile(name || 'Без имени', parsed.value);
    $('#prof-name').value = '';
    $('#prof-date').value = '';
    tg.haptic('success');
    toast('Профиль добавлен');
    renderProfiles();
  } catch (e) { err.textContent = e.message; }
});

// ================= Вкладка ЭКСТРА =================
let extraApi = null;
function renderExtra() {
  if (!extraApi) {
    extraApi = initExtra({
      container: $('#extra-content'),
      badge: $('#extra-badge'),
      state, store, tg, DICT,
    });
  }
  extraApi.render();
}

// стартовый экран
goto('map');
