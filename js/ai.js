/*
 * ИИ-нумеролог: плавающая кнопка + чат-оверлей.
 * Общается с бэкендом (Cloudflare Worker), который проксирует Mistral и хранит память клиента.
 */
import { backendUrl, aiEnabled } from './config.js';

const CLIENT_ID_KEY = 'nomerolog_client_id';

function getClientId(tg) {
  const tgId = tg?.initDataUnsafe?.user?.id;
  if (tgId) return 'tg' + tgId;
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = 'web_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch (_) { return 'anon'; }
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// простое превращение переносов и ссылок в HTML
function fmt(text) {
  return esc(text)
    .replace(/\n/g, '<br>')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])@([a-zA-Z0-9_]{4,})/g, '$1<a href="https://t.me/$2" target="_blank" rel="noopener">@$2</a>');
}

/**
 * @param {object} opts
 * @param {object} opts.tg          обёртка Telegram (telegram.js)
 * @param {Function} opts.getContext () => числа карты | null
 */
export function initAi({ tg, getContext }) {
  const clientId = getClientId(tg?.raw || window.Telegram?.WebApp);
  let opened = false;
  let busy = false;
  let greeted = false;

  // Плавающая кнопка
  const fab = document.createElement('button');
  fab.className = 'ai-fab';
  fab.innerHTML = '<span class="ai-fab-ic">🔮</span>';
  fab.title = 'Спросить ИИ-нумеролога';
  document.body.appendChild(fab);

  // Оверлей
  const overlay = document.createElement('div');
  overlay.className = 'ai-overlay';
  overlay.innerHTML = `
    <div class="ai-panel">
      <div class="ai-head">
        <div class="ai-head-txt">
          <div class="ai-title">🔮 ИИ-нумеролог</div>
          <div class="ai-sub">Объясню простыми словами</div>
        </div>
        <button class="ai-close" aria-label="Закрыть">✕</button>
      </div>
      <div class="ai-messages" id="ai-messages"></div>
      <div class="ai-input-row">
        <textarea class="ai-input" id="ai-input" rows="1" placeholder="Спроси о своей карте…" maxlength="2000"></textarea>
        <button class="ai-send" id="ai-send" aria-label="Отправить">➤</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const messagesEl = overlay.querySelector('#ai-messages');
  const inputEl = overlay.querySelector('#ai-input');
  const sendBtn = overlay.querySelector('#ai-send');

  function bubble(role, html, cls = '') {
    const b = document.createElement('div');
    b.className = `ai-msg ai-${role} ${cls}`;
    b.innerHTML = html;
    messagesEl.appendChild(b);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return b;
  }

  function open(seed) {
    opened = true;
    overlay.classList.add('show');
    fab.classList.add('hidden');
    tg?.showBackButton?.(close);
    if (!greeted) {
      greeted = true;
      if (!aiEnabled()) {
        bubble('bot', '🔌 ИИ-нумеролог подключается после настройки бэкенда. ' +
          'Как только будет указан адрес сервера — я оживу и всё объясню.');
      } else {
        const ctx = getContext?.();
        const hi = ctx
          ? 'Привет! Я вижу твою карту чисел. Что хочешь понять — про себя, отношения, деньги или предназначение? Спрашивай простыми словами.'
          : 'Привет! Я — ИИ-нумеролог. Чтобы разобрать именно твою карту, сначала посчитай её на вкладке «Карта». А пока могу ответить на общие вопросы о числах.';
        bubble('bot', esc(hi));
      }
    }
    setTimeout(() => inputEl.focus(), 100);
    if (seed) { inputEl.value = seed; send(); }
  }

  function close() {
    opened = false;
    overlay.classList.remove('show');
    fab.classList.remove('hidden');
    tg?.hideBackButton?.();
  }

  async function send() {
    const text = inputEl.value.trim();
    if (!text || busy) return;
    inputEl.value = '';
    autoGrow();
    bubble('user', fmt(text));
    tg?.haptic?.('light');

    if (!aiEnabled()) {
      bubble('bot', 'Пока не подключён бэкенд — ответить не могу. Загляни позже 🙌');
      return;
    }

    busy = true;
    sendBtn.disabled = true;
    const typing = bubble('bot', '<span class="ai-typing"><i></i><i></i><i></i></span>', 'ai-typing-wrap');

    try {
      const res = await fetch(backendUrl() + '/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          clientId,
          context: getContext?.() || null,
          initData: (tg?.raw || window.Telegram?.WebApp)?.initData || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      typing.remove();
      if (res.ok && data.reply) {
        bubble('bot', fmt(data.reply));
        tg?.haptic?.('light');
      } else {
        bubble('bot', esc(data.error || 'Не получилось ответить. Попробуй ещё раз.'), 'ai-error');
      }
    } catch (e) {
      typing.remove();
      bubble('bot', 'Нет связи с сервером. Проверь интернет и попробуй снова.', 'ai-error');
    } finally {
      busy = false;
      sendBtn.disabled = false;
      inputEl.focus();
    }
  }

  function autoGrow() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  }

  // события
  fab.addEventListener('click', () => open());
  overlay.querySelector('.ai-close').addEventListener('click', close);
  sendBtn.addEventListener('click', send);
  inputEl.addEventListener('input', autoGrow);
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  return { open, close };
}
