/**
 * CV Tailoring Engine — generates customized CV bullet points and focus areas
 * using Claude API based on job description + Philippe's background.
 *
 * Writes tailored_cv_notes to the triage item. Does NOT generate PDFs
 * (that would require a PDF library and storage — future enhancement).
 */

interface TailoredCVResult {
  notes: string;
  focusAreas: string[];
  highlightedSkills: string[];
  suggestedTitle: string;
}

interface CVTailoringResult {
  results: Array<{ jobId: string; tailoring: TailoredCVResult }>;
  durationMs: number;
  error: string | null;
}

const CV_TAILORING_PROMPT = `You are Philippe Küng's CV tailoring engine. Given a job description and his background, produce a tailored CV focus for this specific role.

## Philippe's Background

**Current:** Founder & CEO, Clinic of AI (AI agency, Lisbon) — 2 years
- Multi-agent financial swarms (AutoGen/LangChain), autonomous agents, sub-3s RAG retrieval
- Built AI products across industries: legal, fintech, education, healthcare
- Strong presentation skills, AI polymath, generative AI specialist

**Previous:** Head of Data & AI, Crayon AG (Microsoft vendor, Zurich) — 2+ years
- Azure Synapse, Databricks, Power BI, RAG with fine-tuned LLMs
- ~60% reduced reporting time across enterprise clients
- Deep insight into enterprise AI workflows and value chains

**Previous:** Co-founder, Chainwork/Code Venture — bootstrapped to €1M
- 30+ startup tech stacks, full-stack development
- PoC to production pipeline, rapid prototyping

**Education:** International Business, Economics background
**Languages:** English (fluent), German (fluent), Portuguese (fluent), French (basic)
**Location:** Lisbon, Portugal (open to remote/hybrid globally)
**Tech:** Python, TypeScript, React, Next.js, Azure, AWS, LangChain, CrewAI, n8n, AutoGen, RAG, fine-tuning, agentic AI, multi-agent systems

## Output Format
Return a JSON object with:
- "suggestedTitle": What title to emphasize on the CV header (string)
- "focusAreas": Top 3 areas to emphasize (string array)
- "highlightedSkills": Skills from the JD that Philippe has (string array, max 8)
- "notes": Tailored bullet points to add/modify, written in first person, action-verb format. 5-7 bullets maximum. Each bullet should connect Philippe's experience to something specific in the JD. (string, newline-separated)

Be creative. Don't just match keywords — find angles where Philippe's unique background (AI polymath, agency founder, enterprise Microsoft vendor experience, bootstrapped startup) creates a compelling narrative for THIS specific role.

Return ONLY the JSON object, no markdown fences.`;

/**
 * Generate tailored CV notes for a batch of jobs.
 */
export async function tailorCVForJobs(
  jobs: Array<{ id: string; title: string; company: string; description: string; score: number }>
): Promise<CVTailoringResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY');
  }

  if (jobs.length === 0) {
    return { results: [], durationMs: 0, error: null };
  }

  const startTime = Date.now();
  const results: Array<{ jobId: string; tailoring: TailoredCVResult }> = [];
  const errors: string[] = [];

  // Process one at a time to get high quality tailoring per role
  for (const job of jobs.slice(0, 5)) { // Max 5 per run to manage costs
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
          max_tokens: 2048,
          messages: [
            {
              role: 'user',
              content: `${CV_TAILORING_PROMPT}\n\n## Job to tailor for:\n\nTitle: ${job.title}\nCompany: ${job.company}\nScore: ${job.score}/100\n\nDescription:\n${job.description.slice(0, 2000)}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        errors.push(`CV tailoring for ${job.company}: ${error.slice(0, 200)}`);
        continue;
      }

      const data = await response.json();
      const content = data.content?.[0]?.text || '{}';
      const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

      const parsed = JSON.parse(cleaned) as Record<string, unknown>;

      results.push({
        jobId: job.id,
        tailoring: {
          suggestedTitle: String(parsed.suggestedTitle || job.title),
          focusAreas: Array.isArray(parsed.focusAreas) ? parsed.focusAreas.map(String) : [],
          highlightedSkills: Array.isArray(parsed.highlightedSkills) ? parsed.highlightedSkills.map(String) : [],
          notes: String(parsed.notes || ''),
        },
      });
    } catch (err) {
      errors.push(`CV tailoring for ${job.company}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    results,
    durationMs: Date.now() - startTime,
    error: errors.length > 0 ? errors.join('; ') : null,
  };
}

export type { TailoredCVResult, CVTailoringResult };
