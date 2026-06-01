const DRAFTS_KEY = "lmg-drafts";
const TRACKER_KEY = "lmg-applications";

export const TRACKER_STATUSES = [
  "Applied",
  "Referral Asked",
  "Referred",
  "OA",
  "Rejected",
  "Offer",
];

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
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

export function loadApplications() {
  return readJson(TRACKER_KEY, []);
}

export function saveApplications(list) {
  writeJson(TRACKER_KEY, list);
}

export function addApplication(entry) {
  const list = loadApplications();
  const item = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...entry,
  };
  saveApplications([item, ...list]);
  return item;
}

export function updateApplication(id, patch) {
  const list = loadApplications().map((a) =>
    a.id === id ? { ...a, ...patch } : a
  );
  saveApplications(list);
  return list;
}

export function deleteApplication(id) {
  const list = loadApplications().filter((a) => a.id !== id);
  saveApplications(list);
  return list;
}
