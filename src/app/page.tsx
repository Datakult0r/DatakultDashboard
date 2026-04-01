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
    // Fetch today's triage items
    const today = format(new Date(), 'yyyy-MM-dd');

    const { data: items, error: itemsError } = await supabase
      .from('triage_items')
      .select('*')
      .eq('triage_date', today)
      .order('created_at', { ascending: false });

    if (itemsError) {
      console.error('Error fetching triage items:', itemsError);
      return { items: [], stats: null };
    }

    // Fetch stats for today
    const { data: statsData, error: statsError } = await supabase
      .from('triage_stats')
      .select('*')
      .eq('triage_date', today)
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
