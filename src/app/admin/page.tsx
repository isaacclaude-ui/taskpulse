'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { useNav } from '@/context/NavContext';
import type { Team, Member, PendingUser, Announcement, SharedLink } from '@/types';

type Tab = 'members' | 'teams' | 'pending' | 'emails' | 'content' | 'settings';

interface MemberWithTeams extends Member {
  teamIds: string[];
}

export default function AdminPage() {
  const router = useRouter();
  const { business, member } = useNav();

  const [activeTab, setActiveTab] = useState<Tab>('members');
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<MemberWithTeams[]>([]);
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showAddMember, setShowAddMember] = useState(false);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('user');
  const [newMemberTeams, setNewMemberTeams] = useState<string[]>([]);
  const [newTeamName, setNewTeamName] = useState('');

  // Pending user approval
  const [approvingUser, setApprovingUser] = useState<PendingUser | null>(null);
  const [approvalName, setApprovalName] = useState('');
  const [approvalTeams, setApprovalTeams] = useState<string[]>([]);

  // Settings
  const [businessName, setBusinessName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Team editing
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editingTeamName, setEditingTeamName] = useState('');

  // Email settings
  interface EmailMember {
    id: string;
    name: string;
    email: string;
    role: string;
    teams: { name: string }[];
    email_settings?: {
      frequency: string;
      last_sent_at: string | null;
    };
  }
  const [emailMembers, setEmailMembers] = useState<EmailMember[]>([]);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);

  // Content management (Announcements & Shared Links)
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [sharedLinks, setSharedLinks] = useState<SharedLink[]>([]);
  const [newAnnouncementText, setNewAnnouncementText] = useState('');
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const [editingAnnouncementText, setEditingAnnouncementText] = useState('');
  const [newLinkTitle, setNewLinkTitle] = useState('');
  const [newLinkDescription, setNewLinkDescription] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [selectedTeamForContent, setSelectedTeamForContent] = useState<string>('');

  useEffect(() => {
    async function checkAuth() {
      const user = await getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }
      if (!member || member.role !== 'admin') {
        router.push('/dashboard');
        return;
      }
      loadData();
    }
    checkAuth();
  }, [router, member]);

  const loadData = async () => {
    if (!business) return;

    setLoading(true);
    try {
      const [teamsRes, membersRes, pendingRes, emailRes] = await Promise.all([
        fetch(`/api/teams?businessId=${business.id}`),
        fetch(`/api/members?businessId=${business.id}&includeTeams=true`),
        fetch(`/api/admin/pending-users?businessId=${business.id}`),
        fetch(`/api/admin/email-settings?businessId=${business.id}`),
      ]);

      const [teamsData, membersData, pendingData, emailData] = await Promise.all([
        teamsRes.json(),
        membersRes.json(),
        pendingRes.json(),
        emailRes.json(),
      ]);

      setTeams(teamsData.teams || []);
      setMembers(membersData.members || []);
      setPendingUsers(pendingData.pendingUsers || []);
      setEmailMembers(emailData.members || []);
      setBusinessName(business?.name || '');

      // Fetch join code from business
      const bizRes = await fetch(`/api/businesses?id=${business.id}`);
      const bizData = await bizRes.json();
      if (bizData.business?.join_code) {
        setJoinCode(bizData.business.join_code);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
    setLoading(false);
  };

  const handleAddMember = async () => {
    if (!newMemberName || !business) return;

    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMemberName,
          email: newMemberEmail || null, // Optional
          role: newMemberRole,
          businessId: business.id,
          teamIds: newMemberTeams,
        }),
      });

      if (res.ok) {
        setNewMemberName('');
        setNewMemberEmail('');
        setNewMemberRole('user');
        setNewMemberTeams([]);
        setShowAddMember(false);
        loadData();
      }
    } catch (error) {
      console.error('Failed to add member:', error);
    }
  };

  const handleUpdateMemberTeams = async (memberId: string, teamIds: string[]) => {
    try {
      await fetch(`/api/members/${memberId}/teams`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamIds }),
      });
      loadData();
    } catch (error) {
      console.error('Failed to update teams:', error);
    }
  };

  const handleUpdateMemberRole = async (memberId: string, role: string) => {
    try {
      await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      loadData();
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Delete this member?')) return;

    try {
      await fetch(`/api/members/${memberId}`, {
        method: 'DELETE',
      });
      loadData();
    } catch (error) {
      console.error('Failed to delete member:', error);
    }
  };

  const handleAddTeam = async () => {
    if (!newTeamName || !business) return;

    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTeamName,
          businessId: business.id,
        }),
      });

      if (res.ok) {
        setNewTeamName('');
        setShowAddTeam(false);
        loadData();
      }
    } catch (error) {
      console.error('Failed to add team:', error);
    }
  };

  const handleUpdateTeam = async (teamId: string) => {
    if (!editingTeamName.trim()) return;

    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingTeamName.trim() }),
      });

      if (res.ok) {
        setEditingTeamId(null);
        setEditingTeamName('');
        loadData();
      }
    } catch (error) {
      console.error('Failed to update team:', error);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!confirm('Delete this team? This cannot be undone.')) return;

    try {
      const res = await fetch(`/api/teams/${teamId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        loadData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete team');
      }
    } catch (error) {
      console.error('Failed to delete team:', error);
    }
  };

  const handleApproveUser = async () => {
    if (!approvingUser || !approvalName) return;

    try {
      const res = await fetch('/api/admin/pending-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pendingUserId: approvingUser.id,
          action: 'approve',
          name: approvalName,
          role: 'user',
          teamIds: approvalTeams,
        }),
      });

      if (res.ok) {
        setApprovingUser(null);
        setApprovalName('');
        setApprovalTeams([]);
        loadData();
      }
    } catch (error) {
      console.error('Failed to approve user:', error);
    }
  };

  const handleRejectUser = async (pendingUser: PendingUser) => {
    try {
      await fetch('/api/admin/pending-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pendingUserId: pendingUser.id,
          action: 'reject',
        }),
      });
      loadData();
    } catch (error) {
      console.error('Failed to reject user:', error);
    }
  };

  const handleSaveBusinessName = async () => {
    if (!business || !businessName.trim()) return;

    setSavingSettings(true);
    try {
      const res = await fetch('/api/businesses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: business.id,
          name: businessName.trim(),
        }),
      });

      if (res.ok) {
        // Refresh the page to update the nav context
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to save business name:', error);
    }
    setSavingSettings(false);
  };

  const handleUpdateEmailFrequency = async (memberId: string, frequency: string) => {
    try {
      await fetch('/api/admin/email-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, frequency }),
      });

      // Update local state
      setEmailMembers(prev => prev.map(m =>
        m.id === memberId
          ? { ...m, email_settings: { ...m.email_settings, frequency, last_sent_at: m.email_settings?.last_sent_at || null } }
          : m
      ));
    } catch (error) {
      console.error('Failed to update email frequency:', error);
    }
  };

  const handleSendEmailNow = async (memberId: string) => {
    setSendingEmail(memberId);
    try {
      const res = await fetch('/api/send-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Email sent successfully!');
        loadData(); // Refresh to show updated last_sent_at
      } else {
        alert(data.error || 'Failed to send email');
      }
    } catch (error) {
      console.error('Failed to send email:', error);
      alert('Failed to send email');
    }
    setSendingEmail(null);
  };

  // Content management handlers
  const loadContent = async (teamId: string) => {
    if (!teamId) return;
    try {
      const [announcementsRes, linksRes] = await Promise.all([
        fetch(`/api/announcements?teamId=${teamId}`),
        fetch(`/api/shared-links?teamId=${teamId}`),
      ]);
      const [announcementsData, linksData] = await Promise.all([
        announcementsRes.json(),
        linksRes.json(),
      ]);
      setAnnouncements(announcementsData.announcements || []);
      setSharedLinks(linksData.links || []);
    } catch (error) {
      console.error('Failed to load content:', error);
    }
  };

  const handleAddAnnouncement = async () => {
    if (!selectedTeamForContent || !newAnnouncementText.trim() || !member) return;
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeamForContent,
          content: newAnnouncementText.trim(),
          memberId: member.id,
        }),
      });
      if (res.ok) {
        setNewAnnouncementText('');
        loadContent(selectedTeamForContent);
      }
    } catch (error) {
      console.error('Failed to add announcement:', error);
    }
  };

  const handleUpdateAnnouncement = async (id: string) => {
    if (!editingAnnouncementText.trim()) return;
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editingAnnouncementText.trim() }),
      });
      if (res.ok) {
        setEditingAnnouncementId(null);
        setEditingAnnouncementText('');
        loadContent(selectedTeamForContent);
      }
    } catch (error) {
      console.error('Failed to update announcement:', error);
    }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await fetch(`/api/announcements/${id}`, { method: 'DELETE' });
      loadContent(selectedTeamForContent);
    } catch (error) {
      console.error('Failed to delete announcement:', error);
    }
  };

  const handleAddSharedLink = async () => {
    if (!selectedTeamForContent || !newLinkTitle.trim() || !newLinkUrl.trim() || !member) return;
    try {
      const res = await fetch('/api/shared-links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeamForContent,
          title: newLinkTitle.trim(),
          description: newLinkDescription.trim() || null,
          url: newLinkUrl.trim(),
          memberId: member.id,
        }),
      });
      if (res.ok) {
        setNewLinkTitle('');
        setNewLinkDescription('');
        setNewLinkUrl('');
        loadContent(selectedTeamForContent);
      }
    } catch (error) {
      console.error('Failed to add shared link:', error);
    }
  };

  const handleDeleteSharedLink = async (id: string) => {
    if (!confirm('Delete this shared link?')) return;
    try {
      await fetch(`/api/shared-links/${id}`, { method: 'DELETE' });
      loadContent(selectedTeamForContent);
    } catch (error) {
      console.error('Failed to delete shared link:', error);
    }
  };

  return (
    <div className="glass-bg min-h-screen">
      {/* Header */}
      <header className="header-banner">
        <div className="header-banner-content px-4 py-6">
          <div className="max-w-5xl mx-auto flex items-center gap-4">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-white/80 hover:text-white"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Admin Panel</h1>
              <p className="text-teal-100 text-sm">{business?.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'pending'
                ? 'bg-teal-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            Pending
            {pendingUsers.length > 0 && (
              <span className="bg-amber-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                {pendingUsers.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'teams'
                ? 'bg-teal-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Teams
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'members'
                ? 'bg-teal-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            Members
          </button>
          <button
            onClick={() => setActiveTab('emails')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'emails'
                ? 'bg-teal-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Emails
          </button>
          <button
            onClick={() => {
              setActiveTab('content');
              if (teams.length > 0 && !selectedTeamForContent) {
                setSelectedTeamForContent(teams[0].id);
                loadContent(teams[0].id);
              }
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'content'
                ? 'bg-teal-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
            </svg>
            Content
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'bg-teal-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="spinner" />
          </div>
        ) : (
          <>
            {/* Members Tab */}
            {activeTab === 'members' && (
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Team Members</h2>
                    <p className="text-sm text-gray-500">Members with an email can log in. Others are for task assignment only.</p>
                  </div>
                  <button
                    onClick={() => setShowAddMember(true)}
                    className="btn-primary text-sm flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Member
                  </button>
                </div>

                {showAddMember && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-4 mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="text"
                        value={newMemberName}
                        onChange={(e) => setNewMemberName(e.target.value)}
                        placeholder="Name *"
                        className="input-field"
                      />
                      <input
                        type="email"
                        value={newMemberEmail}
                        onChange={(e) => setNewMemberEmail(e.target.value)}
                        placeholder="Login email (optional)"
                        className="input-field"
                      />
                      <select
                        value={newMemberRole}
                        onChange={(e) => setNewMemberRole(e.target.value)}
                        className="input-field"
                      >
                        <option value="user">Staff</option>
                        <option value="lead">Team Lead</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Teams</label>
                      <div className="flex flex-wrap gap-2">
                        {teams.map(t => (
                          <label key={t.id} className="flex items-center gap-1 text-sm bg-white px-2 py-1 rounded border">
                            <input
                              type="checkbox"
                              checked={newMemberTeams.includes(t.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setNewMemberTeams([...newMemberTeams, t.id]);
                                } else {
                                  setNewMemberTeams(newMemberTeams.filter(id => id !== t.id));
                                }
                              }}
                              className="rounded"
                            />
                            {t.name}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button onClick={handleAddMember} className="btn-primary text-sm" disabled={!newMemberName}>
                        Save
                      </button>
                      <button
                        onClick={() => setShowAddMember(false)}
                        className="btn-secondary text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Members table */}
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Name</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Team</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Login Email</th>
                        <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Role</th>
                        <th className="text-center py-3 px-2 text-sm font-medium text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {members.map((m) => (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="py-3 px-2">
                            <span className="font-medium text-gray-900">{m.name}</span>
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex flex-wrap gap-1">
                              {teams.map(t => {
                                const isInTeam = m.teamIds?.includes(t.id);
                                return (
                                  <button
                                    key={t.id}
                                    onClick={() => {
                                      const newTeamIds = isInTeam
                                        ? m.teamIds.filter((id: string) => id !== t.id)
                                        : [...(m.teamIds || []), t.id];
                                      handleUpdateMemberTeams(m.id, newTeamIds);
                                    }}
                                    className={`text-xs px-2 py-0.5 rounded transition-colors ${
                                      isInTeam
                                        ? 'bg-teal-100 text-teal-700 hover:bg-teal-200'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                                  >
                                    {t.name}
                                  </button>
                                );
                              })}
                              {(!m.teamIds || m.teamIds.length === 0) && (
                                <span className="text-xs text-gray-400 italic">No team</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            {m.email ? (
                              <span className="text-gray-600">{m.email}</span>
                            ) : (
                              <span className="text-gray-400 italic">No login</span>
                            )}
                          </td>
                          <td className="py-3 px-2">
                            <select
                              value={m.role}
                              onChange={(e) => handleUpdateMemberRole(m.id, e.target.value)}
                              className="text-sm border border-gray-200 rounded px-2 py-1 bg-white"
                            >
                              <option value="user">Staff</option>
                              <option value="lead">Team Lead</option>
                              <option value="admin">Admin</option>
                            </select>
                          </td>
                          <td className="py-3 px-2 text-center">
                            <button
                              onClick={() => handleDeleteMember(m.id)}
                              className="text-gray-400 hover:text-red-600 p-1"
                              title="Delete member"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Teams Tab */}
            {activeTab === 'teams' && (
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Teams</h2>
                  <button
                    onClick={() => setShowAddTeam(true)}
                    className="btn-primary text-sm flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add Team
                  </button>
                </div>

                {showAddTeam && (
                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <input
                      type="text"
                      value={newTeamName}
                      onChange={(e) => setNewTeamName(e.target.value)}
                      placeholder="Team name"
                      className="input-field w-full"
                    />
                    <div className="flex gap-2 mt-4">
                      <button onClick={handleAddTeam} className="btn-primary text-sm">
                        Save
                      </button>
                      <button
                        onClick={() => setShowAddTeam(false)}
                        className="btn-secondary text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div className="divide-y divide-gray-100">
                  {teams.map((team) => {
                    const teamMembers = members.filter(m => m.teamIds?.includes(team.id));
                    const isEditing = editingTeamId === team.id;
                    return (
                      <div key={team.id} className="py-3 flex items-center justify-between">
                        <div className="flex-1">
                          {isEditing ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editingTeamName}
                                onChange={(e) => setEditingTeamName(e.target.value)}
                                className="input-field flex-1"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleUpdateTeam(team.id);
                                  if (e.key === 'Escape') {
                                    setEditingTeamId(null);
                                    setEditingTeamName('');
                                  }
                                }}
                              />
                              <button
                                onClick={() => handleUpdateTeam(team.id)}
                                className="btn-primary text-sm px-3 py-1"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingTeamId(null);
                                  setEditingTeamName('');
                                }}
                                className="btn-secondary text-sm px-3 py-1"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="font-medium text-gray-900">{team.name}</div>
                              <div className="text-sm text-gray-500">{teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}</div>
                            </>
                          )}
                        </div>
                        {!isEditing && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingTeamId(team.id);
                                setEditingTeamName(team.name);
                              }}
                              className="text-gray-400 hover:text-teal-600 p-1"
                              title="Edit team"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteTeam(team.id)}
                              className="text-gray-400 hover:text-red-600 p-1"
                              title="Delete team"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pending Requests Tab */}
            {activeTab === 'pending' && (
              <div className="glass-card rounded-xl p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Access Requests
                </h2>

                {pendingUsers.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No pending requests
                  </p>
                ) : (
                  <div className="space-y-4">
                    {pendingUsers.map((pu) => (
                      <div
                        key={pu.id}
                        className="bg-gray-50 rounded-lg p-4 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-medium text-gray-900">{pu.email}</div>
                          <div className="text-sm text-gray-500">
                            Requested {new Date(pu.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setApprovingUser(pu);
                              setApprovalName('');
                              setApprovalTeams([]);
                            }}
                            className="btn-primary text-sm"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleRejectUser(pu)}
                            className="btn-secondary text-sm text-red-600 hover:bg-red-50"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Emails Tab */}
            {activeTab === 'emails' && (
              <div className="glass-card rounded-xl p-6">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Email Digests</h2>
                  <p className="text-sm text-gray-500">
                    Team leads and admins can receive dashboard summary emails.
                  </p>
                </div>

                {emailMembers.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No members with email found
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Name</th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Role</th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Teams</th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Frequency</th>
                          <th className="text-left py-3 px-2 text-sm font-medium text-gray-600">Last Sent</th>
                          <th className="text-center py-3 px-2 text-sm font-medium text-gray-600">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {emailMembers.map((m) => (
                          <tr key={m.id} className="hover:bg-gray-50">
                            <td className="py-3 px-2">
                              <div className="font-medium text-gray-900">{m.name}</div>
                              <div className="text-xs text-gray-500">{m.email}</div>
                            </td>
                            <td className="py-3 px-2">
                              <span className={`text-xs px-2 py-1 rounded-full ${
                                m.role === 'admin'
                                  ? 'bg-purple-100 text-purple-700'
                                  : m.role === 'lead'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {m.role === 'admin' ? 'Admin' : m.role === 'lead' ? 'Lead' : 'Staff'}
                              </span>
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex flex-wrap gap-1">
                                {m.role === 'admin' ? (
                                  <span className="text-xs text-gray-500 italic">All teams</span>
                                ) : m.teams && m.teams.length > 0 ? (
                                  m.teams.map((t, i) => (
                                    <span key={i} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                                      {t?.name}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs text-gray-400 italic">No teams</span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              <select
                                value={m.email_settings?.frequency || 'weekly'}
                                onChange={(e) => handleUpdateEmailFrequency(m.id, e.target.value)}
                                className="text-sm border border-gray-200 rounded px-2 py-1 bg-white"
                              >
                                <option value="daily">Daily</option>
                                <option value="weekly">Weekly</option>
                                <option value="monthly">Monthly</option>
                                <option value="none">None</option>
                              </select>
                            </td>
                            <td className="py-3 px-2 text-sm text-gray-500">
                              {m.email_settings?.last_sent_at
                                ? new Date(m.email_settings.last_sent_at).toLocaleDateString()
                                : 'Never'}
                            </td>
                            <td className="py-3 px-2 text-center">
                              <button
                                onClick={() => handleSendEmailNow(m.id)}
                                disabled={sendingEmail === m.id}
                                className="text-sm text-teal-600 hover:text-teal-800 font-medium disabled:opacity-50"
                              >
                                {sendingEmail === m.id ? 'Sending...' : 'Send Now'}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Schedule Info</h3>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• <strong>Daily:</strong> Sent every day at 8 AM UTC</li>
                    <li>• <strong>Weekly:</strong> Sent every Monday at 8 AM UTC</li>
                    <li>• <strong>Monthly:</strong> Sent on the 1st of each month at 8 AM UTC</li>
                    <li>• <strong>None:</strong> No automatic emails</li>
                  </ul>
                  <h3 className="text-sm font-medium text-gray-700 mt-4 mb-2">What Each Role Sees</h3>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• <strong>Admin:</strong> All pipelines across all teams</li>
                    <li>• <strong>Lead:</strong> All pipelines in their assigned teams</li>
                    <li>• <strong>Staff:</strong> Only pipelines where they have a step assigned</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Content Tab */}
            {activeTab === 'content' && (
              <div className="glass-card rounded-xl p-6">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">Dashboard Content</h2>
                  <p className="text-sm text-gray-500">
                    Manage announcements and shared links that appear on team dashboards.
                  </p>
                </div>

                {/* Team Selector */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Team</label>
                  <select
                    value={selectedTeamForContent}
                    onChange={(e) => {
                      setSelectedTeamForContent(e.target.value);
                      loadContent(e.target.value);
                    }}
                    className="input-field w-full max-w-xs"
                  >
                    <option value="">Choose a team...</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                {selectedTeamForContent && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Announcements Section */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                        </svg>
                        Announcements
                      </h3>

                      {/* Add New Announcement */}
                      <div className="mb-4">
                        <textarea
                          value={newAnnouncementText}
                          onChange={(e) => setNewAnnouncementText(e.target.value)}
                          placeholder="Write an announcement..."
                          className="input-field w-full h-20 resize-none"
                        />
                        <button
                          onClick={handleAddAnnouncement}
                          disabled={!newAnnouncementText.trim()}
                          className="btn-primary text-sm mt-2 disabled:opacity-50"
                        >
                          Post Announcement
                        </button>
                      </div>

                      {/* Announcements List */}
                      <div className="space-y-3 max-h-80 overflow-y-auto">
                        {announcements.length === 0 ? (
                          <p className="text-sm text-gray-500 italic">No announcements yet</p>
                        ) : (
                          announcements.map((a) => (
                            <div key={a.id} className="bg-white rounded-lg p-3 border border-gray-200">
                              {editingAnnouncementId === a.id ? (
                                <div>
                                  <textarea
                                    value={editingAnnouncementText}
                                    onChange={(e) => setEditingAnnouncementText(e.target.value)}
                                    className="input-field w-full h-20 resize-none text-sm"
                                  />
                                  <div className="flex gap-2 mt-2">
                                    <button
                                      onClick={() => handleUpdateAnnouncement(a.id)}
                                      className="btn-primary text-xs px-3 py-1"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingAnnouncementId(null);
                                        setEditingAnnouncementText('');
                                      }}
                                      className="btn-secondary text-xs px-3 py-1"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <p className="text-sm text-gray-800 whitespace-pre-wrap">{a.content}</p>
                                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
                                    <div className="text-xs text-gray-500">
                                      {a.member?.name} • {new Date(a.created_at).toLocaleDateString()}
                                      {a.updated_at !== a.created_at && ' (edited)'}
                                    </div>
                                    <div className="flex gap-1">
                                      <button
                                        onClick={() => {
                                          setEditingAnnouncementId(a.id);
                                          setEditingAnnouncementText(a.content);
                                        }}
                                        className="text-gray-400 hover:text-teal-600 p-1"
                                        title="Edit"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => handleDeleteAnnouncement(a.id)}
                                        className="text-gray-400 hover:text-red-600 p-1"
                                        title="Delete"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Shared Links Section */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                        Shared Links
                      </h3>

                      {/* Add New Link */}
                      <div className="mb-4 space-y-2">
                        <input
                          type="text"
                          value={newLinkTitle}
                          onChange={(e) => setNewLinkTitle(e.target.value)}
                          placeholder="Link title (e.g., Staff Database)"
                          className="input-field w-full text-sm"
                        />
                        <input
                          type="text"
                          value={newLinkDescription}
                          onChange={(e) => setNewLinkDescription(e.target.value)}
                          placeholder="Description (optional)"
                          className="input-field w-full text-sm"
                        />
                        <input
                          type="url"
                          value={newLinkUrl}
                          onChange={(e) => setNewLinkUrl(e.target.value)}
                          placeholder="URL (e.g., https://example.com)"
                          className="input-field w-full text-sm"
                        />
                        <button
                          onClick={handleAddSharedLink}
                          disabled={!newLinkTitle.trim() || !newLinkUrl.trim()}
                          className="btn-primary text-sm disabled:opacity-50"
                        >
                          Add Link
                        </button>
                      </div>

                      {/* Links List */}
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {sharedLinks.length === 0 ? (
                          <p className="text-sm text-gray-500 italic">No shared links yet</p>
                        ) : (
                          sharedLinks.map((link) => (
                            <div key={link.id} className="bg-white rounded-lg p-3 border border-gray-200">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <a
                                    href={link.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-medium text-teal-600 hover:text-teal-700 text-sm block truncate"
                                  >
                                    {link.title}
                                  </a>
                                  {link.description && (
                                    <p className="text-xs text-gray-500 mt-0.5">{link.description}</p>
                                  )}
                                  <p className="text-xs text-gray-400 mt-1 truncate">{link.url}</p>
                                </div>
                                <button
                                  onClick={() => handleDeleteSharedLink(link.id)}
                                  className="text-gray-400 hover:text-red-600 p-1 flex-shrink-0"
                                  title="Delete"
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                              <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
                                Added by {link.member?.name} • {new Date(link.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Settings Tab */}
            {activeTab === 'settings' && (
              <div className="glass-card rounded-xl p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Settings
                </h2>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Name
                    </label>
                    <p className="text-xs text-gray-500 mb-2">
                      This appears in the header across all pages.
                    </p>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        className="input-field flex-1"
                        placeholder="Enter business name"
                      />
                      <button
                        onClick={handleSaveBusinessName}
                        disabled={savingSettings || !businessName.trim() || businessName === business?.name}
                        className="btn-primary px-6 disabled:opacity-50"
                      >
                        {savingSettings ? 'Saving...' : 'Save'}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Join Code
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      Share this code with people who want to request access to your business.
                      They will enter it on the &quot;Request Access&quot; tab of the login page.
                    </p>
                    <div className="flex items-center gap-3">
                      <code className="bg-gray-100 px-4 py-2.5 rounded-lg text-lg font-mono font-bold text-teal-600 tracking-wider">
                        {joinCode || '------'}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(joinCode);
                          alert('Join code copied to clipboard!');
                        }}
                        disabled={!joinCode}
                        className="btn-secondary text-sm flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Approval Modal */}
        {approvingUser && (
          <div className="modal-overlay" onClick={() => setApprovingUser(null)}>
            <div className="modal-content p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Approve Access Request
              </h3>
              <p className="text-gray-600 mb-4">{approvingUser.email}</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={approvalName}
                    onChange={(e) => setApprovalName(e.target.value)}
                    className="input-field"
                    placeholder="Enter name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assign to Teams
                  </label>
                  <div className="space-y-2">
                    {teams.map((team) => (
                      <label key={team.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={approvalTeams.includes(team.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setApprovalTeams([...approvalTeams, team.id]);
                            } else {
                              setApprovalTeams(
                                approvalTeams.filter((t) => t !== team.id)
                              );
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">{team.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-6">
                <button
                  onClick={handleApproveUser}
                  disabled={!approvalName}
                  className="btn-primary flex-1"
                >
                  Approve
                </button>
                <button
                  onClick={() => setApprovingUser(null)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
