'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getCurrentUser, getMemberWithRole } from '@/lib/auth';
import { useNav } from '@/context/NavContext';
import type { Business } from '@/types';

export default function SelectBusinessPage() {
  const router = useRouter();
  const { setBusinessId, setBusiness, setMember } = useNav();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadData() {
      const user = await getCurrentUser();
      if (!user?.email) {
        router.push('/login');
        return;
      }

      // Get member info
      const memberData = await getMemberWithRole(user.email);
      if (!memberData) {
        setError('Your account is not set up. Please contact an administrator.');
        setLoading(false);
        return;
      }

      setMember(memberData);

      // If user belongs to only one business, skip to team selection
      const { data: memberBusinesses, error: bizError } = await supabase
        .from('businesses')
        .select('*')
        .eq('id', memberData.business_id);

      if (bizError) {
        setError('Failed to load businesses.');
        setLoading(false);
        return;
      }

      if (memberBusinesses.length === 1) {
        // Auto-select the only business
        setBusinessId(memberBusinesses[0].id);
        setBusiness(memberBusinesses[0]);
        router.push('/select-team');
        return;
      }

      setBusinesses(memberBusinesses);
      setLoading(false);
    }

    loadData();
  }, [router, setBusinessId, setBusiness, setMember]);

  const handleSelect = (business: Business) => {
    setBusinessId(business.id);
    setBusiness(business);
    router.push('/select-team');
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
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Select Business</h1>
          <p className="text-gray-500 mb-6">Choose which business to work with</p>

          {error && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {businesses.map((business) => (
              <button
                key={business.id}
                onClick={() => handleSelect(business)}
                className="w-full p-4 text-left bg-gray-50 hover:bg-teal-50 rounded-lg border border-gray-200 hover:border-teal-300 transition-colors"
              >
                <div className="font-medium text-gray-900">{business.name}</div>
              </button>
            ))}
          </div>

          {businesses.length === 0 && !error && (
            <div className="text-center py-8 text-gray-500">
              No businesses found. Contact an administrator.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
