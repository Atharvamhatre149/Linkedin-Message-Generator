const DRAFTS_KEY = "lmg-drafts";
function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    const value = raw ? JSON.parse(raw) : fallback;
    if (Array.isArray(fallback)) return Array.isArray(value) ? value.filter(item => item && typeof item === "object" && !Array.isArray(item)) : fallback;
    return value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function draftKey(company) {
  return company.trim().toLowerCase();
}

export function loadDrafts() {
  return readJson(DRAFTS_KEY, {});
}

export function saveDraft(company, fields) {
  if (!company.trim()) return;
  const drafts = loadDrafts();
  drafts[draftKey(company)] = {
    ...fields,
    savedAt: new Date().toISOString(),
  };
  writeJson(DRAFTS_KEY, drafts);
}

export function getDraft(company) {
  return loadDrafts()[draftKey(company)] ?? null;
}

export function loadSettings() { return readJson("lmg-settings", {}); }
export function saveSettings(settings) { writeJson("lmg-settings", settings); }
export function loadHistory() { return readJson("lmg-history", []); }
export function saveMessage(entry) {
  const history = [{ ...entry, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...loadHistory()].slice(0, 20);
  writeJson("lmg-history", history);
  return history;
}
export function clearHistory() { writeJson("lmg-history", []); return []; }
