/**
 * Job scoring and cover letter generation using Claude API.
 * Applies Philippe's 0-100 rubric to discovered jobs.
 * Generates tailored 150-word cover letters for high-scoring roles (>=65).
 */

import type { ApifyJobResult } from './apify';

interface ScoredJob {
  /** Original job data */
  job: ApifyJobResult;
  /** 0-100 rubric score */
  score: number;
  /** Score label based on thresholds */
  scoreLabel: 'strong' | 'apply' | 'light' | 'skip';
  /** Key scoring factors */
  scoreBreakdown: Record<string, number>;
  /** Generated cover letter (only for score >= 65) */
  coverLetter: string | null;
  /** Tags extracted from the job */
  tags: string[];
  /** Whether this was flagged as a hard disqualifier */
  disqualified: boolean;
  /** Disqualification reason if applicable */
  disqualifyReason: string | null;
}

interface JobScoringResult {
  scored: ScoredJob[];
  durationMs: number;
  error: string | null;
}

const JOB_SCORING_PROMPT = `You are Philippe Küng's job scoring engine. Score each job using his exact rubric.

## Hard Disqualifiers (score = 0)
- Full on-site (no remote/hybrid)
- Security clearance required
- Below €50K/yr or $55K/yr
- Language Philippe doesn't speak (he speaks: English, German, Portuguese, basic French)
- Junior/entry-level (he's senior/director level)

## Points (0-100)
+20 fully remote or hybrid
+15 GenAI / LLMs / large language models focus
+10 contract position
+10 AI strategy / architecture role
+10 workflow automation / n8n / LangChain / CrewAI / RAG
+8 EdTech / future of work / Web3
+7 EU / global timezone friendly
+5 startup / scale-up
+5 Azure / Microsoft / enterprise AI
+5 agentic AI / multi-agent / autonomous AI
+5 Python / JavaScript alongside AI

## Thresholds
- >=65: STRONG APPLY → generate a 150-word tailored cover letter
- 50-64: APPLY
- 40-49: LIGHT APPLY
- <40: SKIP

## Cover Letter Rules (for score >= 65 ONLY)
- Max 150 words
- Opening (2 sentences): Reference something SPECIFIC from the job description + connect to relevant experience
- Body (2-3 sentences): 1-2 real metrics + name specific tools from JD Philippe has used
- Closing (1 sentence): State availability (immediate, remote from Lisbon) + invite next step

Three Signature Stories to draw from:
1. Crayon AG: Head of Data & AI at Microsoft vendor, Azure Synapse/Databricks, RAG with fine-tuned LLMs, ~60% reduced reporting time
2. Clinic of AI: Multi-agent financial swarms (AutoGen/LangChain), autonomous agents, sub-3s RAG retrieval
3. Chainwork/Code Venture: Bootstrapped to €1M, 30+ startup tech stacks, PoC to production

## Output Format
For each job, return a JSON object:
- index (number): position in input array
- score (number 0-100)
- scoreLabel ("strong" | "apply" | "light" | "skip")
- scoreBreakdown (object: factor → points, e.g. {"remote": 20, "genai": 15})
- coverLetter (string or null — ONLY for score >= 65)
- tags (string array)
- disqualified (boolean)
- disqualifyReason (string or null)

Return ONLY a JSON array, no markdown fences.`;

/**
 * Score a batch of jobs using Claude API.
 * Batches in groups of 10 to stay within context limits.
 */
export async function scoreJobs(jobs: ApifyJobResult[]): Promise<JobScoringResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY');
  }

  if (jobs.length === 0) {
    return { scored: [], durationMs: 0, error: null };
  }

  const startTime = Date.now();
  const allScored: ScoredJob[] = [];
  const errors: string[] = [];
  const batchSize = 10;

  for (let i = 0; i < jobs.length; i += batchSize) {
    const batch = jobs.slice(i, i + batchSize);

    const jobSummaries = batch.map((job, idx) => (
      `[${i + idx}] Title: ${job.title}\nCompany: ${job.company}\nLocation: ${job.location}\nType: ${job.jobType || 'unknown'}\nSalary: ${job.salary || 'not listed'}\nEasy Apply: ${job.easyApply}\nURL: ${job.jobUrl}\nDescription: ${job.description.slice(0, 800)}`
    )).join('\n\n---\n\n');

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: `${JOB_SCORING_PROMPT}\n\n## Jobs to score:\n\n${jobSummaries}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        errors.push(`Claude scoring batch ${i}: ${error.slice(0, 300)}`);
        continue;
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || '[]';
      const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned) as Array<Record<string, unknown>>;

      for (const item of parsed) {
        const idx = typeof item.index === 'number' ? item.index : i;
        const job = jobs[idx] || batch[idx - i];
        if (!job) continue;

        const score = typeof item.score === 'number' ? item.score : 0;
        allScored.push({
          job,
          score,
          scoreLabel: score >= 65 ? 'strong' : score >= 50 ? 'apply' : score >= 40 ? 'light' : 'skip',
          scoreBreakdown: (item.scoreBreakdown as Record<string, number>) || {},
          coverLetter: typeof item.coverLetter === 'string' ? item.coverLetter : null,
          tags: Array.isArray(item.tags) ? item.tags.map(String) : [],
          disqualified: Boolean(item.disqualified),
          disqualifyReason: item.disqualifyReason ? String(item.disqualifyReason) : null,
        });
      }
    } catch (err) {
      errors.push(`Scoring batch ${i}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    scored: allScored,
    durationMs: Date.now() - startTime,
    error: errors.length > 0 ? errors.join('; ') : null,
  };
}

export type { ScoredJob, JobScoringResult };
