/*
 * Экспорт StructuredReport в PDF.
 * Полностью офлайн, без внешних библиотек: рендерим страницы на <canvas>
 * по геометрии оригинального PdfWriter (A4 595×842pt, тёмный фон, золото),
 * затем упаковываем JPEG-страницы в минимальный PDF вручную.
 */

// --- Геометрия (pt из оригинала) ---
const PT = { W: 595, H: 842, margin: 42, contentW: 511, bottomLimit: 786, startY: 82 };
const SCALE = 2.4; // растеризация для чёткости
const S = v => v * SCALE;

const COLORS = {
  bg: '#070711', card: '#121222', cardStroke: '#8A7038', gold: '#E0BC63',
  title: '#F6DC97', body: '#EEEBDF', muted: '#B8B19A', footer: '#918977',
};
const FONTS = {
  title: { size: 28, weight: 'bold', color: COLORS.title },
  h1:    { size: 20, weight: 'bold', color: COLORS.title },
  h2:    { size: 15, weight: 'bold', color: COLORS.gold },
  body:  { size: 11.8, weight: 'normal', color: COLORS.body },
  muted: { size: 10.5, weight: 'normal', color: COLORS.muted },
  label: { size: 11.2, weight: 'bold', color: COLORS.gold },
  footer:{ size: 8.5, weight: 'normal', color: COLORS.footer },
};
const LH = 1.12;
const FAMILY = 'Georgia, "Times New Roman", serif';
const SANS = '-apple-system, "Segoe UI", Roboto, Arial, sans-serif';

function fontStr(f) { return `${f.weight === 'bold' ? '700' : '400'} ${S(f.size)}px ${SANS}`; }

class Pager {
  constructor(reportKind) {
    this.kind = reportKind;
    this.pages = [];
    this.ctx = null;
    this.y = 0;
    this.pageNo = 0;
    this.newPage();
  }
  newPage() {
    if (this.ctx) this.drawFooter();
    this.pageNo++;
    const cv = document.createElement('canvas');
    cv.width = Math.round(S(PT.W));
    cv.height = Math.round(S(PT.H));
    const ctx = cv.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, cv.width, cv.height);
    this.pages.push(cv);
    this.ctx = ctx;
    this.drawHeader();
    this.y = PT.startY;
  }
  ensure(est) { if (this.y + est > PT.bottomLimit) this.newPage(); }

  // text with wrapping; returns block height in pt
  measure(text, f, width) {
    const ctx = this.ctx;
    ctx.font = fontStr(f);
    const lines = wrap(ctx, String(text ?? ''), S(width));
    return { lines, heightPt: (lines.length * f.size * LH) };
  }
  draw(text, f, xPt, yPt, widthPt, align = 'left') {
    const ctx = this.ctx;
    ctx.font = fontStr(f);
    ctx.fillStyle = f.color;
    const lines = wrap(ctx, String(text ?? ''), S(widthPt));
    const lineH = S(f.size * LH);
    ctx.textAlign = align === 'right' ? 'right' : 'left';
    const xBase = align === 'right' ? S(xPt) + S(widthPt) : S(xPt);
    lines.forEach((ln, i) => ctx.fillText(ln, xBase, S(yPt) + i * lineH));
    ctx.textAlign = 'left';
    return lines.length * f.size * LH;
  }
  line(x1, y1, x2, y2, color = COLORS.gold, w = 1.3) {
    const ctx = this.ctx;
    ctx.strokeStyle = color; ctx.lineWidth = S(w);
    ctx.beginPath(); ctx.moveTo(S(x1), S(y1)); ctx.lineTo(S(x2), S(y2)); ctx.stroke();
  }
  roundRect(x, y, w, h, r, fill, stroke, strokeW = 1.1) {
    const ctx = this.ctx;
    const rr = S(r);
    ctx.beginPath();
    ctx.moveTo(S(x) + rr, S(y));
    ctx.arcTo(S(x) + S(w), S(y), S(x) + S(w), S(y) + S(h), rr);
    ctx.arcTo(S(x) + S(w), S(y) + S(h), S(x), S(y) + S(h), rr);
    ctx.arcTo(S(x), S(y) + S(h), S(x), S(y), rr);
    ctx.arcTo(S(x), S(y), S(x) + S(w), S(y), rr);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = S(strokeW); ctx.stroke(); }
  }
  drawHeader() {
    const ctx = this.ctx;
    // gold ring
    ctx.strokeStyle = COLORS.gold; ctx.lineWidth = S(1.3);
    ctx.beginPath(); ctx.arc(S(50), S(34), S(7), 0, Math.PI * 2); ctx.stroke();
    this.draw('Nomerolog', FONTS.label, 66, 24, 180, 'left');
    this.draw(this.kind, FONTS.muted, PT.W - PT.margin - 180, 24, 180, 'right');
    this.line(PT.margin, 60, PT.W - PT.margin, 60);
  }
  drawFooter() {
    this.line(PT.margin, PT.H - 38, PT.W - PT.margin, PT.H - 38);
    this.draw('Страница ' + this.pageNo, FONTS.footer, PT.margin, PT.H - 28, PT.contentW, 'left');
    this.draw('Создано в Nomerolog', FONTS.footer, PT.margin, PT.H - 28, PT.contentW, 'right');
  }

  reportTitle(title, subtitle, caption) {
    this.ensure(132);
    this.draw(title, FONTS.title, PT.margin, this.y, PT.contentW); this.y += 38;
    this.draw(subtitle, FONTS.h1, PT.margin, this.y, PT.contentW); this.y += 28;
    if (caption) { this.draw(caption, FONTS.body, PT.margin, this.y, PT.contentW); this.y += 30; }
    this.line(PT.margin, this.y, PT.W - PT.margin, this.y); this.y += 24;
  }
  numberStrip(items) {
    if (!items || !items.length) return;
    const n = items.length;
    const cellW = (PT.contentW - (n - 1) * 8) / n;
    this.ensure(74);
    const topY = this.y;
    items.forEach((it, i) => {
      const x = PT.margin + i * (cellW + 8);
      this.roundRect(x, topY, cellW, 64, 15, COLORS.card, COLORS.cardStroke);
      this.draw(String(it.v), FONTS.h1, x + 10, topY + 11, cellW - 20);
      this.draw(String(it.k), FONTS.muted, x + 10, topY + 40, cellW - 20);
    });
    this.y += 82;
  }
  section(title, subtitle) {
    this.ensure(86);
    const topY = this.y;
    this.roundRect(PT.margin, topY, PT.contentW, 54, 18, COLORS.card, COLORS.cardStroke);
    this.draw(title, FONTS.h1, PT.margin + 16, topY + 12, PT.contentW - 32);
    if (subtitle && subtitle.trim()) {
      const m = this.measure(subtitle, FONTS.muted, PT.contentW - 32);
      if (m.heightPt <= 18) {
        this.draw(subtitle, FONTS.muted, PT.margin + 16, topY + 36, PT.contentW - 32);
        this.y = topY + 72;
      } else {
        this.y = topY + 54;
        this.keyValue('Суть раздела', subtitle);
      }
    } else {
      this.y = topY + 72;
    }
  }
  keyValue(label, value) {
    const m = this.measure(value, FONTS.body, PT.contentW);
    this.ensure(m.heightPt + 30);
    this.draw(label, FONTS.label, PT.margin, this.y, PT.contentW); this.y += 17;
    this.y += this.draw(value, FONTS.body, PT.margin, this.y, PT.contentW) + 11;
  }
  bullets(title, items) {
    if (!items || !items.length) return;
    const text = items.map(i => '• ' + i).join('\n');
    const m = this.measure(text, FONTS.body, PT.contentW);
    this.ensure(m.heightPt + 34);
    this.draw(title, FONTS.h2, PT.margin, this.y, PT.contentW); this.y += 22;
    this.y += this.draw(text, FONTS.body, PT.margin, this.y, PT.contentW) + 12;
  }
  finish() { if (this.ctx) this.drawFooter(); return this.pages; }
}

// word-wrap respecting \n
function wrap(ctx, text, widthPx) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); continue; }
    let cur = words[0];
    for (let i = 1; i < words.length; i++) {
      const test = cur + ' ' + words[i];
      if (ctx.measureText(test).width > widthPx) { out.push(cur); cur = words[i]; }
      else cur = test;
    }
    out.push(cur);
  }
  return out;
}

const KIND = {
  'Персональная карта': 'Персональная карта',
  'Отчёт совместимости': 'Совместимость',
  'Расширенная карта семьи': 'Карта семьи',
  'Дата свадьбы': 'Дата свадьбы',
};

/** Отрисовать StructuredReport в массив canvas-страниц. */
function renderReportPages(report) {
  const kind = KIND[report.subtitle] || 'Отчёт';
  const p = new Pager(kind);
  p.reportTitle(report.title, report.subtitle, report.meta);
  p.numberStrip(report.chips);
  report.sections.forEach(sec => {
    p.section(sec.title, sec.subtitle);
    (sec.values || []).forEach(v => p.keyValue(v.label, v.value));
    (sec.bulletGroups || []).forEach(g => p.bullets(g.title, g.bullets));
  });
  // дисклеймер
  p.section('Дисклеймер', null);
  p.keyValue('Важно', 'Отчёт является эзотерическим и информационно-развлекательным инструментом для самонаблюдения. Он не является медицинской, психологической, финансовой или юридической консультацией и не заменяет обращение к специалистам.');
  return p.finish();
}

// --- Минимальный PDF-упаковщик (JPEG-страницы) ---
function pagesToPdfBlob(pages) {
  const enc = new TextEncoder();
  const chunks = [];
  let offset = 0;
  const offsets = [];
  const push = data => {
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    chunks.push(bytes); offset += bytes.length;
  };
  push('%PDF-1.4\n%\xff\xff\xff\xff\n');

  const imgBytes = pages.map(cv => dataURLtoBytes(cv.toDataURL('image/jpeg', 0.86)));
  const nPages = pages.length;
  // object ids: 1 catalog, 2 pages, then per page: pageObj, contentObj, imageObj
  const pageObjIds = [];
  let nextId = 3;
  const perPage = pages.map((cv, i) => {
    const pageId = nextId++, contentId = nextId++, imgId = nextId++;
    pageObjIds.push(pageId);
    return { pageId, contentId, imgId, cv, img: imgBytes[i] };
  });

  const record = id => { offsets[id] = offset; };

  // 1 catalog
  record(1); push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  // 2 pages
  record(2);
  push(`2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map(id => id + ' 0 R').join(' ')}] /Count ${nPages} >>\nendobj\n`);

  perPage.forEach(pp => {
    const w = PT.W, h = PT.H;
    record(pp.pageId);
    push(`${pp.pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Im0 ${pp.imgId} 0 R >> >> /Contents ${pp.contentId} 0 R >>\nendobj\n`);
    const content = `q\n${w} 0 0 ${h} 0 0 cm\n/Im0 Do\nQ\n`;
    record(pp.contentId);
    push(`${pp.contentId} 0 obj\n<< /Length ${enc.encode(content).length} >>\nstream\n${content}endstream\nendobj\n`);
    record(pp.imgId);
    push(`${pp.imgId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pp.cv.width} /Height ${pp.cv.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pp.img.length} >>\nstream\n`);
    push(pp.img);
    push('\nendstream\nendobj\n');
  });

  const xrefStart = offset;
  const total = nextId; // objects 0..nextId-1
  let xref = `xref\n0 ${total}\n0000000000 65535 f \n`;
  for (let id = 1; id < total; id++) {
    const off = offsets[id] || 0;
    xref += String(off).padStart(10, '0') + ' 00000 n \n';
  }
  push(xref);
  push(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

  return new Blob(chunks, { type: 'application/pdf' });
}

function dataURLtoBytes(dataUrl) {
  const b64 = dataUrl.split(',')[1];
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function fileName(report) {
  const kind = KIND[report.subtitle] || 'report';
  const map = { 'Персональная карта': 'personal', 'Совместимость': 'pair', 'Карта семьи': 'family', 'Дата свадьбы': 'marriage' };
  const d = new Date();
  const p2 = n => String(n).padStart(2, '0');
  const ts = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
  return `nomerolog_${map[kind] || 'report'}_${ts}.pdf`;
}

/**
 * Собрать PDF и отдать пользователю.
 * В Telegram/iOS WebView обычная ссылка-скачивание часто не срабатывает, поэтому
 * сначала пробуем нативный шэринг файла (navigator.share), затем — открытие во
 * вкладке, и лишь потом классическое скачивание.
 * @returns {Promise<'shared'|'opened'|'downloaded'>}
 */
export async function exportReportPdf(report) {
  const pages = renderReportPages(report);
  const blob = pagesToPdfBlob(pages);
  const name = fileName(report);

  // 1) Нативный шэринг файла (лучший путь в Telegram/iOS, повторяет share-sheet оригинала)
  try {
    if (navigator.canShare && typeof File !== 'undefined') {
      const file = new File([blob], name, { type: 'application/pdf' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Отчёт Nomerolog' });
        return 'shared';
      }
    }
  } catch (_) { /* пользователь отменил или не поддерживается — идём дальше */ }

  const url = URL.createObjectURL(blob);
  const cleanup = () => setTimeout(() => URL.revokeObjectURL(url), 8000);

  // 2) Классическое скачивание через <a download>
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    cleanup();
    return 'downloaded';
  } catch (_) {
    // 3) Последний фолбэк — открыть во вкладке (пользователь сохранит вручную)
    window.open(url, '_blank');
    cleanup();
    return 'opened';
  }
}
