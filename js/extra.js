/*
 * Вкладка «Экстра»: премиум-инструменты.
 * Гейтинг повторяет оригинал (демо-доступ), в проде разблокировка — Telegram Stars.
 */
import {
  parseBirthDate, parseFutureDate, formatDateInput, dateHelperText, calculateMap,
  calculateNameCode, calculateObjectCode, calculateEventDate, calculateDeepCompatibility,
} from './numerology.js';
import { composePairReport, composeFamilyReport, composeMarriageReport } from './extra-text.js';
import { renderReport, sectionCard, scoreCard, el, esc, chipsHtml, toast } from './render.js';
import { exportReportPdf } from './pdf.js';

// Витрина премиума (переписанные оригинальные тексты)
const SHOWCASE = [
  { ic: '⚭', t: 'Совместимость пары', d: 'Резонанс, код пары, глубокий разбор и сценарии отношений.' },
  { ic: '❤', t: 'Дата свадьбы', d: 'Проверка резонанса выбранной даты с картой пары.' },
  { ic: '☖', t: 'Карта семьи', d: 'Общий код семьи, роли участников, ресурсы и зоны настройки.' },
  { ic: '⚙', t: 'Прикладные расчёты', d: 'Код имени, проекта, номера, адреса и энергия даты события.' },
  { ic: '⤓', t: 'PDF-отчёты', d: 'Красивый отчёт для сохранения или отправки.' },
];

const STARS_PRICE = 149; // Telegram Stars за пакет «Экстра» (пример)

export function initExtra({ container, badge, state, store, tg, DICT }) {
  let mode = 'compat'; // compat | family | applied
  let appliedMode = 'name';

  function isUnlocked() { return store.isPremiumUnlocked(); }

  function render() {
    if (badge) {
      badge.innerHTML = isUnlocked()
        ? `<span class="premium-badge">♕ Активна</span>` : '';
    }
    container.innerHTML = '';
    if (!isUnlocked()) { renderPaywall(); return; }
    renderTools();
  }

  // ---------- Витрина ----------
  function renderPaywall() {
    const wrap = el('div', 'paywall');
    wrap.innerHTML = `
      <div class="lock">♕</div>
      <h3>Пакет «Экстра»</h3>
      <p>Откройте расширенные инструменты: совместимость пары, глубокий разбор, дату свадьбы, карту семьи, прикладные коды и PDF-отчёты.</p>
      <div class="showcase-list">
        ${SHOWCASE.map(s => `
          <div class="showcase-item">
            <span class="si-ic">${s.ic}</span>
            <div><div class="si-t">${esc(s.t)}</div><div class="si-d">${esc(s.d)}</div></div>
          </div>`).join('')}
      </div>
      <div class="btn-row" style="margin-top:8px">
        <button class="btn btn-primary" id="buy-stars">Открыть за ${STARS_PRICE} ★</button>
      </div>
      <button class="btn btn-ghost btn-sm" id="demo-unlock" style="margin-top:10px">Тестовый доступ (демо)</button>
      <p style="font-size:11px;margin-top:12px">Оплата через Telegram Stars. В демо-режиме доступ открывается кнопкой выше.</p>`;
    container.appendChild(wrap);

    wrap.querySelector('#buy-stars').addEventListener('click', async () => {
      tg.haptic('light');
      // В проде: бот выдаёт invoice-ссылку (createInvoiceLink, currency XTR).
      const status = await tg.openStarsInvoice(window.__NOMEROLOG_INVOICE_URL__ || '');
      if (status === 'paid') {
        store.setPremiumUnlocked(true);
        tg.haptic('success');
        toast('Оплата прошла — доступ открыт');
        render();
      } else if (status === 'unsupported') {
        await tg.showAlert('Оплата Stars доступна только внутри Telegram и требует настройки бота (createInvoiceLink). Для проверки используйте тестовый доступ.');
      } else if (status === 'cancelled') {
        toast('Оплата отменена');
      } else if (status === 'failed') {
        toast('Не удалось открыть оплату');
      }
    });

    wrap.querySelector('#demo-unlock').addEventListener('click', () => {
      store.setPremiumUnlocked(true);
      tg.haptic('success');
      toast('Тестовый доступ открыт');
      render();
    });
  }

  // ---------- Инструменты ----------
  function renderTools() {
    container.innerHTML = `
      <div class="seg" id="ex-seg">
        <button class="seg-btn ${mode==='compat'?'is-active':''}" data-mode="compat">Пара</button>
        <button class="seg-btn ${mode==='family'?'is-active':''}" data-mode="family">Семья</button>
        <button class="seg-btn ${mode==='applied'?'is-active':''}" data-mode="applied">Прикладное</button>
      </div>
      <div id="ex-body"></div>`;
    container.querySelector('#ex-seg').addEventListener('click', e => {
      const b = e.target.closest('.seg-btn'); if (!b) return;
      tg.haptic('light'); mode = b.dataset.mode; renderTools();
    });
    const body = container.querySelector('#ex-body');
    if (mode === 'compat') renderCompat(body);
    else if (mode === 'family') renderFamily(body);
    else renderApplied(body);

    // Тумблер демо-доступа (двусторонний, как в оригинале)
    const foot = el('div');
    foot.style.marginTop = '18px';
    const off = el('button', 'btn btn-ghost btn-sm', 'Отключить демо-доступ');
    off.style.opacity = '.7';
    off.addEventListener('click', () => {
      store.setPremiumUnlocked(false);
      tg.haptic('warning');
      toast('Демо-доступ отключён');
      render();
    });
    foot.appendChild(off);
    container.appendChild(foot);
  }

  function profileOptions() {
    return store.loadProfiles().map(p =>
      `<option value="${p.id}">${esc(p.name)} · ${esc(store.birthDateLabel(p.birthDate))}</option>`).join('');
  }
  function resolveProfile(selectVal, name, dateStr) {
    if (selectVal) {
      const p = store.getProfile(selectVal);
      if (p) return { name: p.name, birthDate: p.birthDate };
    }
    const parsed = parseBirthDate(dateStr);
    if (!parsed.ok) return { error: parsed.error };
    return { name: (name || '').trim() || 'Профиль', birthDate: parsed.value };
  }

  // ---------- Пара ----------
  function renderCompat(body) {
    const opts = profileOptions();
    const hasProfiles = store.loadProfiles().length > 0;
    body.innerHTML = `
      ${partnerBlock('a', 'Первый', opts, hasProfiles)}
      ${partnerBlock('b', 'Второй', opts, hasProfiles)}
      <div class="field">
        <label class="field-label" for="cx-marriage">Дата свадьбы (необязательно)</label>
        <input class="field-input" id="cx-marriage" inputmode="numeric" placeholder="ДД.ММ.ГГГГ" maxlength="10" autocomplete="off" />
      </div>
      <p class="field-error" id="cx-error"></p>
      <button class="btn btn-primary" id="cx-calc">Проверить совместимость</button>
      <div class="results" id="cx-results"></div>`;
    wireDateInputs(body);
    body.querySelector('#cx-calc').addEventListener('click', () => {
      const err = body.querySelector('#cx-error'); err.textContent = '';
      const A = resolveProfile(val(body,'#cx-a-sel'), val(body,'#cx-a-name'), val(body,'#cx-a-date'));
      const B = resolveProfile(val(body,'#cx-b-sel'), val(body,'#cx-b-name'), val(body,'#cx-b-date'));
      if (A.error) { err.textContent = 'Первый: ' + A.error; tg.haptic('error'); return; }
      if (B.error) { err.textContent = 'Второй: ' + B.error; tg.haptic('error'); return; }
      const report = composePairReport(A, B);
      if (!report || report.error) { err.textContent = 'Не удалось собрать отчёт'; return; }
      tg.haptic('success');
      const out = body.querySelector('#cx-results');
      const deep = calculateDeepCompatibility(calculateMap(A.birthDate), calculateMap(B.birthDate));
      renderReport(out, report, {
        score: { value: deep.score, verdict: deep.verdict, lo: 20, hi: 98 },
        actions: pdfButton(report),
      });
      // Дата свадьбы
      const md = val(body, '#cx-marriage').trim();
      if (md) {
        const mreport = composeMarriageReport(md, A, B);
        if (mreport && !mreport.error) {
          const mBox = el('div'); renderReport(mBox, mreport, { actions: pdfButton(mreport) });
          out.appendChild(mBox);
        } else if (mreport && mreport.error) {
          out.appendChild(el('p', 'field-error', 'Дата свадьбы: ' + esc(mreport.error)));
        }
      }
      out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  function partnerBlock(key, label, opts, hasProfiles) {
    return `
      <div class="field">
        <label class="field-label">${label}</label>
        ${hasProfiles ? `<select class="field-input" id="cx-${key}-sel" style="margin-bottom:8px">
          <option value="">— ввести вручную —</option>${opts}</select>` : ''}
        <input class="field-input" id="cx-${key}-name" placeholder="Имя (необязательно)" autocomplete="off" style="margin-bottom:8px" />
        <input class="field-input" id="cx-${key}-date" inputmode="numeric" placeholder="ДД.ММ.ГГГГ" maxlength="10" autocomplete="off" />
      </div>`;
  }

  // ---------- Семья ----------
  function renderFamily(body) {
    const profiles = store.loadProfiles();
    if (profiles.length < 2) {
      body.innerHTML = `<p class="hint">Для карты семьи нужно минимум два сохранённых профиля. Добавьте их во вкладке «Проф.».</p>`;
      return;
    }
    body.innerHTML = `
      <p class="screen-intro">Выберите участников семьи (минимум два).</p>
      <div class="select-grid" id="fam-grid">
        ${profiles.map(p => {
          const m = calculateMap(p.birthDate);
          return `<div class="select-chip" data-id="${p.id}">
            <div class="sc-badge">${m.consciousness}</div>
            <div><div class="sc-name">${esc(p.name)}</div>
            <div class="sc-date">${esc(store.birthDateLabel(p.birthDate))}</div></div></div>`;
        }).join('')}
      </div>
      <p class="field-error" id="fam-error"></p>
      <button class="btn btn-primary" id="fam-calc">Собрать карту семьи</button>
      <div class="results" id="fam-results"></div>`;
    const selected = new Set();
    body.querySelectorAll('.select-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const id = chip.dataset.id;
        if (selected.has(id)) { selected.delete(id); chip.classList.remove('is-selected'); }
        else { selected.add(id); chip.classList.add('is-selected'); }
        tg.haptic('light');
      });
    });
    body.querySelector('#fam-calc').addEventListener('click', () => {
      const err = body.querySelector('#fam-error'); err.textContent = '';
      if (selected.size < 2) { err.textContent = 'Выберите минимум два профиля'; tg.haptic('error'); return; }
      const members = [...selected].map(id => store.getProfile(id)).filter(Boolean)
        .map(p => ({ name: p.name, birthDate: p.birthDate, id: p.id }));
      const report = composeFamilyReport(members);
      if (!report || report.error) { err.textContent = report?.error || 'Не удалось собрать карту'; return; }
      tg.haptic('success');
      const out = body.querySelector('#fam-results');
      renderReport(out, report, { actions: pdfButton(report) });
      out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  // ---------- Прикладное ----------
  function renderApplied(body) {
    const cfg = {
      name: { label: 'Имя, псевдоним или название', ph: 'Например: Мария', btn: 'Рассчитать код имени' },
      object: { label: 'Номер, адрес или короткий код', ph: 'Например: А123ВС', btn: 'Рассчитать код объекта' },
      event: { label: 'Дата события', ph: 'ДД.ММ.ГГГГ', btn: 'Рассчитать энергию даты' },
    }[appliedMode];
    body.innerHTML = `
      <div class="seg" id="ap-seg">
        <button class="seg-btn ${appliedMode==='name'?'is-active':''}" data-m="name">Имя</button>
        <button class="seg-btn ${appliedMode==='object'?'is-active':''}" data-m="object">Номер</button>
        <button class="seg-btn ${appliedMode==='event'?'is-active':''}" data-m="event">Дата</button>
      </div>
      <div class="field">
        <label class="field-label">${cfg.label}</label>
        <input class="field-input" id="ap-input" ${appliedMode==='event'?'inputmode="numeric" maxlength="10"':''} placeholder="${cfg.ph}" autocomplete="off" />
        <p class="field-error" id="ap-error"></p>
      </div>
      <button class="btn btn-primary" id="ap-calc">${cfg.btn}</button>
      <div class="results" id="ap-results"></div>`;
    body.querySelector('#ap-seg').addEventListener('click', e => {
      const b = e.target.closest('.seg-btn'); if (!b) return;
      tg.haptic('light'); appliedMode = b.dataset.m; renderApplied(body);
    });
    if (appliedMode === 'event') {
      const inp = body.querySelector('#ap-input');
      inp.addEventListener('input', () => { inp.value = formatDateInput(inp.value); });
    }
    body.querySelector('#ap-calc').addEventListener('click', () => {
      const err = body.querySelector('#ap-error'); err.textContent = '';
      const out = body.querySelector('#ap-results'); out.innerHTML = '';
      const v = body.querySelector('#ap-input').value;
      if (appliedMode === 'event') {
        const parsed = parseFutureDate(v, 'Введите дату события');
        if (!parsed.ok) { err.textContent = parsed.error; tg.haptic('error'); return; }
        const { number } = calculateEventDate(parsed.value);
        const ev = DICT.eventDates[number];
        tg.haptic('success');
        out.appendChild(sectionCard({
          title: `Энергия даты · ${ev.title}`, subtitle: '',
          values: [{ label: 'Обзор', value: ev.overview }, { label: 'Рекомендация', value: ev.recommendation }],
          bulletGroups: [{ title: 'Хорошо для', bullets: ev.bestFor }, { title: 'Осторожно с', bullets: ev.beCarefulWith }],
        }, number));
        return;
      }
      const res = appliedMode === 'name' ? calculateNameCode(v) : calculateObjectCode(v);
      if (!res.ok) { err.textContent = res.error; tg.haptic('error'); return; }
      const num = DICT.numbers[res.number];
      tg.haptic('success');
      out.appendChild(sectionCard({
        title: `${appliedMode==='name'?'Код имени':'Код объекта'} ${res.number} · ${num.archetype}`,
        subtitle: `«${res.source}»`,
        values: [{ label: 'Суть', value: num.essence }, { label: 'Совет по миссии', value: num.missionAdvice }],
        bulletGroups: [{ title: 'Сильные стороны', bullets: num.strengths }],
      }, res.number));
    });
  }

  // ---------- PDF ----------
  function pdfButton(report) {
    const wrap = el('div');
    wrap.style.marginTop = '4px';
    const btn = el('button', 'btn btn-ghost', '⤓ Скачать PDF');
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = 'Готовим PDF…';
      try { await exportReportPdf(report); tg.haptic('success'); }
      catch (e) { toast('Не удалось создать PDF'); }
      finally { btn.disabled = false; btn.textContent = '⤓ Скачать PDF'; }
    });
    wrap.appendChild(btn);
    return wrap;
  }

  // helpers
  function val(root, sel) { const n = root.querySelector(sel); return n ? n.value : ''; }
  function wireDateInputs(body) {
    body.querySelectorAll('input[inputmode="numeric"]').forEach(inp => {
      inp.addEventListener('input', () => { inp.value = formatDateInput(inp.value); });
    });
  }

  return { render };
}

// экспорт PDF-кнопки для личной карты (используется в app.js при желании)
export { exportReportPdf };
