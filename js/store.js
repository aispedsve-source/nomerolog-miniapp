/*
 * Локальное хранилище: профили и премиум-доступ.
 * Повторяет модель оригинала (SharedPreferences → localStorage):
 *   профили:  ключ "nomerolog_profiles" → JSON-массив [{id,name,day,month,year,createdAtMillis}]
 *   премиум:  ключ "nomerolog_premium"  → { premium_demo_unlocked: bool }
 * В Telegram Mini App при наличии CloudStorage дублируем туда (best-effort).
 */

const PROFILES_KEY = 'nomerolog_profiles';
const PREMIUM_KEY = 'nomerolog_premium';
const MAX_PROFILES = 50;

const tg = () => window.Telegram?.WebApp;

function lsGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : v;
  } catch (_) { return fallback; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, val); } catch (_) {}
  // best-effort mirror to Telegram CloudStorage
  try { tg()?.CloudStorage?.setItem?.(key, val, () => {}); } catch (_) {}
}

// --- Профили ---

function genId() {
  const rnd = Math.floor(Math.random() * 1e9).toString(36);
  const t = (typeof performance !== 'undefined' ? Math.floor(performance.now()) : 0).toString(36);
  return `p_${Date.now().toString(36)}_${t}_${rnd}`;
}

/** @returns {Array<{id,name,birthDate:{day,month,year},createdAtMillis}>} */
export function loadProfiles() {
  const raw = lsGet(PROFILES_KEY, '[]') || '[]';
  let arr;
  try { arr = JSON.parse(raw); } catch (_) { return []; }
  if (!Array.isArray(arr)) return [];
  const out = [];
  arr.forEach((o, i) => {
    if (!o || typeof o !== 'object') return;
    const day = Number(o.day), month = Number(o.month), year = Number(o.year);
    if (!day || !month || !year) return;
    out.push({
      id: (o.id && String(o.id).trim()) || `legacy_${i}`,
      name: (o.name && String(o.name).trim()) || 'Без имени',
      birthDate: { day, month, year },
      createdAtMillis: Number(o.createdAtMillis) || 0,
    });
  });
  return out;
}

export function saveProfiles(profiles) {
  const arr = profiles.map(p => ({
    id: p.id,
    name: p.name,
    day: p.birthDate.day,
    month: p.birthDate.month,
    year: p.birthDate.year,
    createdAtMillis: p.createdAtMillis || 0,
  }));
  lsSet(PROFILES_KEY, JSON.stringify(arr));
}

/** Добавить профиль. Возвращает обновлённый список. */
export function addProfile(name, birthDate) {
  const profiles = loadProfiles();
  if (profiles.length >= MAX_PROFILES) {
    throw new Error(`Достигнут лимит профилей (${MAX_PROFILES})`);
  }
  const profile = {
    id: genId(),
    name: name.trim() || 'Без имени',
    birthDate,
    createdAtMillis: Date.now(),
  };
  profiles.push(profile);
  saveProfiles(profiles);
  return profiles;
}

export function removeProfile(id) {
  const profiles = loadProfiles().filter(p => p.id !== id);
  saveProfiles(profiles);
  return profiles;
}

export function updateProfile(id, name, birthDate) {
  const profiles = loadProfiles();
  const p = profiles.find(x => x.id === id);
  if (p) {
    if (name != null) p.name = name.trim() || 'Без имени';
    if (birthDate) p.birthDate = birthDate;
    saveProfiles(profiles);
  }
  return profiles;
}

export function getProfile(id) {
  return loadProfiles().find(p => p.id === id) || null;
}

export function birthDateLabel(birthDate) {
  const p2 = n => String(n).padStart(2, '0');
  return `${p2(birthDate.day)}.${p2(birthDate.month)}.${String(birthDate.year).padStart(4, '0')}`;
}

// --- Премиум ---

function readPremium() {
  const raw = lsGet(PREMIUM_KEY, '{}') || '{}';
  try { return JSON.parse(raw) || {}; } catch (_) { return {}; }
}
function writePremium(obj) { lsSet(PREMIUM_KEY, JSON.stringify(obj)); }

export function isPremiumUnlocked() {
  return readPremium().premium_demo_unlocked === true;
}
export function setPremiumUnlocked(value) {
  const p = readPremium();
  p.premium_demo_unlocked = !!value;
  writePremium(p);
}
