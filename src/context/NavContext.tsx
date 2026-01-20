'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { Business, Team, MemberWithRole } from '@/types';

interface NavContextType {
  businessId: string | null;
  teamId: string | null;
  business: Business | null;
  team: Team | null;
  member: MemberWithRole | null;
  setBusinessId: (id: string | null) => void;
  setTeamId: (id: string | null) => void;
  setBusiness: (business: Business | null) => void;
  setTeam: (team: Team | null) => void;
  setMember: (member: MemberWithRole | null) => void;
  clear: () => void;
}

const NavContext = createContext<NavContextType | undefined>(undefined);

export function NavProvider({ children }: { children: ReactNode }) {
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [teamId, setTeamId] = useState<string | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [member, setMember] = useState<MemberWithRole | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const storedBusinessId = localStorage.getItem('taskpulse_business_id');
    const storedTeamId = localStorage.getItem('taskpulse_team_id');
    const storedBusiness = localStorage.getItem('taskpulse_business');
    const storedTeam = localStorage.getItem('taskpulse_team');
    const storedMember = localStorage.getItem('taskpulse_member');

    if (storedBusinessId) setBusinessId(storedBusinessId);
    if (storedTeamId) setTeamId(storedTeamId);
    if (storedBusiness) setBusiness(JSON.parse(storedBusiness));
    if (storedTeam) setTeam(JSON.parse(storedTeam));
    if (storedMember) setMember(JSON.parse(storedMember));
  }, []);

  // Persist to localStorage
  useEffect(() => {
    if (businessId) {
      localStorage.setItem('taskpulse_business_id', businessId);
    } else {
      localStorage.removeItem('taskpulse_business_id');
    }
  }, [businessId]);

  useEffect(() => {
    if (teamId) {
      localStorage.setItem('taskpulse_team_id', teamId);
    } else {
      localStorage.removeItem('taskpulse_team_id');
    }
  }, [teamId]);

  useEffect(() => {
    if (business) {
      localStorage.setItem('taskpulse_business', JSON.stringify(business));
    } else {
      localStorage.removeItem('taskpulse_business');
    }
  }, [business]);

  useEffect(() => {
    if (team) {
      localStorage.setItem('taskpulse_team', JSON.stringify(team));
    } else {
      localStorage.removeItem('taskpulse_team');
    }
  }, [team]);

  useEffect(() => {
    if (member) {
      localStorage.setItem('taskpulse_member', JSON.stringify(member));
    } else {
      localStorage.removeItem('taskpulse_member');
    }
  }, [member]);

  const clear = () => {
    setBusinessId(null);
    setTeamId(null);
    setBusiness(null);
    setTeam(null);
    setMember(null);
    localStorage.removeItem('taskpulse_business_id');
    localStorage.removeItem('taskpulse_team_id');
    localStorage.removeItem('taskpulse_business');
    localStorage.removeItem('taskpulse_team');
    localStorage.removeItem('taskpulse_member');
  };

  return (
    <NavContext.Provider
      value={{
        businessId,
        teamId,
        business,
        team,
        member,
        setBusinessId,
        setTeamId,
        setBusiness,
        setTeam,
        setMember,
        clear,
      }}
    >
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  const context = useContext(NavContext);
  if (context === undefined) {
    throw new Error('useNav must be used within a NavProvider');
  }
  return context;
}
