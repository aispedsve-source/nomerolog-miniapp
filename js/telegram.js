/*
 * Обёртка над Telegram WebApp SDK.
 * Мягко деградирует в обычном браузере (всё опционально).
 */

const tg = window.Telegram?.WebApp;

export const isTelegram = !!tg;

export function initTelegram() {
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.('#070711');
    tg.setBackgroundColor?.('#070711');
    applyTheme();
    tg.onEvent?.('themeChanged', applyTheme);
    // Отключаем вертикальный свайп-закрытие, чтобы скролл контента не закрывал приложение
    tg.disableVerticalSwipes?.();
  } catch (_) {}
}

function applyTheme() {
  const light = tg?.colorScheme === 'light';
  document.body.classList.toggle('tg-light', !!light);
}

export function haptic(kind = 'light') {
  try {
    if (kind === 'success' || kind === 'error' || kind === 'warning') {
      tg?.HapticFeedback?.notificationOccurred(kind);
    } else {
      tg?.HapticFeedback?.impactOccurred(kind);
    }
  } catch (_) {}
}

// --- BackButton ---
let backHandler = null;
export function showBackButton(handler) {
  if (!tg?.BackButton) return;
  backHandler = handler;
  try {
    tg.BackButton.show();
    tg.BackButton.offClick?.();
    tg.BackButton.onClick(() => backHandler && backHandler());
  } catch (_) {}
}
export function hideBackButton() {
  try { tg?.BackButton?.hide(); } catch (_) {}
  backHandler = null;
}

// --- Share ---
export function shareText(text) {
  if (tg?.openTelegramLink) {
    const url = `https://t.me/share/url?url=${encodeURIComponent(' ')}&text=${encodeURIComponent(text)}`;
    tg.openTelegramLink(url);
    return true;
  }
  if (navigator.share) {
    navigator.share({ text }).catch(() => {});
    return true;
  }
  return false;
}

/**
 * Открыть счёт на оплату (Telegram Stars).
 * В проде ссылка на invoice выдаётся ботом (createInvoiceLink с валютой XTR).
 * Здесь — обёртка: если ссылка передана, открываем; иначе сообщаем, что нужен бот.
 * @param {string} invoiceUrl  ссылка на инвойс от бота (t.me/... или slug)
 * @returns {Promise<'paid'|'cancelled'|'failed'|'unsupported'>}
 */
export function openStarsInvoice(invoiceUrl) {
  return new Promise(resolve => {
    if (!tg?.openInvoice || !invoiceUrl) { resolve('unsupported'); return; }
    try {
      tg.openInvoice(invoiceUrl, status => resolve(status)); // 'paid'|'cancelled'|'failed'|'pending'
    } catch (_) {
      resolve('failed');
    }
  });
}

export function showConfirm(message) {
  return new Promise(resolve => {
    if (tg?.showConfirm) tg.showConfirm(message, ok => resolve(!!ok));
    else resolve(window.confirm(message));
  });
}

export function showAlert(message) {
  return new Promise(resolve => {
    if (tg?.showAlert) tg.showAlert(message, () => resolve());
    else { window.alert(message); resolve(); }
  });
}
