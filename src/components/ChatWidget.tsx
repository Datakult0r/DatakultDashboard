'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { MessageSquare, Send, X, Loader2, Sparkles, ChevronUp } from 'lucide-react';
import type { TriageItem, JobApplication, TriageStat } from '@/types/triage';

interface ChatMessage {
  /** Unique message ID */
  id: string;
  /** Who sent it */
  role: 'user' | 'assistant';
  /** Message content */
  content: string;
  /** When it was sent */
  timestamp: Date;
}

interface ChatWidgetProps {
  /** Current triage items for context */
  items: TriageItem[];
  /** Current job applications for context */
  applications: JobApplication[];
  /** Current stats */
  stats: TriageStat | null;
}

/** Quick-action suggestion chips */
const SUGGESTIONS = [
  'What needs my attention right now?',
  'Summarize today\'s pipeline',
  'Which jobs should I prioritize?',
  'Any overdue follow-ups?',
  'How\'s my application conversion rate?',
];

/**
 * Collapsible chat widget for natural language dashboard queries.
 * Fixed to bottom-right, expands into a chat panel.
 */
export default function ChatWidget({ items, applications, stats }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Build context string from dashboard data
  const buildContext = useCallback(() => {
    const lines: string[] = [];

    // Stats summary
    if (stats) {
      lines.push(`Today's stats: ${stats.total_count} total items, ${stats.urgent_count} urgent, ${stats.job_count} jobs, ${stats.done_count} done, ${stats.in_progress_count} in progress.`);
    }

    // Pending approvals
    const pending = items.filter((i) => i.action_status === 'pending_review');
    if (pending.length > 0) {
      lines.push(`\nPending approvals (${pending.length}):`);
      pending.slice(0, 10).forEach((i) => {
        lines.push(`- [${i.category}] ${i.title} (priority: ${i.priority || 'N/A'}, action: ${i.action_type || 'none'})`);
      });
    }

    // Urgent items
    const urgent = items.filter((i) => i.category === 'urgent' && i.status !== 'skipped');
    if (urgent.length > 0) {
      lines.push(`\nUrgent items (${urgent.length}):`);
      urgent.slice(0, 5).forEach((i) => {
        lines.push(`- ${i.title} (priority: ${i.priority || 'N/A'})`);
      });
    }

    // Top jobs
    const jobs = items
      .filter((i) => i.category === 'job')
      .sort((a, b) => (b.score || 0) - (a.score || 0));
    if (jobs.length > 0) {
      lines.push(`\nJob matches (${jobs.length} total, top 5):`);
      jobs.slice(0, 5).forEach((j) => {
        lines.push(`- ${j.company} — ${j.role_title} (score: ${j.score}, ${j.location || 'remote'}, ${j.salary_range || 'salary N/A'})`);
      });
    }

    // Application pipeline
    if (applications.length > 0) {
      const byStatus: Record<string, number> = {};
      applications.forEach((a) => {
        byStatus[a.status] = (byStatus[a.status] || 0) + 1;
      });
      lines.push(`\nApplication pipeline (${applications.length} total): ${Object.entries(byStatus).map(([s, c]) => `${s}: ${c}`).join(', ')}`);

      const active = applications.filter((a) => ['interview', 'screening'].includes(a.status));
      if (active.length > 0) {
        lines.push('Active pipeline:');
        active.forEach((a) => {
          lines.push(`- ${a.company} — ${a.role} (${a.status}, applied: ${a.applied_date})`);
        });
      }
    }

    // Schedule
    const schedule = items.filter((i) => i.category === 'schedule');
    if (schedule.length > 0) {
      lines.push(`\nToday's schedule (${schedule.length} events):`);
      schedule
        .sort((a, b) => new Date(a.event_time || 0).getTime() - new Date(b.event_time || 0).getTime())
        .slice(0, 8)
        .forEach((s) => {
          const time = s.event_time ? new Date(s.event_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '??';
          lines.push(`- ${time}: ${s.title}`);
        });
    }

    return lines.join('\n');
  }, [items, applications, stats]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text.trim(),
          context: buildContext(),
        }),
      });

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer || data.error || 'Something went wrong.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: 'assistant',
          content: 'Network error. Check your connection.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, buildContext]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      {/* Floating trigger button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full bg-accent text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 group"
          title="Ask the Control Tower"
        >
          <MessageSquare size={18} />
          <span className="text-sm font-medium hidden sm:inline">Ask</span>
          <Sparkles size={12} className="opacity-60 group-hover:opacity-100 transition-opacity" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div
          className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 w-full sm:w-[420px] sm:max-h-[560px] flex flex-col bg-surface border border-border/60 sm:rounded-xl shadow-2xl overflow-hidden animate-slide-up"
          style={{ height: 'min(560px, 80vh)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-elevated/50">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center">
                <Sparkles size={14} className="text-accent" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-primary leading-none">Control Tower</h3>
                <p className="text-[10px] text-secondary mt-0.5">Ask anything about your dashboard</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-md hover:bg-elevated text-secondary hover:text-primary transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages area */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-6">
                <Sparkles size={24} className="text-accent/40 mx-auto mb-3" />
                <p className="text-sm text-secondary mb-4">What do you want to know?</p>
                <div className="flex flex-wrap gap-1.5 justify-center">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-[11px] px-2.5 py-1.5 rounded-full bg-elevated border border-border/40 text-secondary hover:text-primary hover:border-accent/30 transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-accent text-white rounded-br-sm'
                      : 'bg-elevated text-primary border border-border/30 rounded-bl-sm'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <p className={`text-[9px] mt-1 ${msg.role === 'user' ? 'text-white/50' : 'text-secondary/50'}`}>
                    {msg.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-elevated border border-border/30 rounded-lg rounded-bl-sm px-3 py-2 flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin text-accent" />
                  <span className="text-xs text-secondary">Thinking...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <form onSubmit={handleSubmit} className="px-3 py-2.5 border-t border-border/40 bg-elevated/30">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your pipeline, jobs, emails..."
                className="flex-1 bg-surface border border-border/50 rounded-lg px-3 py-2 text-sm text-primary placeholder:text-secondary/40 focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="p-2 rounded-lg bg-accent text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
