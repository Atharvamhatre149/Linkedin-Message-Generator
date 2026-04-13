import { useState } from "react";
import "./App.css";

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

function App() {
  const [company, setCompany] = useState("");
  const [position, setPosition] = useState("");
  const [jobLink, setJobLink] = useState("");
  const [jobId, setJobId] = useState("");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);

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

      {message && (
        <div className="output">
          <div className="output-header">
            <h2>Generated Message</h2>
            <button className="btn-copy" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <pre className="message">{message}</pre>
        </div>
      )}
    </div>
  );
}

export default App;
