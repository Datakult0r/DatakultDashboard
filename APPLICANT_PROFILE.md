# Applicant Profile — Philippe Küng (single source of truth for apply-agents)

> This file is the canonical answer key for every job application the agents fill.
> The live applicant facts injected into Browser Use apply prompts live in
> `src/lib/browser-use.ts` (Easy Apply + Website Apply). Keep the two in sync.
> Last corrected: 2026-06-22 (fixed phone, nationality, location; added US-auth stop rule).

## Identity & contact
- Name: Philippe Küng  (First: Philippe · Last: Küng)
- Email: philippe.kung@clinicofai.com
- Phone: **+351 933 607 511** (Portuguese mobile — preferred contact number)
- Address: Kreuzstrasse 24, 8008 Zurich, Switzerland
- Current city: Zurich · Country: Switzerland
- LinkedIn: **https://www.linkedin.com/in/pkfde/** (canonical — use this everywhere; ignore the philippe-kueng variant printed on the CV)
- Website: https://www.clinicofai.com

## Work authorization (THE rule that matters)
- Dual **Swiss & Portuguese** citizen → fully authorized in EU + Switzerland, **no sponsorship**.
- **NOT** authorized for US/UK (would need sponsorship). US citizen: No. Security clearance: None.
- **STOP RULE:** if a required work-authorization field offers only US options
  (US Citizen / LPR / EAD / Visa Holder) with no "require sponsorship" choice, the role
  needs US authorization Philippe lacks → do not pick a false option → finish
  `needs_human: not_us_authorized`. Same for required US security clearance.
- Global mobility: willing to deploy on-site (EU, UAE/Dubai, US) 6+ months to embed with customers.

## Education
- École hôtelière de Lausanne (EHL) — BSc, 2013–2016
- MIT Schwarzman College of Computing — Data Science & ML, Data Engineering

## Certifications / Licenses
- MIT Schwarzman College of Computing (Data Science & ML)
- MindStudio — AI Developer Certification Program (2024)

## Experience & comp
- 8+ years software/data/AI leadership; 4+ years GenAI/LLMs in production.
- Salary: EUR 90–130k FTE / EUR 80–150/hr contract. Notice: immediate (~1 week). Timezone: CET (UTC+1), ±3h. Remote/hybrid, EU-based.

## Relevant skills (paste into "list relevant skills" fields)
Hybrid RAG (Weaviate, Pinecone, Cohere ReRank, BM25); LLM evaluation & observability
(LangSmith, Evidently, Relari), benchmark design, regression detection, LLM-as-judge;
multi-agent orchestration (AutoGen, LangChain, LangGraph); Python (expert), PyTorch,
TensorFlow; fine-tuning & alignment (LoRA, QLoRA, DPO, GRPO), 4-bit AWQ quantization, vLLM;
MLOps (Docker, Kubernetes, CI/CD for ML, Terraform, Azure/GCP/AWS, Red Hat OpenShift).

## CV
- Public URL served to agents: env `CV_PUBLIC_URL` (Google Drive direct-download link).
- Current file: `Philippe-Kung-CV-2026.pdf` (2 pages, machine-readable). To update without
  breaking the link: Google Drive → the CV file → Manage versions → Upload new version.
