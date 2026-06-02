import { useEffect, useMemo, useState } from "react";
import "./App.css";
import companyList from "../company_list.json";
import {
  TONE_OPTIONS,
  generateConnectionNote,
  generateMessage,
  connectionNoteMeta,
  isGenericMessageType,
} from "./messages";
import {
  TRACKER_STATUSES,
  addApplication,
  deleteApplication,
  getDraft,
  loadApplications,
  saveDraft,
  updateApplication,
} from "./storage";

const COMPANY_MAP = {};
for (const { company_name, company_id } of companyList) {
  const key = company_name.toLowerCase();
  if (!COMPANY_MAP[key] && company_id) {
    COMPANY_MAP[key] = company_id;
  }
}
const COMPANY_NAMES = [...new Set(companyList.map((c) => c.company_name))];

const FILTERS = [
  { label: "Recruiter", keywords: "recruiter" },
  { label: "HR", keywords: "human resources" },
  { label: "Hiring Manager", keywords: "hiring manager" },
  { label: "Engineering Manager", keywords: "engineering manager" },
  { label: "Any Employee", keywords: "" },
];

const ROLE_SUGGESTIONS = [
  "Software Engineer",
  "Software Engineer I",
  "Software Engineer II",
  "Senior Software Engineer",
  "Software Development Engineer",
  "SDE-1",
  "SDE-2",
  "Frontend Developer",
  "Frontend Engineer",
  "Backend Developer",
  "Backend Engineer",
  "Full Stack Developer",
  "Full Stack Engineer",
  "Web Application Developer",
  "Web Developer",
  "Android Developer",
];

function extractCompanyId(input) {
  if (!input) return "";
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/linkedin\.com\/company\/(\d+)/i);
  return match ? match[1] : "";
}

function buildConnectionsUrl(companyId, filterKeywords) {
  const params = new URLSearchParams({
    origin: "FACETED_SEARCH",
    network: '["F"]',
    currentCompany: `["${companyId}"]`,
  });
  if (filterKeywords) params.set("keywords", filterKeywords);
  return `https://www.linkedin.com/search/results/people/?${params}`;
}

function buildSearchUrl(companyName) {
  const params = new URLSearchParams({
    keywords: companyName,
    origin: "SWITCH_SEARCH_VERTICAL",
  });
  return `https://www.linkedin.com/search/results/people/?${params}`;
}

function getLinkedInSearchUrl(company, companyLinkedInId, filterKeywords) {
  const id = extractCompanyId(companyLinkedInId);
  if (id) return buildConnectionsUrl(id, filterKeywords);
  return buildSearchUrl(company);
}

const LinkedInIcon = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

function App() {
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [jobLink, setJobLink] = useState("");
  const [jobId, setJobId] = useState("");
  const [contactName, setContactName] = useState("");
  const [companyLinkedInId, setCompanyLinkedInId] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [noteCopied, setNoteCopied] = useState(false);
  const [activeFilter, setActiveFilter] = useState(4);
  const [msgType, setMsgType] = useState("referral");
  const [tone, setTone] = useState("standard");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [draftHint, setDraftHint] = useState("");
  const [applications, setApplications] = useState(() => loadApplications());

  const extractedId = extractCompanyId(companyLinkedInId);
  const hasCompany = !!company.trim();
  const isRoleMessageValid = hasCompany && !!position.trim();

  const connectionNote = useMemo(() => {
    if (!hasCompany) return "";
    return generateConnectionNote({
      company: company.trim(),
      position: position.trim(),
    });
  }, [company, position, hasCompany]);

  const noteMeta = connectionNote ? connectionNoteMeta(connectionNote) : null;

  const companyMatches = (() => {
    const q = company.trim().toLowerCase();
    if (!q) return COMPANY_NAMES.slice(0, 10);
    return COMPANY_NAMES.filter((n) => n.toLowerCase().includes(q)).slice(0, 10);
  })();

  const formParams = () => ({
    company: company.trim(),
    position: position.trim(),
    jobLink: jobLink.trim(),
    jobId: jobId.trim(),
    contactName: contactName.trim(),
  });

  function persistDraft(fields) {
    if (!fields.company) return;
    saveDraft(fields.company, fields);
  }

  function applyDraft(name) {
    const draft = getDraft(name);
    if (!draft) return false;
    setPosition(draft.position ?? "");
    setJobLink(draft.jobLink ?? "");
    setJobId(draft.jobId ?? "");
    setContactName(draft.contactName ?? "");
    setCompanyLinkedInId(
      draft.companyLinkedInId ?? COMPANY_MAP[name.toLowerCase()] ?? ""
    );
    setDraftHint(`Draft restored for ${name}`);
    setTimeout(() => setDraftHint(""), 3000);
    return true;
  }

  function refreshOutputs(type, toneId) {
    const params = formParams();
    setMsgType(type);
    setTone(toneId);
    setMessage(generateMessage({ msgType: type, tone: toneId, ...params }));
    setCopied(false);
    setNoteCopied(false);
  }

  useEffect(() => {
    if (!company.trim()) return;
    const t = setTimeout(() => {
      persistDraft({
        company: company.trim(),
        position,
        jobLink,
        jobId,
        contactName,
        companyLinkedInId,
      });
    }, 500);
    return () => clearTimeout(t);
  }, [company, position, jobLink, jobId, contactName, companyLinkedInId]);

  function handleCompanyChange(value) {
    setCompany(value);
    const mapped = COMPANY_MAP[value.trim().toLowerCase()];
    setCompanyLinkedInId(mapped ?? "");
    setShowCompanyDropdown(true);
  }

  function handlePickCompany(name) {
    setCompany(name);
    setCompanyLinkedInId(COMPANY_MAP[name.toLowerCase()] ?? "");
    setShowCompanyDropdown(false);
    applyDraft(name);
  }

  function handleGenerate(type) {
    if (!isRoleMessageValid) return;
    refreshOutputs(type, tone);
    persistDraft({
      company: company.trim(),
      position,
      jobLink,
      jobId,
      contactName,
      companyLinkedInId,
    });
  }

  function handleGenerateGeneric(type) {
    if (!hasCompany) return;
    setMsgType(type);
    setTone("standard");
    setMessage(generateMessage({ msgType: type, tone: "standard", ...formParams() }));
    setCopied(false);
    setNoteCopied(false);
    persistDraft({
      company: company.trim(),
      position,
      jobLink,
      jobId,
      contactName,
      companyLinkedInId,
    });
  }

  function handleToneChange(toneId) {
    setTone(toneId);
    if (message && isRoleMessageValid && !isGenericMessageType(msgType)) {
      setMessage(generateMessage({ msgType, tone: toneId, ...formParams() }));
      setCopied(false);
    }
  }

  function copyText(text, setCopiedFlag) {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedFlag(true);
      setTimeout(() => setCopiedFlag(false), 2000);
    });
  }

  function handleCopy() {
    copyText(message, setCopied);
  }

  function handleCopyNote() {
    copyText(connectionNote, setNoteCopied);
  }

  function handleCopyAndOpenLinkedIn() {
    if (!message) return;
    const url = getLinkedInSearchUrl(
      company.trim(),
      companyLinkedInId,
      FILTERS[activeFilter].keywords
    );
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      window.open(url, "_blank", "noopener,noreferrer");
    });
  }

  function handleReset() {
    setCompany("");
    setPosition("");
    setJobLink("");
    setJobId("");
    setContactName("");
    setCompanyLinkedInId("");
    setMessage("");
    setCopied(false);
    setNoteCopied(false);
    setActiveFilter(4);
    setTone("standard");
    setShowCompanyDropdown(false);
    setDraftHint("");
  }

  function handleMyConnections() {
    if (!extractedId) return;
    window.open(
      buildConnectionsUrl(extractedId, FILTERS[activeFilter].keywords),
      "_blank",
      "noopener,noreferrer"
    );
  }

  function handleFindPeople() {
    window.open(buildSearchUrl(company.trim()), "_blank", "noopener,noreferrer");
  }

  function handleAddToTracker() {
    if (!hasCompany) return;
    const list = addApplication({
      company: company.trim(),
      position: position.trim() || "General outreach",
      dateApplied: new Date().toISOString().slice(0, 10),
      referralAsked: msgType === "referral",
      contactName: contactName.trim(),
      status: msgType === "referral" ? "Referral Asked" : "Applied",
      jobLink: jobLink.trim(),
    });
    setApplications(list);
  }

  function handleTrackerChange(id, field, value) {
    setApplications(updateApplication(id, { [field]: value }));
  }

  function handleTrackerDelete(id) {
    setApplications(deleteApplication(id));
  }

  const toneLabel = TONE_OPTIONS.find((t) => t.id === tone)?.label ?? tone;
  const outputTitle = (() => {
    if (msgType === "generic-hr") return "Generic outreach · HR";
    if (msgType === "generic-employee") return "Generic outreach · Employee";
    if (tone === "follow-up") return "Follow-up";
    if (msgType === "recruiter") return "Recruiter";
    return "Referral";
  })();

  const findAudience =
    msgType === "generic-hr"
      ? "HR"
      : msgType === "generic-employee" || msgType === "referral"
        ? "Employees"
        : "Recruiters";

  return (
    <div className="app">
      <h1>LinkedIn Message Generator</h1>

      <div className="form">
        <label className="company-field">
          Company Name <span className="required">*</span>
          <input
            value={company}
            onChange={(e) => handleCompanyChange(e.target.value)}
            onFocus={() => setShowCompanyDropdown(true)}
            onBlur={() => {
              setTimeout(() => {
                setShowCompanyDropdown(false);
                const name = company.trim();
                if (name && getDraft(name) && !position.trim()) {
                  applyDraft(name);
                }
              }, 150);
            }}
            placeholder="e.g. Google"
            autoComplete="off"
          />
          {draftHint && <span className="draft-hint">{draftHint}</span>}
          {showCompanyDropdown && companyMatches.length > 0 && (
            <div className="company-dropdown">
              {companyMatches.map((name) => (
                <button
                  type="button"
                  key={name}
                  className="company-dropdown-item"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePickCompany(name)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </label>

        <label>
          Position / Role{" "}
          <span className="optional">(required for role-specific messages)</span>
          <input
            list="role-suggestions"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="Pick from dropdown or type your own"
            autoComplete="off"
          />
          <datalist id="role-suggestions">
            {ROLE_SUGGESTIONS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>
        </label>

        <label>
          Contact name{" "}
          <span className="optional">(optional — used in greeting)</span>
          <input
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="e.g. Priya"
            autoComplete="off"
          />
        </label>

        <label>
          Job Link <span className="optional">(optional)</span>
          <input
            value={jobLink}
            onChange={(e) => setJobLink(e.target.value)}
            placeholder="e.g. https://careers.google.com/..."
          />
        </label>

        <label>
          Job ID <span className="optional">(optional)</span>
          <input
            value={jobId}
            onChange={(e) => setJobId(e.target.value)}
            placeholder="e.g. JOB-12345"
          />
        </label>

        <div className="variant-section">
          <span className="variant-label">
            Message tone <span className="optional">(role-specific only)</span>
          </span>
          <div className="filter-chips">
            {TONE_OPTIONS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`chip ${tone === t.id ? "chip--active" : ""}`}
                onClick={() => handleToneChange(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="buttons">
          <p className="buttons-section-label">Specific role</p>
          <div className="buttons-row">
            <button
              type="button"
              className="btn-generate"
              disabled={!isRoleMessageValid}
              onClick={() => handleGenerate("referral")}
            >
              Referral Message
            </button>
            <button
              type="button"
              className="btn-generate btn-generate--recruiter"
              disabled={!isRoleMessageValid}
              onClick={() => handleGenerate("recruiter")}
            >
              Recruiter Message
            </button>
          </div>

          <p className="buttons-section-label">
            No job posting — company only
          </p>
          <div className="buttons-row">
            <button
              type="button"
              className="btn-generate btn-generate--generic-hr"
              disabled={!hasCompany}
              onClick={() => handleGenerateGeneric("generic-hr")}
            >
              Generic · HR
            </button>
            <button
              type="button"
              className="btn-generate btn-generate--generic-employee"
              disabled={!hasCompany}
              onClick={() => handleGenerateGeneric("generic-employee")}
            >
              Generic · Employee
            </button>
          </div>

          <button className="btn-reset" type="button" onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>

      <div
        className={`find-section ${
          !company.trim() ? "find-section--disabled" : ""
        }`}
      >
        <div className="find-header">
          <span className="find-title">
            <LinkedInIcon className="linkedin-icon" />
            Find {findAudience} at{" "}
            {company.trim() || "Company"}
          </span>
        </div>

        <div className="filter-chips">
          {FILTERS.map((f, i) => (
            <button
              key={f.label}
              type="button"
              className={`chip ${activeFilter === i ? "chip--active" : ""}`}
              onClick={() => setActiveFilter(i)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="search-buttons">
          <button
            type="button"
            className="btn-linkedin btn-linkedin--connections"
            disabled={!company.trim() || !extractedId}
            onClick={handleMyConnections}
            title={!extractedId ? "Company ID required for connections search" : ""}
          >
            <svg className="btn-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
            </svg>
            My Connections
          </button>
          <button
            type="button"
            className="btn-linkedin"
            disabled={!company.trim()}
            onClick={handleFindPeople}
          >
            <LinkedInIcon className="btn-icon" />
            Find People
          </button>
        </div>

        <p className="find-hint">
          {extractedId ? (
            <>
              <strong>My Connections</strong> — message your 1st-degree connections ·{" "}
              <strong>Find People</strong> — browse all employees to connect
            </>
          ) : (
            <>
              <strong>Find People</strong> opens a keyword search ·{" "}
              <strong>My Connections</strong> needs a company from the dropdown
            </>
          )}
        </p>
      </div>

      {hasCompany && connectionNote && (
        <div className="output output--note">
          <div className="output-header">
            <h2>
              Connection note
              {noteMeta && (
                <span
                  className={`char-count ${noteMeta.over ? "char-count--over" : ""}`}
                >
                  {noteMeta.length}/{noteMeta.limit}
                </span>
              )}
            </h2>
            <button type="button" className="btn-copy" onClick={handleCopyNote}>
              {noteCopied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="message message--compact">{connectionNote}</pre>
        </div>
      )}

      {message && (
        <div className="output">
          <div className="output-header">
            <h2>
              {outputTitle}
              {!isGenericMessageType(msgType) && ` · ${toneLabel}`}
            </h2>
            <div className="output-actions">
              <button type="button" className="btn-copy" onClick={handleCopy}>
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                className="btn-copy btn-copy--linkedin"
                onClick={handleCopyAndOpenLinkedIn}
              >
                Copy + LinkedIn
              </button>
            </div>
          </div>
          <pre className="message">{message}</pre>
        </div>
      )}

      <section className="tracker-section">
        <div className="tracker-header">
          <h2>Application tracker</h2>
          <button
            type="button"
            className="btn-tracker-add"
            disabled={!hasCompany}
            onClick={handleAddToTracker}
          >
            Add current job
          </button>
        </div>
        <p className="tracker-hint">
          Saved in this browser only. Use after you generate a message or apply.
        </p>
        {applications.length === 0 ? (
          <p className="tracker-empty">No applications tracked yet.</p>
        ) : (
          <div className="tracker-table-wrap">
            <table className="tracker-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Date</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {applications.map((row) => (
                  <tr key={row.id}>
                    <td>{row.company}</td>
                    <td>{row.position}</td>
                    <td>
                      <input
                        type="date"
                        className="tracker-input"
                        value={row.dateApplied ?? ""}
                        onChange={(e) =>
                          handleTrackerChange(row.id, "dateApplied", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="tracker-input"
                        value={row.contactName ?? ""}
                        placeholder="Name"
                        onChange={(e) =>
                          handleTrackerChange(row.id, "contactName", e.target.value)
                        }
                      />
                    </td>
                    <td>
                      <select
                        className="tracker-select"
                        value={row.status ?? "Applied"}
                        onChange={(e) =>
                          handleTrackerChange(row.id, "status", e.target.value)
                        }
                      >
                        {TRACKER_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-tracker-delete"
                        onClick={() => handleTrackerDelete(row.id)}
                        aria-label="Delete"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default App;
