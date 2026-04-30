/**
 * Perplexity API integration for AI/tech news intelligence.
 * Replaces Firecrawl for news scraping — more structured, higher quality.
 * Firecrawl remains for career page extraction only.
 *
 * Uses the Perplexity sonar-pro model for high-fidelity results with citations.
 */

export interface PerplexityNewsItem {
  title: string;
  summary: string;
  url: string;
  imageUrl: string | null;
  sourceName: string;
  category: 'ai_news' | 'event' | 'competition' | 'thought_leadership' | 'market_trend';
}

interface PerplexityResponse {
  id: string;
  model: string;
  choices: Array<{
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  citations?: string[];
}

interface PerplexityNewsResult {
  news: PerplexityNewsItem[];
  durationMs: number;
  error: string | null;
}

const NEWS_QUERIES = [
  {
    query: 'What are the most important AI and generative AI news stories from the last 24 hours? Focus on: new model releases, major company announcements, funding rounds, open source releases, agentic AI developments, and regulatory changes.',
    category: 'ai_news' as const,
  },
  {
    query: 'What AI events, hackathons, and competitions are happening in Europe in the next 30 days? Include virtual events. Focus on generative AI, LLMs, agentic AI, and EdTech.',
    category: 'event' as const,
  },
  {
    query: 'What are the latest thought leadership pieces and strategic analyses about the future of AI in enterprise, workforce transformation, and AI-driven education? Focus on the last 48 hours.',
    category: 'thought_leadership' as const,
  },
];

/**
 * Call Perplexity API with a structured news query.
 * Returns parsed news items with citations.
 */
async function queryPerplexity(
  apiKey: string,
  query: string,
  category: PerplexityNewsItem['category']
): Promise<PerplexityNewsItem[]> {
  const systemPrompt = `You are a news intelligence engine for an AI professional. Return ONLY a JSON array of news items. Each item must have:
- "title": headline (string, max 120 chars)
- "summary": 2-3 sentence summary (string, max 300 chars)
- "url": source URL (string)
- "imageUrl": URL to a relevant image if available, otherwise null
- "sourceName": name of the publication/source (string)

Return 5-10 items maximum, sorted by importance. Return ONLY the JSON array, no markdown fences, no explanation.`;

  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'sonar-pro',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
      max_tokens: 4096,
      temperature: 0.1,
      return_citations: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Perplexity API error: ${response.status} ${error.slice(0, 300)}`);
  }

  const data = (await response.json()) as PerplexityResponse;
  const content = data.choices?.[0]?.message?.content || '[]';
  const citations = data.citations || [];

  // Parse the JSON response
  const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();

  let items: Array<Record<string, unknown>>;
  try {
    items = JSON.parse(cleaned);
  } catch {
    // If JSON parsing fails, try to extract items from the text
    console.error('Failed to parse Perplexity response as JSON, attempting extraction');
    return [];
  }

  if (!Array.isArray(items)) return [];

  return items.slice(0, 10).map((item, idx) => ({
    title: String(item.title || '').slice(0, 120),
    summary: String(item.summary || '').slice(0, 300),
    url: String(item.url || citations[idx] || ''),
    imageUrl: typeof item.imageUrl === 'string' && item.imageUrl.startsWith('http')
      ? item.imageUrl
      : null,
    sourceName: String(item.sourceName || 'Perplexity'),
    category,
  }));
}

/**
 * Main export: Fetch AI/tech news from Perplexity.
 * Runs all queries in parallel for speed.
 */
export async function fetchPerplexityNews(): Promise<PerplexityNewsResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    return { news: [], durationMs: 0, error: 'PERPLEXITY_API_KEY not set' };
  }

  const startTime = Date.now();
  const allNews: PerplexityNewsItem[] = [];
  const errors: string[] = [];

  // Run queries in parallel
  const results = await Promise.allSettled(
    NEWS_QUERIES.map((q) => queryPerplexity(apiKey, q.query, q.category))
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      allNews.push(...result.value);
    } else {
      errors.push(result.reason?.message || 'Unknown Perplexity error');
    }
  }

  // Deduplicate by title similarity (remove near-duplicates)
  const seen = new Set<string>();
  const deduped = allNews.filter((item) => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return {
    news: deduped,
    durationMs: Date.now() - startTime,
    error: errors.length > 0 ? errors.join('; ') : null,
  };
}

export type { PerplexityNewsResult };
