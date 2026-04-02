import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';
import type { TriageItem, TriageStat } from '@/types/triage';
import DashboardShell from '@/components/DashboardShell';

/**
 * Server component: Fetch triage data from Supabase
 */
export const revalidate = 0; // Disable ISR, fetch fresh data

async function fetchTriageData() {
  try {
    // Fetch triage items from the last 14 days (items persist until resolved or expired)
    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const fourteenDaysAgo = format(
      new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000),
      'yyyy-MM-dd'
    );

    const { data: items, error: itemsError } = await supabase
      .from('triage_items')
      .select('*')
      .gte('triage_date', fourteenDaysAgo)
      .order('created_at', { ascending: false });

    if (itemsError) {
      console.error('Error fetching triage items:', itemsError);
      return { items: [], stats: null };
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

    return {
      items: (items as TriageItem[]) || [],
      stats: (statsData as TriageStat) || null,
    };
  } catch (error) {
    console.error('Unexpected error fetching triage data:', error);
    return { items: [], stats: null };
  }
}

export default async function Home() {
  const { items, stats } = await fetchTriageData();

  return (
    <DashboardShell
      initialItems={items}
      initialStats={stats}
    />
  );
}