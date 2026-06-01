export const RESUME_URL =
  "https://drive.google.com/file/d/1RYEX6EN371k2UcvasTVb8r5f5SxGxhMX/view";

const LINKEDIN_NOTE_LIMIT = 300;

function jobExtras({ jobLink, jobId }) {
  const jobIdPart = jobId ? ` (Job ID: ${jobId})` : "";
  const jobLinkPart = jobLink ? `\n\nJob posting: ${jobLink}` : "";
  return { jobIdPart, jobLinkPart };
}

function generateReferralStandard({ company, position, jobLink, jobId }) {
  const { jobIdPart, jobLinkPart } = jobExtras({ jobLink, jobId });
  return `Hi,

I'm Atharva Mhatre, currently working as a Web Application Developer 2 at Media.net with 1.5+ years of experience building scalable backend systems using Go, JavaScript, Kafka, Redis, and GenAI technologies.

I came across the ${position}${jobIdPart} role at ${company} and believe my experience developing systems handling 10M+ daily requests aligns well with the position. I'm also an ICPC Regionalist and have solved 1000+ DSA problems.${jobLinkPart}

Resume: ${RESUME_URL}

If you feel my profile is a good fit, I'd greatly appreciate a referral. Thank you for your time.

Best regards,
Atharva Mhatre`;
}

function generateRecruiterStandard({ company, position, jobLink, jobId }) {
  const { jobIdPart, jobLinkPart } = jobExtras({ jobLink, jobId });
  return `Hi,

I'm Atharva Mhatre, currently working as a Web Application Developer 2 at Media.net with 1.5+ years of experience building scalable backend systems using Go, JavaScript, Kafka, Redis, and GenAI technologies.

I came across the ${position}${jobIdPart} role at ${company} and believe my experience developing systems handling 10M+ daily requests aligns well with the position. I'm also an ICPC Regionalist and have solved 1000+ DSA problems.${jobLinkPart}

Resume: ${RESUME_URL}

I'd love to be considered for this role. Thank you for your time.

Best regards,
Atharva Mhatre`;
}

function generateReferralShort({ company, position }) {
  return `Hi, I'm Atharva Mhatre (Media.net, 1.5+ yrs, Go/JS/Kafka/Redis). Interested in the ${position} role at ${company} — systems at 10M+ daily requests, ICPC Regionalist, 1000+ DSA. Resume: ${RESUME_URL}. Would appreciate a referral if my profile fits. Thanks!`;
}

function generateRecruiterShort({ company, position }) {
  return `Hi, I'm Atharva Mhatre (Media.net, 1.5+ yrs, Go/JS/Kafka/Redis). Strong interest in ${position} at ${company} — 10M+ daily requests, ICPC Regionalist, 1000+ DSA. Resume: ${RESUME_URL}. Hope you'll consider my application. Thanks!`;
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
