import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { TriageItem, TriageStat, JobApplication } from '@/types/triage';
import DashboardShell from '@/components/DashboardShell';

/**
 * Server component: Fetch triage data from Supabase
 */
export const revalidate = 0; // Disable ISR, fetch fresh data

async function fetchTriageData(): Promise<{
  items: TriageItem[];
  stats: TriageStat | null;
  applications: JobApplication[];
}> {
  try {
    // Fetch last 14 days of triage items (matches retention policy)
    const today = new Date();
    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
    const todayStr = format(today, 'yyyy-MM-dd');
    const cutoffStr = format(fourteenDaysAgo, 'yyyy-MM-dd');

    const { data: items, error: itemsError } = await supabase
      .from('triage_items')
      .select('*')
      .gte('triage_date', cutoffStr)
      .order('created_at', { ascending: false });

    if (itemsError) {
      console.error('Error fetching triage items:', itemsError);
      return { items: [], stats: null, applications: [] };
    }

    // Fetch stats for today
    const { data: statsData, error: statsError } = await supabase
      .from('triage_stats')
      .select('*')
      .eq('triage_date', todayStr)
      .single();

    if (statsError && statsError.code !== 'PGRST116') {
      // PGRST116 is "not found", which is ok
      console.error('Error fetching triage stats:', statsError);
    }

    // Fetch all job applications (no date filter — these persist)
    const { data: applications, error: appsError } = await supabase
      .from('job_applications')
      .select('*')
      .order('applied_date', { ascending: false });

    if (appsError) {
      console.error('Error fetching job applications:', appsError);
    }

    return {
      items: (items as TriageItem[]) ?? [],
      stats: (statsData as TriageStat) ?? null,
      applications: (applications as JobApplication[]) ?? [],
    };
  } catch (error) {
    console.error('Unexpected error fetching triage data:', error);
    return { items: [], stats: null, applications: [] };
  }
}

export default async function Home() {
  const { items, stats, applications } = await fetchTriageData();

  return (
    <DashboardShell
      initialItems={items}
      initialStats={stats}
      initialApplications={applications}
    />
  );
}
