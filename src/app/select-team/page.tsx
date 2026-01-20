'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCurrentUser } from '@/lib/auth';
import { useNav } from '@/context/NavContext';
import type { Team } from '@/types';

export default function SelectTeamPage() {
  const router = useRouter();
  const { businessId, business, member, setTeamId, setTeam } = useNav();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      const user = await getCurrentUser();
      if (!user?.email) {
        router.push('/login');
        return;
      }

      if (!businessId || !member) {
        router.push('/select-business');
        return;
      }

      // Get teams the member belongs to within this business
      const { data: memberTeams, error: mtError } = await supabase
        .from('member_teams')
        .select('team_id')
        .eq('member_id', member.id);

      if (mtError) {
        setError('Failed to load team assignments.');
        setLoading(false);
        return;
      }

      const teamIds = memberTeams.map((mt) => mt.team_id);

      if (teamIds.length === 0) {
        setError('You are not assigned to any teams. Contact an administrator.');
        setLoading(false);
        return;
      }

      // Get team details
      const { data: teamsData, error: teamsError } = await supabase
        .from('teams')
        .select('*')
        .in('id', teamIds)
        .eq('business_id', businessId);

      if (teamsError) {
        setError('Failed to load teams.');
        setLoading(false);
        return;
      }

      if (teamsData.length === 1) {
        // Auto-select the only team
        setTeamId(teamsData[0].id);
        setTeam(teamsData[0]);
        router.push('/dashboard');
        return;
      }

      setTeams(teamsData);
      setLoading(false);
    }

    loadData();
  }, [router, businessId, member, setTeamId, setTeam]);

  const handleSelect = (team: Team) => {
    setTeamId(team.id);
    setTeam(team);
    router.push('/dashboard');
  };

  const handleBack = () => {
    router.push('/select-business');
  };

  if (loading) {
    return (
      <div className="glass-bg min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="glass-bg min-h-screen p-4">
      <div className="max-w-2xl mx-auto pt-12">
        <div className="glass-card rounded-xl p-8 animate-in">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={handleBack}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Select Team</h1>
              <p className="text-gray-500">{business?.name}</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {teams.map((team) => (
              <button
                key={team.id}
                onClick={() => handleSelect(team)}
                className="w-full p-4 text-left bg-gray-50 hover:bg-teal-50 rounded-lg border border-gray-200 hover:border-teal-300 transition-colors"
              >
                <div className="font-medium text-gray-900">{team.name}</div>
              </button>
            ))}
          </div>

          {teams.length === 0 && !error && (
            <div className="text-center py-8 text-gray-500">
              No teams found. Contact an administrator.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
