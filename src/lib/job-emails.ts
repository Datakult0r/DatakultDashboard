/**
 * Recommended-jobs email parser.
 *
 * LinkedIn (and other job boards) email Philippe "jobs recommended for you" /
 * "your job alert" digests — a high-signal source he values. This extracts the
 * individual job postings from those emails and shapes them into the shared
 * ApifyJobResult contract so they flow through the SAME scoring rubric as every
 * other discovered job (a recommendation is a discovery signal, NOT a bypass of
 * scoring). The apply lane then resolves the company's own site.
 *
 * Defensive by construction: any parse failure on one email is swallowed and the
 * rest of the pipeline is unaffected. v1 targets LinkedIn's stable plain-text
 * layout (Title / Company · Location / … View job → linkedin.com/jobs/view/<id>).
 */

import type { ApifyJobResult } from './apify';

export interface EmailLike {
  from?: string;
  subject?: string;
  snippet?: string;
  body?: string;
  account?: string;
}

const LINKEDIN_JOB_SENDERS =
  /(jobs-noreply|jobalerts-noreply|jobs-listings|jobpostings|jobalerts|jobs-recommendation)@linkedin\.com/i;

/** Is this email a job-recommendation / job-alert digest worth parsing? */
function isJobEmail(e: EmailLike): boolean {
  const from = (e.from || '').toLowerCase();
  const subj = (e.subject || '').toLowerCase();
  if (LINKEDIN_JOB_SENDERS.test(from)) return true;
  if (from.includes('linkedin.com') && /(job|hiring|recommend|opportun|alert|is hiring|new role)/i.test(subj)) return true;
  // Other job boards that send recommendation digests
  if (/(indeed\.com|glassdoor\.com|welcometothejungle|otta\.com|hidden|wellfound|angel\.co)/i.test(from)
      && /(job|hiring|recommend|alert|match|role)/i.test(subj)) return true;
  return false;
}

function clean(s: string): string {
  return s.replace(/[͏​-‏­]/g, '').replace(/\s+/g, ' ').trim();
}

// Lines that are clearly NOT a job title (LinkedIn email chrome).
const NOISE = /^(view job|see all|view all|apply|unsubscribe|see more|easy apply|actively recruiting|\d+ (new )?jobs?|you have|based on|jobs? (for|you)|your job|promoted|new)/i;

/** Best-effort: from the lines preceding a job URL, infer {title, company, location}. */
function inferFromContext(linesBefore: string[]): { title: string; company: string; location: string } {
  const cand = linesBefore.map(clean).filter((l) => l && l.length > 1 && !NOISE.test(l));
  // LinkedIn layout is typically:  Title / "Company · Location" (or Company then Location)
  let title = '';
  let company = '';
  let location = '';
  for (let i = cand.length - 1; i >= 0 && (!title || !company); i--) {
    const l = cand[i];
    if (/·| at | — |•/.test(l) && !company) {
      const parts = l.split(/·|•| — /).map(clean).filter(Boolean);
      company = parts[0] || '';
      location = parts[1] || '';
    } else if (!title) {
      title = l;
    }
  }
  if (!title) title = cand[cand.length - 1] || '';
  if (!company) company = cand[cand.length - 2] || '';
  return { title: title.slice(0, 160), company: (company || 'See posting').slice(0, 120), location: (location || 'See posting').slice(0, 80) };
}

export function extractJobsFromEmails(emails: EmailLike[]): { items: ApifyJobResult[]; emailsScanned: number } {
  const items: ApifyJobResult[] = [];
  const seenIds = new Set<string>();
  let emailsScanned = 0;

  for (const e of emails || []) {
    try {
      if (!isJobEmail(e)) continue;
      emailsScanned++;
      const text = `${e.body || ''}\n${e.snippet || ''}`;
      const urlRe = /https?:\/\/[^\s"'<>]*linkedin\.com\/(?:comm\/)?jobs\/view\/(\d+)[^\s"'<>]*/gi;
      let m: RegExpExecArray | null;
      while ((m = urlRe.exec(text)) !== null) {
        const id = m[1];
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        const before = text.slice(Math.max(0, m.index - 400), m.index).split(/\n+/);
        const { title, company, location } = inferFromContext(before);
        items.push({
          title: title || `LinkedIn recommended role (${e.subject || ''})`.slice(0, 160),
          company,
          location,
          jobUrl: `https://www.linkedin.com/jobs/view/${id}/`,
          applyUrl: `https://www.linkedin.com/jobs/view/${id}/`,
          description: clean(e.snippet || e.subject || '').slice(0, 600),
          postedAt: '',
          salary: null,
          jobType: null,
          easyApply: false,
          source: 'linkedin',
        });
        if (items.length >= 30) break;
      }
      if (items.length >= 30) break;
    } catch {
      // never let one bad email break discovery
    }
  }
  return { items, emailsScanned };
}
