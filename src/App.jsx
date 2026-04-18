import { useState } from "react";
import "./App.css";

const FILTERS = [
  { label: "Recruiter", keywords: "recruiter" },
  { label: "HR", keywords: "human resources" },
  { label: "Hiring Manager", keywords: "hiring manager" },
  { label: "Engineering Manager", keywords: "engineering manager" },
  { label: "Any Employee", keywords: "" },
];

// Common tech-role suggestions shown in the Position/Role dropdown.
// Users can still type anything custom — this is just autocomplete.
const ROLE_SUGGESTIONS = [
  // Generalist SWE ladders
  "Software Engineer",
  "Software Engineer I",
  "Software Engineer II",
  "Software Engineer III",
  "Senior Software Engineer",
  "Staff Software Engineer",
  "Principal Software Engineer",
  // Amazon-style SDE ladder
  "Software Development Engineer",
  "SDE-1",
  "SDE-2",
  "SDE-3",
  // Stack specialisations
  "Frontend Developer",
  "Frontend Engineer",
  "Backend Developer",
  "Backend Engineer",
  "Full Stack Developer",
  "Full Stack Engineer",
  "Web Developer",
  "Mobile Developer",
  "iOS Developer",
  "Android Developer",
  // Platform / infra
  "DevOps Engineer",
  "Site Reliability Engineer",
  "Cloud Engineer",
  "Platform Engineer",
  "Systems Engineer",
  // Data / AI
  "Data Engineer",
  "Data Scientist",
  "Machine Learning Engineer",
  "AI Engineer",
  // Quality / security
  "QA Engineer",
  "Test Engineer",
  "Security Engineer",
  // Leadership
  "Engineering Manager",
  "Technical Lead",
  "Tech Lead",
];


function generateReferralMessage({ company, position, jobLink, jobId }) {
  const jobIdPart = jobId ? ` (Job ID: ${jobId})` : "";
  const jobLinkPart = jobLink ? ` (${jobLink})` : "";

  return `Hi,

I'm Atharva Mhatre, currently working as a Web Application Developer at Media.net with 1.5+ years of experience building scalable backend and full-stack systems.

I came across the ${position}${jobIdPart} opening at ${company}${jobLinkPart}, and I'm very interested in contributing — especially given my background in Go, JavaScript, Kafka, Redis, Gen-AI and experience developing systems handling 10M+ daily requests.

I've also solved 1000+ Data Structures & Algorithm problems (ICPC Regionalist), which has strengthened my problem-solving and system design skills.
🔗 GitHub: https://github.com/Atharvamhatre149
🔗 LeetCode: https://leetcode.com/u/ATHARVA_MHATRE/

If possible, could you please refer me for this role or guide me through the referral process?
📄 Resume: https://drive.google.com/file/d/1RYEX6EN371k2UcvasTVb8r5f5SxGxhMX/view?usp=sharing

Best regards,
Atharva Mhatre
atharvamhatre149@gmail.com`;
}

function generateRecruiterMessage({ company, position, jobLink, jobId }) {
  const jobIdPart = jobId ? ` (Job ID: ${jobId})` : "";
  const jobLinkPart = jobLink ? ` (${jobLink})` : "";

  return `Hi,

I came across the ${position}${jobIdPart} role at ${company}${jobLinkPart} and wanted to express my strong interest in the position.

I'm Atharva Mhatre, currently working as a Web Application Developer at Media.net with 1.5+ years of experience building scalable backend and full-stack systems in Go, JavaScript, Kafka, Redis, and Gen-AI — with systems handling 10M+ daily requests.

I've also solved 1000+ Data Structures & Algorithm problems (ICPC Regionalist), which has sharpened my problem-solving and system design skills.
🔗 GitHub: https://github.com/Atharvamhatre149
🔗 LeetCode: https://leetcode.com/u/ATHARVA_MHATRE/
📄 Resume: https://drive.google.com/file/d/1RYEX6EN371k2UcvasTVb8r5f5SxGxhMX/view?usp=sharing

I'd love to be considered for this role. Can you consider me for this position?

Best regards,
Atharva Mhatre
atharvamhatre149@gmail.com`;
}

// Extract numeric company ID from either a raw number ("3015")
// or a LinkedIn company URL like https://www.linkedin.com/company/3015/
function extractCompanyId(input) {
  if (!input) return "";
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/linkedin\.com\/company\/(\d+)/i);
  return match ? match[1] : "";
}

function buildLinkedInUrl({ company, companyId, filterKeywords, connectionsOnly }) {
  const params = new URLSearchParams();

  if (companyId) {
    // Faceted search — targets the exact company via LinkedIn's internal ID.
    params.set("origin", "FACETED_SEARCH");
    params.set("currentCompany", `["${companyId}"]`);
    if (filterKeywords) params.set("keywords", filterKeywords);
  } else {
    // Fallback: keyword search (less precise).
    const query = filterKeywords ? `${filterKeywords} ${company}` : company;
    params.set("keywords", query);
    params.set("origin", "GLOBAL_SEARCH_HEADER");
  }

  if (connectionsOnly) params.set("network", '["F"]');
  return `https://www.linkedin.com/search/results/people/?${params.toString()}`;
}

function buildCompanyLookupUrl(companyName) {
  const params = new URLSearchParams();
  params.set("keywords", companyName);
  params.set("origin", "GLOBAL_SEARCH_HEADER");
  return `https://www.linkedin.com/search/results/companies/?${params.toString()}`;
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
  const [companyLinkedInId, setCompanyLinkedInId] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeFilter, setActiveFilter] = useState(0);
  const [msgType, setMsgType] = useState("referral");
  const [lookupState, setLookupState] = useState({ loading: false, error: "" });

  const extractedId = extractCompanyId(companyLinkedInId);

  const isValid = company.trim() && position.trim();

  function handleGenerate(type) {
    const params = {
      company: company.trim(),
      position: position.trim(),
      jobLink: jobLink.trim(),
      jobId: jobId.trim(),
    };
    setMsgType(type);
    setMessage(
      type === "recruiter"
        ? generateRecruiterMessage(params)
        : generateReferralMessage(params)
    );
    setCopied(false);
  }

  function handleCopy() {
    navigator.clipboard.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleReset() {
    setCompany("");
    setPosition("");
    setJobLink("");
    setJobId("");
    setCompanyLinkedInId("");
    setMessage("");
    setCopied(false);
    setActiveFilter(0);
  }

  function handleFindEmployees(connectionsOnly = false) {
    const url = buildLinkedInUrl({
      company: company.trim(),
      companyId: extractedId,
      filterKeywords: FILTERS[activeFilter].keywords,
      connectionsOnly,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleAutoDetect() {
    const name = company.trim();
    if (!name) return;
    setLookupState({ loading: true, error: "" });
    try {
      const resp = await fetch("/api/lookup-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.id) {
        setLookupState({
          loading: false,
          error:
            data.error === "not_found"
              ? "Couldn't find this company on LinkedIn. Paste the ID manually."
              : "Lookup failed. Try again or paste the ID manually.",
        });
        return;
      }
      setCompanyLinkedInId(data.id);
      setLookupState({ loading: false, error: "" });
    } catch (e) {
      setLookupState({ loading: false, error: "Lookup failed — check dev server." });
    }
  }

  return (
    <div className="app">
      <h1>LinkedIn Message Generator</h1>

      {/* Form */}
      <div className="form">
        <label>
          Company Name <span className="required">*</span>
          <input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Google"
          />
        </label>

        <label>
          Position / Role <span className="required">*</span>
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

        <div className="buttons">
          <div className="buttons-row">
            <button className="btn-generate" disabled={!isValid} onClick={() => handleGenerate("referral")}>
              👥 Referral Message
            </button>
            <button className="btn-generate btn-generate--recruiter" disabled={!isValid} onClick={() => handleGenerate("recruiter")}>
              🎯 Recruiter Message
            </button>
          </div>
          <button className="btn-reset" onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>

      {/* Find on LinkedIn */}
      <div className={`find-section ${!company.trim() ? "find-section--disabled" : ""}`}>
        <div className="find-header">
          <span className="find-title">
            <LinkedInIcon className="linkedin-icon" />
            Find {msgType === "recruiter" ? "Recruiters" : "Employees"} at {company.trim() || "Company"}
          </span>
        </div>

        <div className="filter-chips">
          {FILTERS.map((f, i) => (
            <button
              key={f.label}
              className={`chip ${activeFilter === i ? "chip--active" : ""}`}
              onClick={() => setActiveFilter(i)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="company-id-label">
          <span className="company-id-header">
            LinkedIn Company ID <span className="optional">(auto-detected)</span>
            <button
              type="button"
              className="auto-detect-btn"
              disabled={!company.trim() || lookupState.loading}
              onClick={handleAutoDetect}
            >
              {lookupState.loading ? "Detecting…" : "🔍 Auto-detect"}
            </button>
          </span>
          <input
            value={companyLinkedInId}
            onChange={(e) => setCompanyLinkedInId(e.target.value)}
            placeholder="Click Auto-detect, or paste ID/URL manually"
          />
          {lookupState.error && (
            <span className="company-id-warn">⚠ {lookupState.error}</span>
          )}
          {!lookupState.error && companyLinkedInId && !extractedId && (
            <span className="company-id-warn">⚠ Not a valid numeric ID — will fall back to keyword search.</span>
          )}
          {!lookupState.error && extractedId && (
            <span className="company-id-ok">✓ Using faceted search for company ID <strong>{extractedId}</strong></span>
          )}
        </div>

        <div className="search-buttons">
          <button className="btn-linkedin" disabled={!company.trim()} onClick={() => handleFindEmployees(false)}>
            <LinkedInIcon className="btn-icon" />
            Search on LinkedIn
          </button>
          <button className="btn-linkedin btn-linkedin--connections" disabled={!company.trim()} onClick={() => handleFindEmployees(true)}>
            <svg className="btn-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
            My Connections
          </button>
        </div>

        <p className="find-hint">
          {extractedId ? (
            <>🎯 <strong>Accurate mode:</strong> filtering by company ID · <strong>My Connections</strong> — only your 1st-degree connections</>
          ) : (
            <>🔍 <strong>Keyword mode:</strong> results may be fuzzy — paste the Company ID above for exact matches</>
          )}
        </p>
      </div>

      {/* Generated Output */}
      {message && (
        <div className="output">
          <div className="output-header">
            <h2>
              {msgType === "recruiter" ? "🎯 Recruiter Message" : "👥 Referral Message"}
            </h2>
            <button className="btn-copy" onClick={handleCopy}>
              {copied ? "✓ Copied!" : "Copy"}
            </button>
          </div>
          <pre className="message">{message}</pre>
        </div>
      )}
    </div>
  );
}

export default App;
