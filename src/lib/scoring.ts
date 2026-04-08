/**
 * Claude API integration for scoring and drafting triage items.
 * Scores emails and messages using Philippe's rubric, drafts replies.
 */

import type { GmailMessage } from './gmail';

interface ScoredEmail {
  messageId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  score: number;
  scoreLabel: 'strong' | 'apply' | 'light' | 'skip' | 'priority';
  category: 'urgent' | 'review' | 'job' | 'news' | 'schedule' | 'done';
  priority: number;
  draftReply: string | null;
  tags: string[];
  contactName: string;
  isPipeline: boolean;
}

const SCORING_PROMPT = `You are Philippe Küng's assistant CEO. Score and categorize these emails using his rubric.

## Priority Scoring (1-10)
- 9-10: Money on the table (contract offer, interview, ready client) → reply within 1 hour
- 7-8: High-value opportunity (warm lead, recruiter with real role, Swiss contact) → same day
- 5-6: Worth engaging (unclear intent, interesting contact) → within 48 hours
- 3-4: Low priority (vendor, generic networking) → batch weekly
- 1-2: Noise (cold vendor, MBA spam, Indian IT body shop) → archive

## Known overrides:
- Shivm Patel/FDE Conference → 8+
- Luke Weiß/Patrick McGibney (ITBG) → 7+
- "I want to hire you" → 8+ IMMEDIATE
- ICEYE / Frederik Schlobach → 10 (active pipeline)
- Rockstar Recruiting / Marko Pavicevic → 9 (active pipeline)
- Anthony Evans / Balio Software → 9 (active pipeline)
- Nathan Wills / DeepRec → 8 (active pipeline)
- Swiss Innovation Challenge / Stefan Philippi → 10 (deadline Apr 13)
- Job seekers wanting free work → 5

## Job Scoring (0-100)
+20 fully remote/hybrid, +15 GenAI/LLMs focus, +10 contract, +10 AI strategy/architecture, +10 workflow automation, +8 EdTech/Web3, +7 EU timezone, +5 startup, +5 Azure/Microsoft, +5 agentic AI, +5 Python/JS
Thresholds: >=65 strong, 50-64 apply, 40-49 light, <40 skip

## Voice for drafts
- Warm but efficient, confident without arrogance
- Always include a next step (booking link: https://cal.read.ai/philippe-datakult/30-min)
- Sign off: "Philippe" (casual) or "Philippe Küng" (formal)

For each email, return a JSON array of objects with these fields:
- messageId (string)
- score (number 1-100)
- scoreLabel ("strong" | "apply" | "light" | "skip" | "priority")
- category ("urgent" | "review" | "job" | "news" | "schedule" | "done")
- priority (number 1-10)
- draftReply (string or null — draft a reply for anything priority >= 5)
- tags (string array)
- contactName (extracted sender name)
- isPipeline (boolean — is this a known pipeline contact?)

Return ONLY the JSON array, no markdown fences.`;

/**
 * Score a batch of emails using Claude API
 */
export async function scoreEmails(emails: GmailMessage[]): Promise<ScoredEmail[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('Missing ANTHROPIC_API_KEY');
  }

  if (emails.length === 0) return [];

  const emailSummaries = emails.map((e, i) => (
    `[${i}] ID: ${e.id}\nFrom: ${e.from}\nSubject: ${e.subject}\nDate: ${e.date}\nSnippet: ${e.snippet}\nBody preview: ${e.body.slice(0, 500)}`
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
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `${SCORING_PROMPT}\n\n## Emails to score:\n\n${emailSummaries}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${error}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text || '[]';

  try {
    // Strip markdown fences if present
    const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    const scored = JSON.parse(cleaned) as ScoredEmail[];

    // Map back messageIds from original emails
    return scored.map((item, i) => ({
      ...item,
      messageId: emails[i]?.id || item.messageId,
      from: emails[i]?.from || item.from || '',
      subject: emails[i]?.subject || item.subject || '',
      snippet: emails[i]?.snippet || item.snippet || '',
      date: emails[i]?.date || item.date || '',
    }));
  } catch {
    console.error('Failed to parse Claude response:', content);
    return [];
  }
}

export type { ScoredEmail };
