import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';
import { DashboardShell } from '@/components/DashboardShell';

/**
 * Server component that fetches triage_items, triage_stats, and job_applications
 * Uses date-fns for formatting
 */
export default async function Home() {
  try {
    // Fetch triage items
    const { data: triageItems } = await supabase
      .from('triage_items')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    // Fetch stats (triage_stats is a VIEW)
    const { data: stats } = await supabase
      .from('triage_stats')
      .select('*')
      .single();

    // Fetch job applications
    const { data: applications } = await supabase
      .from('job_applications')
      .select('*')
      .order('applied_date', { ascending: false })
      .limit(50);

    return (
      <main className="min-h-screen bg-base">
        <div className="container mx-auto px-4 py-8">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-elevated mb-2">
              Triage Dashboard
            </h1>
            <p className="text-base/60">
              Real-time job application triage and approvals
            </p>
          </header>

          <DashboardShell />

          {/* Debug info - remove in production */}
          <div className="mt-12 text-xs text-base/40">
            <p>Triage items: {triageItems?.length || 0}</p>
            <p>Stats: {stats ? 'loaded' : 'pending'}</p>
            <p>Applications: {applications?.length || 0}</p>
          </div>
        </div>
      </main>
    );
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error);

    return (
      <main className="min-h-screen bg-base">
        <div className="container mx-auto px-4 py-8">
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-elevated mb-2">
              Triage Dashboard
            </h1>
            <p className="text-base/60">
              Real-time job application triage and approvals
            </p>
          </header>

          <div className="bg-danger/10 border border-danger/30 rounded-lg p-4 text-danger text-sm">
            <p className="font-medium">Error loading dashboard</p>
            <p className="text-xs mt-1">
              Unable to fetch data from Supabase. Please check your connection.
            </p>
          </div>
        </div>
      </main>
    );
  }
}
