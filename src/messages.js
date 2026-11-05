export const RESUME_URL =
  "https://drive.google.com/file/d/1eXCID_ci0ZdCDhY3jv9mKl8-eye1Lw_U/view?usp=sharing";

const EMAIL = "atharvamhatre1492@gmail.com";
const PHONE = "+91 97698 75960";
const GITHUB_URL = "https://github.com/Atharvamhatre149";
const LEETCODE_URL = "https://leetcode.com/u/ATHARVA_MHATRE/";

// Each highlight is grounded in the November 2026 resume. Platform metrics
// describe the platform Atharva contributed to, rather than sole ownership.
export const FOCUS_OPTIONS = [
  { id: "backend", label: "Backend & distributed systems", text: "At Media.net, I build features across a distributed Go-based AdTech platform handling 100M+ daily requests across 6+ microservices and 10+ ad providers. My work includes gRPC integrations, Redis caching, and rate limiting that cut refresh events by approximately 30%." },
  { id: "search", label: "Semantic search & AI", text: "I developed semantic retrieval using multilingual-e5 embeddings and Redis Vector Search, improving match coverage by 40%. I also collaborated on an agentic AI coding harness using LangGraph with sandboxed execution and automated validation." },
  { id: "conversions", label: "Conversion tracking & integrations", text: "I owned offline conversion tracking for Google and Bing across 3 repositories, including migration to Google's Data Manager API. This improved conversion feedback by 30% and helped prevent conversion loss during audit delays." },
  { id: "security", label: "Backend security", text: "I secured an internal affiliate management platform with backend-verified Google OAuth, signed session cookies, and multi-tenant RBAC with resource-level permissions and fail-closed authorization." },
  { id: "automation", label: "Python & developer tools", text: "For my EasyFill project, I built a Python/FastAPI backend for LLM-based form filling, reducing application time by 75% with 90% mapping accuracy. I also built a concurrent job-aggregation pipeline across 4 sources using asyncio and tiered TTL caching." },
];

export const TONE_OPTIONS = [
  { id: "standard", label: "Standard" },
  { id: "short", label: "Short" },
  { id: "follow-up", label: "Follow-up" },
];
export const GENERIC_MSG_TYPES = ["generic-hr", "generic-employee"];
export function isGenericMessageType(type) { return GENERIC_MSG_TYPES.includes(type); }

export function generateMessage({ msgType = "referral", tone = "standard", company = "", position = "", contactName = "", jobId = "", jobLink = "", focus = "backend", resumeUrl = RESUME_URL } = {}) {
  const greeting = contactName.trim() ? `Hi ${contactName.trim()},` : "Hi,";
  const generic = isGenericMessageType(msgType);
  const recruiter = msgType === "recruiter" || msgType === "generic-hr";
  const target = generic ? `backend or software engineering opportunities at ${company}` : `the ${position} role at ${company}`;
  const resume = `Resume: ${resumeUrl.trim() || RESUME_URL}`;
  if (tone === "follow-up") {
    const request = recruiter ? "my earlier message" : "my referral request";
    return `${greeting}\n\nI'm following up on ${request} about ${target}. I'm still interested and would appreciate any update or guidance when you have a chance.\n\n${resume}\n\nThank you for your time,\nAtharva Mhatre`;
  }
  const intro = "I'm Atharva Mhatre, a Backend Software Engineer at Media.net working with Go, gRPC, Kafka, Redis, Kubernetes, and GCP.";
  const highlight = FOCUS_OPTIONS.find(option => option.id === focus) ?? FOCUS_OPTIONS[0];
  const details = !generic ? [jobId.trim() && `Job ID: ${jobId.trim()}`, jobLink.trim() && `Job posting: ${jobLink.trim()}`].filter(Boolean).join("\n") : "";
  const ask = recruiter
    ? `I'd love to be considered for ${target}. Could you let me know if my background fits your team's needs?`
    : `I'm interested in ${target}. If you think my background is a fit, would you be comfortable referring me or pointing me to the right team?`;
  if (tone === "short") {
    const brief = highlight.text.split(/(?<=\.) /)[0];
    return `${greeting}\n\nI'm Atharva Mhatre, a Backend Software Engineer at Media.net. ${brief}\n\n${ask}${details ? `\n\n${details}` : ""}\n\n${resume}\n\nThanks,\nAtharva`;
  }
  return `${greeting}\n\n${intro}\n\n${highlight.text}\n\nI'm also an ICPC Regionalist (2023), with 1000+ DSA problems solved and a 1870+ LeetCode contest rating.\n\n${ask}${details ? `\n\n${details}` : ""}\n\n${resume}${generic ? `\nGitHub: ${GITHUB_URL}\nLeetCode: ${LEETCODE_URL}` : ""}\n\nThank you for your time.\n\nBest regards,\nAtharva Mhatre\n${EMAIL}\n${PHONE}`;
}

export function generateConnectionNote({ company = "", position = "", contactName = "", limit = 200 } = {}) {
  const max = limit === 300 ? 300 : 200;
  const greeting = contactName.trim() ? `Hi ${contactName.trim()}!` : "Hi!";
  const target = position.trim() ? `${position.trim()} at ${company.trim()}` : `backend opportunities at ${company.trim()}`;
  const variants = [
    `${greeting} I'm Atharva, Backend Software Engineer at Media.net (Go, gRPC, Redis). Interested in ${target}. Would love to connect!`,
    `${greeting} I'm Atharva, backend engineer at Media.net. Interested in ${target}. Let's connect!`,
    `${greeting} I'm Atharva, a backend engineer at Media.net. I'd love to connect about opportunities at ${company.trim()}!`,
    "Hi! I'm Atharva, a backend engineer at Media.net working with Go, gRPC, Kafka, and Redis. I'd love to connect!",
  ];
  return variants.find(note => note.length <= max);
}
export function connectionNoteMeta(note, limit = 200) {
  return { length: note.length, limit, over: note.length > limit };
}
