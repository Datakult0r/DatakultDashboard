'use client';

import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/lib/supabase';

/**
 * Main client component with tabs, stats, realtime subscription
 */
export function DashboardShell() {
  const [activeTab, setActiveTab] = useState('triage');
  const [stats, setStats] = useState({ total: 0, urgent: 0, applied: 0 });

  useEffect(() => {
    // Subscribe to realtime updates
    const subscription = supabase
      .channel('dashboard_updates')
      .on('*', () => {
        // Refetch stats on any change
        fetchStats();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="triage">Triage</TabsTrigger>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="jobs">Jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="triage" className="space-y-4 mt-6">
          <div className="text-center py-8 text-base/60">
            <p className="text-sm">Triage items will appear here</p>
          </div>
        </TabsContent>

        <TabsContent value="applications" className="space-y-4 mt-6">
          <div className="text-center py-8 text-base/60">
            <p className="text-sm">Applications will appear here</p>
          </div>
        </TabsContent>

        <TabsContent value="jobs" className="space-y-4 mt-6">
          <div className="text-center py-8 text-base/60">
            <p className="text-sm">Job opportunities will appear here</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default DashboardShell;
