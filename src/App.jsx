import { useState } from "react";
import "./App.css";
import companyList from "../company_list.json";

// Case-insensitive name → id map; first valid id wins on duplicates
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

function extractCompanyId(input) {
  if (!input) return "";
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/linkedin\.com\/company\/(\d+)/i);
  return match ? match[1] : "";
}

// Open connections at this company — to find people to message
function buildConnectionsUrl(companyId, filterKeywords) {
  const params = new URLSearchParams({
    origin: "FACETED_SEARCH",
    network: '["F"]',
    currentCompany: `["${companyId}"]`,
  });
  if (filterKeywords) params.set("keywords", filterKeywords);
  return `https://www.linkedin.com/search/results/people/?${params}`;
}

// Keyword search — to find people to send connection requests
function buildSearchUrl(companyName) {
  const params = new URLSearchParams({
    keywords: companyName,
    origin: "SWITCH_SEARCH_VERTICAL",
  });
  return `https://www.linkedin.com/search/results/people/?${params}`;
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
  const [activeFilter, setActiveFilter] = useState(4);
  const [msgType, setMsgType] = useState("referral");
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);

  const extractedId = extractCompanyId(companyLinkedInId);
  const isValid = company.trim() && position.trim();

  // Filtered company suggestions (max 10) for the autocomplete dropdown
  const companyMatches = (() => {
    const q = company.trim().toLowerCase();
    if (!q) return COMPANY_NAMES.slice(0, 10);
    return COMPANY_NAMES.filter((n) => n.toLowerCase().includes(q)).slice(0, 10);
  })();

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
  }

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
    setActiveFilter(4);
    setShowCompanyDropdown(false);
  }

  function handleMyConnections() {
    if (!extractedId) return;
    const url = buildConnectionsUrl(extractedId, FILTERS[activeFilter].keywords);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleFindPeople() {
    const url = buildSearchUrl(company.trim());
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="app">
      <h1>LinkedIn Message Generator</h1>

      {/* ── Form ── */}
      <div className="form">
        <label className="company-field">
          Company Name <span className="required">*</span>
          <input
            value={company}
            onChange={(e) => handleCompanyChange(e.target.value)}
            onFocus={() => setShowCompanyDropdown(true)}
            onBlur={() => setTimeout(() => setShowCompanyDropdown(false), 150)}
            placeholder="e.g. Google"
            autoComplete="off"
          />
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
            <button
              className="btn-generate"
              disabled={!isValid}
              onClick={() => handleGenerate("referral")}
            >
              👥 Referral Message
            </button>
            <button
              className="btn-generate btn-generate--recruiter"
              disabled={!isValid}
              onClick={() => handleGenerate("recruiter")}
            >
              🎯 Recruiter Message
            </button>
          </div>
          <button className="btn-reset" onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>

      {/* ── Find on LinkedIn ── */}
      <div
        className={`find-section ${
          !company.trim() ? "find-section--disabled" : ""
        }`}
      >
        <div className="find-header">
          <span className="find-title">
            <LinkedInIcon className="linkedin-icon" />
            Find {msgType === "recruiter" ? "Recruiters" : "Employees"} at{" "}
            {company.trim() || "Company"}
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

        <div className="search-buttons">
          <button
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

      {/* ── Generated Output ── */}
      {message && (
        <div className="output">
          <div className="output-header">
            <h2>
              {msgType === "recruiter"
                ? "🎯 Recruiter Message"
                : "👥 Referral Message"}
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
