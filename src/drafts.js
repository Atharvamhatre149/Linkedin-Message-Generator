export function buildDraftContext(form, resumeUrl, resumeText) {
  return { ...form, company: form.company.trim(), position: form.position.trim(), jobLink: form.jobLink?.trim() || '', resumeUrl: resumeUrl.trim(), resumeText };
}

export function sameDraftContext(previous, current) {
  return !!previous && Object.keys(current).every(key => current[key] === previous[key]);
}

export function prepareGroqGeneration(form, resumeUrl, resumeText, previous, refreshTemplates) {
  const snapshot = buildDraftContext(form, resumeUrl, resumeText);
  if (!sameDraftContext(previous, snapshot)) refreshTemplates(snapshot);
  return snapshot;
}
