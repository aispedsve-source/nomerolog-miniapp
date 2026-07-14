/*
 * Рендеринг StructuredReport → DOM. Чистые функции представления.
 */

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
}

export function chipsHtml(arr, cls = 'chip') {
  if (!arr || !arr.length) return '';
  return `<div class="chips">${arr.map(x => `<span class="${cls}">${esc(x)}</span>`).join('')}</div>`;
}

function valuesHtml(values) {
  if (!values || !values.length) return '';
  return values.map(v =>
    `<div class="value-row"><div class="vk">${esc(v.label)}</div><div class="vv">${esc(v.value)}</div></div>`
  ).join('');
}

function bulletGroupsHtml(groups) {
  if (!groups || !groups.length) return '';
  return groups.map(g => {
    const head = g.title ? `<div class="bg-title">${esc(g.title)}</div>` : '';
    if (g.chips) {
      const cls = g.chips === 'shadow' ? 'chip shadow' : g.chips === 'gold' ? 'chip gold' : 'chip';
      return `<div class="bullet-group">${head}${chipsHtml(g.bullets, cls)}</div>`;
    }
    return `<div class="bullet-group">${head}<ul>${(g.bullets || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul></div>`;
  }).join('');
}

function matrixHtml(matrix) {
  let cells = '';
  for (let d = 1; d <= 9; d++) {
    const count = matrix[d];
    const filled = count > 0;
    const digits = filled ? String(d).repeat(count) : '—';
    cells += `<div class="matrix-cell ${filled ? 'filled' : 'empty'}">
      <span class="n-label">${d}</span><span class="digits">${digits}</span></div>`;
  }
  return `<div class="matrix">${cells}</div>`;
}

/** Одна секция отчёта. */
export function sectionCard(section, badge) {
  const card = el('div', 'card');
  const badgeHtml = badge != null
    ? `<div class="badge ${typeof badge === 'string' && badge.length > 2 ? 'sym' : ''}">${esc(badge)}</div>`
    : '';
  card.innerHTML = `
    <div class="card-head">
      ${badgeHtml}
      <div class="card-head-txt">
        <h3>${esc(section.title)}</h3>
      </div>
    </div>
    ${section.subtitle ? `<div class="section-sub">${esc(section.subtitle)}</div>` : ''}
    ${section.matrix ? matrixHtml(section.matrix) : ''}
    ${valuesHtml(section.values)}
    ${bulletGroupsHtml(section.bulletGroups)}`;
  return card;
}

/** Заголовок отчёта: название, подзаголовок, мета, чипы. */
export function reportHead(report) {
  const head = el('div', 'report-head');
  head.innerHTML = `
    <h2>${esc(report.title)}</h2>
    <div class="sub">${esc(report.subtitle)}</div>
    ${report.meta ? `<div class="meta">${esc(report.meta)}</div>` : ''}
    ${report.chips && report.chips.length ? `<div class="report-chips">${report.chips.map(c =>
      `<div class="report-chip"><span class="k">${esc(c.k)}</span><span class="v">${esc(c.v)}</span></div>`).join('')}</div>` : ''}`;
  return head;
}

/** Полный отчёт в контейнер. */
export function renderReport(container, report, opts = {}) {
  container.innerHTML = '';
  container.appendChild(reportHead(report));

  if (opts.score != null) {
    container.appendChild(scoreCard(opts.score.value, opts.score.verdict, opts.score.lo, opts.score.hi));
  }

  // Сводка (если есть) — отдельной карточкой
  if (report.summary && report.summary.length) {
    container.appendChild(sectionCard({ title: 'Сводка', values: report.summary, bulletGroups: [] }, '✦'));
  }

  report.sections.forEach((s, i) => {
    container.appendChild(sectionCard(s, s.badge != null ? s.badge : String(i + 1)));
  });

  if (opts.actions) container.appendChild(opts.actions);
}

export function scoreCard(score, verdict, lo = 0, hi = 100) {
  const pct = Math.max(0, Math.min(100, Math.round(((score - lo) / (hi - lo)) * 100)));
  const card = el('div', 'card');
  card.innerHTML = `
    <div class="score-wrap">
      <div class="score-top">
        <span class="score-val">${score}%</span>
        <span class="score-verdict">${esc(verdict)}</span>
      </div>
      <div class="score-bar"><div class="score-fill" style="width:0%"></div></div>
    </div>`;
  requestAnimationFrame(() => { const f = card.querySelector('.score-fill'); if (f) f.style.width = pct + '%'; });
  return card;
}

let toastTimer = null;
export function toast(message) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}
