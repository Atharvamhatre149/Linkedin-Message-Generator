// Plain-text facts from the resume supplied by Atharva in November 2026.
export const RESUME_TEXT = `Atharva Mhatre
Phone: +91-9769875960 | Email: atharvamhatre1492@gmail.com

EXPERIENCE
Media.net — Backend Software Engineer | January 2025–Present | Mumbai, India
Stack: Go, JavaScript, gRPC, Kafka, Redis, Kubernetes, GCP, GenAI.
- Built and shipped features across a distributed Go-based AdTech platform handling 100M+ daily requests across 6+ microservices and 10+ ad providers, contributing to a 10–12% revenue increase through optimized ad delivery.
- Owned offline conversion tracking for Google and Bing across 3 repositories, streamlined partner onboarding, prevented conversion loss during audit delays, and migrated Google integration to the Data Manager API. Improved conversion feedback by 30%.
- Developed semantic retrieval using multilingual-e5 embeddings and Redis Vector Search, improving multilingual match coverage by 40%.
- Secured an internal affiliate management platform with backend-verified Google OAuth, signed session cookies, and multi-tenant RBAC with resource-level permissions and fail-closed authorization.
- Collaborated on an agentic AI coding harness using LangGraph, with sandboxed tool execution, automated validation, iterative AI reviews, and human-in-the-loop approvals.
- Extended a content-selection service with a parallel quiz pipeline, keyword image suggestions, multi-region Redis caching, and stage-level latency monitoring.
- Implemented threshold-based Redis rate limiting and requeueing, cutting refresh events by approximately 30% while maintaining reliable traffic splitting and revenue attribution.
- Integrated gRPC communication for internal services, replacing legacy HTTP interactions with shared connection management.
- Added shared caching logic with shorter TTLs for empty responses.

Flair Labs — Software Engineer | August 2024–December 2024 | Mumbai, India
Stack: Flutter, ReactJS, MongoDB, ExpressJS.
- Built an offline-capable tablet application for recording patient medical data in rural areas, integrating speech-to-text, OCR, Realm storage, and auto-sync.
- Built an offline-first ExpressJS/MongoDB synchronization pipeline, improving accessibility by 40%.
- Developed a ReactJS admin panel with coachmark onboarding and Matomo analytics, reducing manual effort by 50% and increasing actionable insights by 30%.

PROJECTS
EasyFill — Python, FastAPI, asyncio, Groq LLM, Docker
- Built an LLM-based form-filling backend, reducing application time by 75% with 90% mapping accuracy through parallel resume extraction using pdfplumber, LLMs, regex, and confidence-based merging.
- Built a concurrent job-aggregation pipeline across JobSpy, Jobicy, Remotive, and Greenhouse using asyncio and thread executors, with tiered TTL caching (15 min / 3 h).

SKILLS
Languages: C++, Go, JavaScript, Python.
Backend: NodeJS, ExpressJS, FastAPI, Kafka, gRPC, REST APIs, microservices.
Databases: MySQL, MongoDB, Redis.
System design: caching, queues, concurrency, rate limiting, distributed systems.
Cloud/DevOps: AWS, GCP, Kubernetes (GKE), Docker, Git, GitLab.
Observability: Grafana, ELK Stack.
GenAI: LLM integration, MCP servers, RAG, vector embeddings, prompt engineering, n8n.

ACHIEVEMENTS
ICPC Regionalist 2023; 1000+ DSA problems solved on LeetCode; contest rating 1870+; top rank under 1500 among 30,000+ participants. First prize, Xtreme OverFlow IEEE Bombay Coding Competition.

EDUCATION
B.E. Computer Engineering, University of Mumbai (Shah & Anchor Kutchhi Engineering College), July 2020–June 2024. CGPA: 9.3.`;
