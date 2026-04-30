/**
 * Content engine: generates thought leadership drafts from intelligence sources.
 * Takes scraped content (Nate Jones Substack, news, Executive Circle themes)
 * and produces LinkedIn-ready posts with diagram concepts.
 *
 * Philippe's angle: GenAI polymath, enterprise AI strategist,
 * virtual brain MMORPG visionary, Crayon/Microsoft experience.
 */

import type { ContentSource } from './firecrawl';

interface ContentDraft {
  title: string;
  body: string;
  hook: string;
  diagramConcept: string;
  sourceType: 'substack' | 'youtube' | 'whatsapp' | 'news' | 'original' | 'composite';
  sourceUrls: string[];
  sourceNames: string[];
  topicTags: string[];
  contentFormat: 'linkedin_post' | 'linkedin_article' | 'thread' | 'micro_paper' | 'diagram_only';
  relevanceScore: number;
  engagementPrediction: 'high' | 'medium' | 'low';
}

interface ContentGenerationResult {
  drafts: ContentDraft[];
  durationMs: number;
  error: string | null;
}

const CONTENT_PROMPT = `You are Philippe Küng's content strategist. Philippe is a GenAI polymath, former Head of Data & AI at Crayon AG (Microsoft vendor), founder of Clinic of AI, MIT-educated. He's building a vision of a gamified MMORPG virtual world for AI upskilling with on-chain verifiable skill brains.

Your job: take the source material below and produce 2 LinkedIn thought leadership post drafts. These should look like Philippe wrote them — authoritative, slightly academic, with original frameworks and diagrams.

## Philippe's Content Voice
- Authoritative but approachable — like a professor who also runs startups
- Uses frameworks and models (not just opinions)
- References real tools/tech he uses (AutoGen, LangChain, CrewAI, RAG, MCP)
- Occasionally references his virtual brain / MMORPG education vision
- German-Swiss precision meets Portuguese warmth
- Never generic LinkedIn motivational fluff

## Output Format
Return a JSON array of exactly 2 objects with these fields:
- title (string): The post's main concept/framework name
- hook (string): Opening line that stops the scroll — max 20 words, provocative or counterintuitive
- body (string): Full LinkedIn post, 150-300 words. Use line breaks. Include 1-2 specific technical references. End with a question or call to discussion.
- diagramConcept (string): 2-3 sentence description of an academic-looking SVG diagram that would accompany this post. Describe the visual structure (flowchart, matrix, cycle, layers), the key labels, and the insight it communicates.
- topicTags (string array): 3-5 tags like "agentic-ai", "mcp", "future-of-work"
- contentFormat (string): "linkedin_post" or "micro_paper"
- relevanceScore (number): 0-100, how timely and engaging this would be today
- engagementPrediction (string): "high", "medium", or "low"

Return ONLY the JSON array, no markdown fences.`;

/**
 * Generate content drafts from source material using Claude.
 */
export async function generateContentDrafts(
  sources: ContentSource[]
): Promise<ContentGenerationResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY');
  }

  if (sources.length === 0) {
    return { drafts: [], durationMs: 0, error: 'No content sources provided' };
  }

  const startTime = Date.now();

  // Format source material
  const sourceMaterial = sources.map((s, i) => (
    `[Source ${i + 1}] ${s.sourceName}\nTitle: ${s.title}\nURL: ${s.url}\n\n${s.body.slice(0, 2000)}`
  )).join('\n\n---\n\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 3000,
      messages: [
        {
          role: 'user',
          content: `${CONTENT_PROMPT}\n\n## Source Material:\n\n${sourceMaterial}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error for content generation: ${error.slice(0, 500)}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text || '[]';

  try {
    const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const raw = JSON.parse(cleaned) as Array<Record<string, unknown>>;

    const drafts: ContentDraft[] = raw.map((item) => ({
      title: String(item.title || ''),
      body: String(item.body || ''),
      hook: String(item.hook || ''),
      diagramConcept: String(item.diagramConcept || ''),
      sourceType: 'composite' as const,
      sourceUrls: sources.map((s) => s.url),
      sourceNames: sources.map((s) => s.sourceName),
      topicTags: Array.isArray(item.topicTags) ? item.topicTags.map(String) : [],
      contentFormat: (item.contentFormat === 'micro_paper' ? 'micro_paper' : 'linkedin_post') as ContentDraft['contentFormat'],
      relevanceScore: typeof item.relevanceScore === 'number' ? item.relevanceScore : 50,
      engagementPrediction: (['high', 'medium', 'low'].includes(String(item.engagementPrediction))
        ? String(item.engagementPrediction)
        : 'medium') as ContentDraft['engagementPrediction'],
    }));

    return {
      drafts,
      durationMs: Date.now() - startTime,
      error: null,
    };
  } catch (err) {
    console.error('Failed to parse content generation response:', content);
    return {
      drafts: [],
      durationMs: Date.now() - startTime,
      error: `JSON parse error: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export type { ContentDraft, ContentGenerationResult };
