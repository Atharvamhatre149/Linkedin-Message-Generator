import { useEffect, useRef, useState } from 'react';
import './App.css';
import companyList from '../company_list.json';
import { FOCUS_OPTIONS, RESUME_URL, generateMessage, generateConnectionNote, isGenericMessageType } from './messages';
import { RESUME_TEXT } from './resume';
import { emailSubject, buildMailtoUrl } from './email';
import { loadSettings, saveSettings, loadHistory, saveMessage, clearHistory, saveDraft, getDraft } from './storage';

const EMPTY_FORM = { company: '', position: '', contactName: '', jobLink: '', jobId: '', recipient: '', channel: 'message', msgType: 'referral', focus: 'backend', jobDescription: '' };
const COMPANIES = [...new Set(companyList.map(item => item.company_name))];
const ROLE_SUGGESTIONS = [
  'Software Engineer', 'Software Engineer I', 'Software Engineer II',
  'Senior Software Engineer', 'Software Development Engineer', 'SDE-1', 'SDE-2',
  'Frontend Developer', 'Frontend Engineer', 'Backend Developer', 'Backend Engineer',
  'Full Stack Developer', 'Full Stack Engineer', 'Web Application Developer',
  'Web Developer', 'Android Developer',
];
const AUDIENCES = [ ['referral', 'Employee · specific role'], ['recruiter', 'Recruiter · specific role'], ['generic-employee', 'Employee · general opportunities'], ['generic-hr', 'HR · general opportunities'] ];
const FILTERS = [ ['recruiter', 'Recruiters'], ['hiring manager', 'Hiring managers'], ['', 'Any employee'] ];

function DraftCard({ draft, onChange, onCopy, onSave, onEmail }) {
  return <section className="output">
    <div className="output-header">
      <h2>{draft.label}</h2>
      <div className="output-actions">
        <button className="btn-copy" disabled={!draft.message.trim()} onClick={() => onCopy(draft.message)}>Copy message</button>
        {draft.channel === 'email' && <button className="btn-copy btn-copy--linkedin" disabled={!draft.message.trim() || !draft.subject.trim()} onClick={() => onEmail(draft)}>Open email</button>}
      </div>
    </div>
    {draft.channel === 'email' && <label className="subject-field">Email subject<input value={draft.subject} onChange={e => onChange({ subject: e.target.value })} /></label>}
    <textarea className="message message-editor" aria-label={`Edit ${draft.label}`} value={draft.message} onChange={e => onChange({ message: e.target.value })} />
    <div className="editor-footer"><span>{draft.message.length} characters</span><button className="chip" onClick={() => onSave(draft)}>Save edited message</button></div>
  </section>;
}

function App() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [settings, setSettings] = useState(loadSettings);
  const [resumeText, setResumeText] = useState(RESUME_TEXT);
  const [drafts, setDrafts] = useState([]);
  const [context, setContext] = useState(null);
  const [history, setHistory] = useState(loadHistory);
  const [notice, setNotice] = useState('');
  const [groq, setGroq] = useState({ configured: false, checking: true });
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const request = useRef(null);
  const resumeUrl = settings.resumeUrl || RESUME_URL;
  const noteLimit = settings.noteLimit === 300 ? 300 : 200;
  const valid = !!form.company.trim() && (isGenericMessageType(form.msgType) || !!form.position.trim());
  const note = form.company.trim() ? generateConnectionNote({ ...form, limit: noteLimit }) : '';
  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/groq/status', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error();
      setGroq({ ...await response.json(), checking: false });
    }).catch(error => { if (error.name !== 'AbortError') setGroq({ configured: false, checking: false, error: true }); });
    return () => { controller.abort(); request.current?.abort(); };
  }, []);

  function storeDraft(draft) {
    // Never persist the full resume or job description in message history.
    const { resumeText: _resume, jobDescription: _description, ...basics } = draft;
    setHistory(saveMessage(basics));
  }

  function generateTemplates() {
    if (!valid) return;
    request.current?.abort();
    setBusy(false);
    const snapshot = { ...form, company: form.company.trim(), position: form.position.trim(), resumeUrl, resumeText };
    const generated = [['short', 'Short template'], ['standard', 'Full template']].map(([tone, label]) => ({
      ...snapshot, id: tone, label, subject: snapshot.channel === 'email' ? emailSubject(snapshot) : '', message: generateMessage({ ...snapshot, tone }),
    }));
    const { resumeText: _resume, jobDescription: _description, ...savedForm } = snapshot;
    saveDraft(snapshot.company, savedForm);
    setContext(snapshot);
    setDrafts(generated);
    generated.forEach(storeDraft);
    setNotice('Short and full drafts are ready. Generate a Groq draft below to compare.');
  }

  async function generateAi() {
    if (!context || busy) return;
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    setBusy(true);
    setNotice('Generating with Groq…');
    try {
      const response = await fetch('/api/groq/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(context), signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not generate a draft.');
      if (typeof data.message !== 'string' || typeof data.subject !== 'string') throw new Error('Groq returned an invalid draft.');
      const draft = { ...context, ...data, id: 'groq', label: 'Groq draft' };
      setDrafts(current => [...current.filter(item => item.id !== 'groq'), draft]);
      storeDraft(draft);
      setNotice('Groq draft ready. Review the wording and facts before using it.');
    } catch (error) {
      if (error.name !== 'AbortError') setNotice(error.message || 'Could not reach the generation server.');
    } finally { if (request.current === controller) { setBusy(false); request.current = null; } }
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); setNotice('Message copied.'); }
    catch { setNotice('Clipboard access failed. Select the text and copy it manually.'); }
  }

  function openEmail(draft) {
    try { window.location.href = buildMailtoUrl({ to: draft.recipient, subject: draft.subject, message: draft.message }); }
    catch (error) { setNotice(error.message); }
  }

  function restore(entry) {
    request.current?.abort(); setBusy(false);
    setForm({ ...EMPTY_FORM, ...Object.fromEntries(Object.keys(EMPTY_FORM).map(key => [key, entry[key] ?? EMPTY_FORM[key]])) });
    const draft = { ...entry, id: 'restored', label: 'Restored message', channel: entry.channel || 'message', subject: entry.subject || '' };
    setContext({ ...draft, resumeText, resumeUrl });
    setDrafts([draft]);
    setNotice('Saved wording restored. Generate drafts again to use the current form.');
  }

  function reset() {
    request.current?.abort(); setBusy(false);
    setForm(EMPTY_FORM); setDrafts([]); setContext(null); setNotice('');
  }

  function saveResume(value) {
    try {
      const url = new URL(value);
      if (url.protocol !== 'https:') throw new Error();
      const next = { ...settings, resumeUrl: value.trim() };
      setSettings(next); saveSettings(next); setNotice('Resume link saved. Generate new drafts to use it.');
    } catch { setNotice('Enter a valid HTTPS resume URL.'); }
  }

  function findPeople() {
    const params = new URLSearchParams({ keywords: `${form.company.trim()} ${filter}`.trim(), origin: 'FACETED_SEARCH' });
    const company = companyList.find(item => item.company_name.toLowerCase() === form.company.trim().toLowerCase());
    if (company?.company_id) params.set('currentCompany', JSON.stringify([String(company.company_id)]));
    window.open(`https://www.linkedin.com/search/results/people/?${params}`, '_blank', 'noopener,noreferrer');
  }

  return <main className="app">
    <h1>Outreach Message Generator</h1>
    <p className="intro-hint">Two ready-to-use templates. One resume-aware Groq draft.</p>
    {notice && <p className="notice" role="status">{notice}</p>}
    <details className="settings-panel">
      <summary>Resume & connection settings</summary>
      <label>Resume URL<input key={resumeUrl} defaultValue={resumeUrl} type="url" onBlur={e => saveResume(e.target.value)} /></label>
      <a href={resumeUrl} target="_blank" rel="noopener noreferrer">Open resume ↗</a>
      <label>Resume text for Groq<textarea className="context-input" value={resumeText} maxLength={30000} onChange={e => setResumeText(e.target.value)} /></label>
      <p className="field-hint">This text is sent to Groq only when you choose Generate with Groq. Template facts come from your built-in resume highlights.</p>
      <label>Connection-note character budget<select value={noteLimit} onChange={e => { const next = { ...settings, noteLimit: Number(e.target.value) }; setSettings(next); saveSettings(next); }}><option value={200}>200 characters</option><option value={300}>300 characters</option></select></label>
    </details>
    <div className="form">
      <label>Company Name <span className="required">*</span><input placeholder="e.g. Google" list="companies" value={form.company} maxLength={200} onChange={e => update('company', e.target.value)} />
        <datalist id="companies">{COMPANIES.map(name => <option key={name} value={name} />)}</datalist>
      </label>
      <button className="chip" type="button" onClick={() => { const draft = getDraft(form.company); if (draft) { setForm({ ...EMPTY_FORM, ...draft, jobDescription: '' }); setNotice('Company draft restored.'); } else setNotice('No saved draft for this company.'); }} disabled={!form.company.trim()}>Restore company draft</button>
      <label>Position / Role <span className="optional">(required for a specific role)</span><input list="role-suggestions" placeholder="Pick a role or type your own" autoComplete="off" value={form.position} maxLength={300} onChange={e => update('position', e.target.value)} />
        <datalist id="role-suggestions">{ROLE_SUGGESTIONS.map(role => <option key={role} value={role} />)}</datalist></label>
      <label>Contact name<input placeholder="e.g. Priya" value={form.contactName} maxLength={200} onChange={e => update('contactName', e.target.value)} /></label>
      <label>Audience<select value={form.msgType} onChange={e => update('msgType', e.target.value)}>{AUDIENCES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label>Send as<select value={form.channel} onChange={e => update('channel', e.target.value)}><option value="message">Message</option><option value="email">Email</option></select></label>
      {form.channel === 'email' && <label>Recipient email <span className="optional">(optional; you can add it in your mail app)</span><input type="email" placeholder="recruiter@company.com" value={form.recipient} onChange={e => update('recipient', e.target.value)} /></label>}
      <label>Job link <span className="optional">(optional, HTTPS)</span><input type="url" placeholder="https://careers.example.com/jobs/123" maxLength={2000} value={form.jobLink} onChange={e => update('jobLink', e.target.value)} /></label>
      <label>Job ID <span className="optional">(optional)</span><input value={form.jobId} maxLength={200} onChange={e => update('jobId', e.target.value)} /></label>
      <label>Highlight from your resume<select value={form.focus} onChange={e => update('focus', e.target.value)}>{FOCUS_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
      <label>Job description <span className="optional">(optional, used by Groq)</span><textarea className="context-input" placeholder="Paste the role requirements to tailor the AI draft" maxLength={15000} value={form.jobDescription} onChange={e => update('jobDescription', e.target.value)} /></label>
      <div className="buttons-row"><button className="btn-generate" disabled={!valid} onClick={generateTemplates}>Generate drafts</button><button className="btn-reset" onClick={reset}>Reset</button></div>
    </div>
    {context && <>
      <p className="field-hint">Drafts use the form and resume at generation time. After changing inputs, generate drafts again.</p>
      {drafts.map(draft => <DraftCard key={draft.id} draft={draft} onChange={patch => setDrafts(current => current.map(item => item.id === draft.id ? { ...item, ...patch } : item))} onCopy={copy} onEmail={openEmail} onSave={item => { storeDraft(item); setNotice('Edited message saved.'); }} />)}
      <section className="groq-panel">
        <div className="tracker-header"><h2>Personalize with Groq</h2><button className="btn-generate" disabled={busy || !groq.configured || !context.resumeText.trim()} onClick={generateAi}>{busy ? 'Generating…' : drafts.some(item => item.id === 'groq') ? 'Regenerate with Groq' : 'Generate with Groq'}</button></div>
        <p className="field-hint">{groq.checking ? 'Checking Groq connection…' : groq.error ? 'Cannot reach the Groq API route. On Vercel, deploy the api/groq functions and check the deployment logs.' : groq.configured ? `Ready · ${groq.model}. Uses resume text and job description to choose relevant facts.` : 'Set GROQ_API_KEY in your server environment (.env.local locally, or Vercel Environment Variables), then restart or redeploy.'}</p>
      </section>
    </>}
    {form.channel === 'message' && <>
      <section className="find-section"><h2>Find people at {form.company || 'a company'}</h2><div className="filter-chips">{FILTERS.map(([value, label]) => <button key={label} className={`chip ${filter === value ? 'chip--active' : ''}`} onClick={() => setFilter(value)}>{label}</button>)}</div><button className="btn-linkedin" disabled={!form.company.trim()} onClick={findPeople}>Find people on LinkedIn</button></section>
      {note && <section className="output output--note"><div className="output-header"><h2>Connection note <span className="char-count">{note.length}/{noteLimit}</span></h2><button className="btn-copy" onClick={() => copy(note)}>Copy note</button></div><pre className="message">{note}</pre></section>}
    </>}
    <section className="tracker-section"><div className="tracker-header"><h2>Message history <span className="char-count">{history.length}/20</span></h2><button className="chip" disabled={!history.length} onClick={() => { setHistory(clearHistory()); setNotice('Message history cleared.'); }}>Clear history</button></div>
      <p className="field-hint">Last 20 drafts in this browser. Full resume and job-description text are not saved.</p>
      {history.map(entry => <details className="history-item" key={entry.id}><summary>{entry.company} · {entry.label || entry.position || 'Message'} · {new Date(entry.createdAt).toLocaleString()}</summary>{entry.subject && <p className="field-hint">Subject: {entry.subject}</p>}<pre className="message message--compact">{entry.message}</pre><div className="output-actions"><button className="chip" onClick={() => copy(entry.message)}>Copy saved message</button><button className="chip" onClick={() => restore(entry)}>Restore</button></div></details>)}
    </section>
  </main>;
}
export default App;
