import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/chat
 * Natural language dashboard assistant powered by Claude.
 * Receives the user's question + dashboard context (items, apps, stats).
 * Returns an intelligent summary/answer.
 */
export async function POST(request: NextRequest) {
  try {
    const { question, context } = await request.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'Missing question' }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { answer: 'Claude API key not configured. Add ANTHROPIC_API_KEY to environment variables.' },
        { status: 200 }
      );
    }

    const systemPrompt = `You are the Control Tower assistant for Philippe Kung, CEO of Clinic of AI.
You have access to his current dashboard data. Answer concisely and actionably.
Use numbers, names, and specifics from the data. Keep responses under 200 words.
If asked about trends or strategy, be direct and opinionated like a sharp COO would be.
Format: plain text, no markdown headers. Use bullet points sparingly.
Current date: ${new Date().toISOString().split('T')[0]}.`;

    const userMessage = `Dashboard context:
${context || 'No data available.'}

Question: ${question}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Claude API error:', err);
      return NextResponse.json(
        { answer: 'Failed to get response from Claude. Check API key and credits.' },
        { status: 200 }
      );
    }

    const data = await response.json();
    const answer = data.content?.[0]?.text || 'No response generated.';

    return NextResponse.json({ answer });
  } catch (err) {
    console.error('Chat API error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
