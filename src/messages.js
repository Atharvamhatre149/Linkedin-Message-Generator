export const RESUME_URL =
  "https://drive.google.com/file/d/1RYEX6EN371k2UcvasTVb8r5f5SxGxhMX/view";

const GITHUB_URL = "https://github.com/Atharvamhatre149";
const LEETCODE_URL = "https://leetcode.com/u/ATHARVA_MHATRE/";
const PHONE = "+91 97698 75960";
const EMAIL = "atharvamhatre149@gmail.com";

const LINKEDIN_NOTE_LIMIT = 300;

export const GENERIC_MSG_TYPES = ["generic-hr", "generic-employee"];

export function isGenericMessageType(msgType) {
  return GENERIC_MSG_TYPES.includes(msgType);
}

function genericGreeting(contactName) {
  return contactName?.trim() ? `Hi ${contactName.trim()},` : "Hi,";
}

function genericIntro() {
  return `I'm Atharva Mhatre, currently working as a Software Engineer at Media.net with 2+ years of experience building scalable backend and full-stack systems.

My work primarily involves Go, JavaScript, Kafka, Redis, MySQL, distributed systems, and GenAI-powered developer tooling. Recently, I engineered a high-scale bid management system processing 10M+ daily requests, built Kafka-based event-driven pipelines, and developed LLM-powered internal platforms to improve engineering productivity.`;
}

function genericCompanyInterest(company) {
  return `I was excited to learn about the engineering opportunities at ${company}, particularly given the team's focus on large-scale distributed systems, high-throughput platforms, reliability, and user-centric products serving millions of users. These challenges align closely with my experience and interests.

I also have a strong problem-solving background as an ICPC Regionalist, with 1000+ DSA problems solved and a 1870+ LeetCode rating.`;
}

function genericLinksBlock() {
  return `📄 Resume: ${RESUME_URL}

🔗 GitHub: ${GITHUB_URL}
🔗 LeetCode: ${LEETCODE_URL}`;
}

function generateGenericHr({ company, contactName }) {
  return `${genericGreeting(contactName)}

${genericIntro()}

${genericCompanyInterest(company)}

I'm very interested in opportunities at ${company} and would be grateful if you could consider my profile for any relevant Software Engineer / Backend Engineer openings that align with my experience.

${genericLinksBlock()}

Thank you for your time and consideration. I would appreciate any guidance regarding suitable opportunities.

Best regards,
Atharva Mhatre
${PHONE}
${EMAIL}`;
}

function generateGenericEmployee({ company, contactName }) {
  return `${genericGreeting(contactName)}

${genericIntro()}

${genericCompanyInterest(company)}

I'm very interested in opportunities at ${company} and would be grateful if you could refer me or point me toward any relevant Software Engineer / Backend Engineer openings that align with my experience.

${genericLinksBlock()}

Thank you for your time and consideration. I would appreciate any referral or introduction you can offer.

Best regards,
Atharva Mhatre
${PHONE}
${EMAIL}`;
}

function jobExtras({ jobLink, jobId }) {
  const jobIdPart = jobId ? ` (Job ID: ${jobId})` : "";
  const jobLinkPart = jobLink ? `\n\nJob posting: ${jobLink}` : "";
  return { jobIdPart, jobLinkPart };
}

function generateReferralStandard({ company, position, jobLink, jobId }) {
  const { jobIdPart, jobLinkPart } = jobExtras({ jobLink, jobId });
  return `Hi,

I'm Atharva Mhatre, currently working as a Web Application Developer 2 at Media.net with 2+ years of experience building scalable backend systems using Go, JavaScript, Kafka, Redis, and GenAI technologies.

I came across the ${position}${jobIdPart} role at ${company} and believe my experience developing systems handling 10M+ daily requests aligns well with the position. I'm also an ICPC Regionalist and have solved 1000+ DSA problems.${jobLinkPart}

Resume: ${RESUME_URL}

If you feel my profile is a good fit, I'd greatly appreciate a referral. Thank you for your time.

Best regards,
Atharva Mhatre`;
}

function generateRecruiterStandard({ company, position, jobLink, jobId }) {
  const { jobIdPart, jobLinkPart } = jobExtras({ jobLink, jobId });
  return `Hi,

I'm Atharva Mhatre, currently working as a Web Application Developer 2 at Media.net with 2+ years of experience building scalable backend systems using Go, JavaScript, Kafka, Redis, and GenAI technologies.

I came across the ${position}${jobIdPart} role at ${company} and believe my experience developing systems handling 10M+ daily requests aligns well with the position. I'm also an ICPC Regionalist and have solved 1000+ DSA problems.${jobLinkPart}

Resume: ${RESUME_URL}

I'd love to be considered for this role. Thank you for your time.

Best regards,
Atharva Mhatre`;
}

function generateReferralShort({ company, position }) {
  return `Hi, I'm Atharva Mhatre (Media.net, 2+ yrs, Go/JS/Kafka/Redis). Interested in the ${position} role at ${company} — systems at 10M+ daily requests, ICPC Regionalist, 1000+ DSA. Resume: ${RESUME_URL}. Would appreciate a referral if my profile fits. Thanks!`;
}

function generateRecruiterShort({ company, position }) {
  return `Hi, I'm Atharva Mhatre (Media.net, 2+ yrs, Go/JS/Kafka/Redis). Strong interest in ${position} at ${company} — 10M+ daily requests, ICPC Regionalist, 1000+ DSA. Resume: ${RESUME_URL}. Hope you'll consider my application. Thanks!`;
}

function generateFollowUp({ company, position, contactName, msgType }) {
  const greeting = contactName ? `Hi ${contactName},` : "Hi,";
  const ask =
    msgType === "recruiter"
      ? "I'm still very interested in the role and wanted to follow up on my application."
      : "I'm still very interested in the role and wanted to follow up on my referral request.";

  return `${greeting}

Following up on the ${position} role at ${company}. ${ask}

Resume: ${RESUME_URL}

Thank you for your time,
Atharva Mhatre`;
}

export function generateMessage({ msgType, tone, ...params }) {
  if (msgType === "generic-hr") return generateGenericHr(params);
  if (msgType === "generic-employee") return generateGenericEmployee(params);

  if (tone === "follow-up") {
    return generateFollowUp({ ...params, msgType });
  }
  if (tone === "short") {
    return msgType === "recruiter"
      ? generateRecruiterShort(params)
      : generateReferralShort(params);
  }
  return msgType === "recruiter"
    ? generateRecruiterStandard(params)
    : generateReferralStandard(params);
}

export function generateConnectionNote({ company, position }) {
  if (!position?.trim()) {
    const generic = `Hi! I'm Atharva, Software Engineer at Media.net (Go, Kafka, 10M+ req/day). Exploring opportunities at ${company}. ICPC Regionalist — would love to connect!`;
    if (generic.length <= LINKEDIN_NOTE_LIMIT) return generic;
    return generic.slice(0, LINKEDIN_NOTE_LIMIT - 1) + "…";
  }

  const base = `Hi! I'm Atharva, Web Application Developer 2 at Media.net (Go, Kafka, 10M+ req/day). Interested in ${position} at ${company}. ICPC Regionalist — would love to connect!`;
  if (base.length <= LINKEDIN_NOTE_LIMIT) return base;

  const shorter = `Hi! Atharva here — backend dev at Media.net (Go/Kafka). Interested in ${position} at ${company}. Would love to connect!`;
  if (shorter.length <= LINKEDIN_NOTE_LIMIT) return shorter;

  return shorter.slice(0, LINKEDIN_NOTE_LIMIT - 1) + "…";
}

export function connectionNoteMeta(note) {
  return { length: note.length, limit: LINKEDIN_NOTE_LIMIT, over: note.length > LINKEDIN_NOTE_LIMIT };
}

export const TONE_OPTIONS = [
  { id: "standard", label: "Standard" },
  { id: "short", label: "Short" },
  { id: "follow-up", label: "Follow-up" },
];
