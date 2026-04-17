import { useState } from "react";
import "./App.css";

const FILTERS = [
  { label: "Recruiter", keywords: "recruiter" },
  { label: "HR", keywords: "human resources" },
  { label: "Hiring Manager", keywords: "hiring manager" },
  { label: "Engineering Manager", keywords: "engineering manager" },
  { label: "Any Employee", keywords: "" },
];

function generateMessage({ company, position, jobLink, jobId }) {
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

function buildLinkedInUrl(company, filterKeywords) {
  const params = new URLSearchParams();
  const query = filterKeywords
    ? `${filterKeywords} ${company}`
    : company;
  params.set("keywords", query);
  params.set("origin", "GLOBAL_SEARCH_HEADER");
  return `https://www.linkedin.com/search/results/people/?${params.toString()}`;
}

function App() {
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [jobLink, setJobLink] = useState("");
  const [jobId, setJobId] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [activeFilter, setActiveFilter] = useState(0);

  const isValid = company.trim() && position.trim();

  function handleGenerate() {
    setMessage(
      generateMessage({
        company: company.trim(),
        position: position.trim(),
        jobLink: jobLink.trim(),
        jobId: jobId.trim(),
      })
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
    setMessage("");
    setCopied(false);
    setActiveFilter(0);
  }

  function handleFindEmployees() {
    const url = buildLinkedInUrl(
      company.trim(),
      FILTERS[activeFilter].keywords
    );
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="app">
      <h1>LinkedIn Referral Message Generator</h1>

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
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            placeholder="e.g. Software Engineer"
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

        <div className="buttons">
          <button
            className="btn-generate"
            disabled={!isValid}
            onClick={handleGenerate}
          >
            Generate Message
          </button>
          <button className="btn-reset" onClick={handleReset}>
            Reset
          </button>
        </div>
      </div>

      {/* Find Employees Section */}
      <div className={`find-section ${!company.trim() ? "find-section--disabled" : ""}`}>
        <div className="find-header">
          <span className="find-title">
            <svg className="linkedin-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            Find Employees at {company.trim() || "Company"}
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

        <button
          className="btn-linkedin"
          disabled={!company.trim()}
          onClick={handleFindEmployees}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="btn-icon">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 23.227 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
          </svg>
          Search on LinkedIn →
        </button>

        <p className="find-hint">
          Opens LinkedIn people search in a new tab. Copy your generated message, then paste it in their LinkedIn chat.
        </p>
      </div>

      {message && (
        <div className="output">
          <div className="output-header">
            <h2>Generated Message</h2>
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
