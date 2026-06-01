# Feature roadmap

Ideas to make referral outreach and job applications easier.

## Implemented

| # | Feature | Description |
|---|---------|-------------|
| 1 | Message variants | Short / Standard / Follow-up tone chips for referral and recruiter messages |
| 2 | Follow-up message generator | Follow-up variant with its own template |
| 3 | Application tracker | Local table: company, role, date, referral asked, contact, status — stored in `localStorage` |
| 4 | Copy + open LinkedIn | One click: copy message and open the best LinkedIn people search URL |
| 5 | Connection-request note | ≤300 character note for LinkedIn connection requests |
| 6 | Save drafts per company | Auto-save and restore form fields per company name |

## Planned — high impact

| # | Feature | Description |
|---|---------|-------------|
| 7 | Smarter “Find people” | 2nd-degree connections, alumni, same past company URL presets |
| 8 | Referral vs apply checklist | Per-company checklist: find employee → connect → message → apply |
| 9 | Job link parser | Paste careers URL → auto-fill company, title, job ID |
| 10 | Add custom companies | UI to add company name + LinkedIn ID without editing JSON |

## Planned — applications

| # | Feature | Description |
|---|---------|-------------|
| 11 | Cover letter / email snippet | Same variables → short email for portal applications |
| 12 | Resume bullet tailor | Optional JD keywords → one tailored line in the message |
| 13 | Export for the day | Markdown/CSV of today’s outreach |

## Planned — quality of life

| # | Feature | Description |
|---|---------|-------------|
| 14 | Template editor in UI | Edit intro, closing, resume URL without redeploying |
| 15 | History of generated messages | Last 20 messages with re-copy |
| 16 | Duplicate detection | Warn if same company was messaged recently |
| 17 | PWA / mobile-friendly | Install as app on phone |
| 18 | Keyboard shortcuts | Ctrl+Enter generate, Ctrl+C copy |

## Planned — larger scope

| # | Feature | Description |
|---|---------|-------------|
| 19 | Browser extension | Sidebar on LinkedIn job/profile pages |
| 20 | Notion/Airtable sync | Push tracker rows to external DB |
| 21 | AI JD → custom paragraph | Paste job description → one tailored sentence |

## Suggested build order (remaining)

1. Job URL parser  
2. Connection note polish + checklist  
3. Template editor in UI  
4. Browser extension (if you want the biggest UX win)
