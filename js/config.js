/*
 * Конфигурация приложения.
 * Впиши адрес Cloudflare Worker с ИИ-нумерологом (без завершающего слэша) в CONFIG.backendUrl
 * после деплоя, например:
 *   backendUrl: 'https://nomerolog-ai.<твой-субдомен>.workers.dev'
 * Либо задай глобально: window.__NOMEROLOG_BACKEND__ = '...'
 */
export const CONFIG = {
  backendUrl: 'https://nomerolog-ai.aispedsve.workers.dev',
};

/** Актуальный адрес бэкенда (CONFIG или глобальный override). */
export function backendUrl() {
  return (CONFIG.backendUrl || (typeof window !== 'undefined' && window.__NOMEROLOG_BACKEND__) || '').replace(/\/$/, '');
}

export const aiEnabled = () => !!backendUrl();
