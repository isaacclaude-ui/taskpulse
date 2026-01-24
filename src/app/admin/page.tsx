'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { useNav } from '@/context/NavContext';
import type { Team, Member, PendingUser, Announcement, SharedLink, CalendarEvent } from '@/types';

type Tab = 'settings' | 'teams' | 'members' | 'pending' | 'notifications' | 'content';

// Preset colors for calendar events (full standard palette)
const EVENT_COLORS = [
  // Row 1: Warm colors
  { name: 'Red', value: '#dc2626' },
  { name: 'Orange', value: '#ea580c' },
  { name: 'Amber', value: '#d97706' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Lime', value: '#84cc16' },
  // Row 2: Greens & Teals
  { name: 'Green', value: '#22c55e' },
  { name: 'Emerald', value: '#10b981' },
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Cyan', value: '#06b6d4' },
  { name: 'Sky', value: '#0ea5e9' },
  // Row 3: Blues & Purples
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Indigo', value: '#6366f1' },
  { name: 'Violet', value: '#8b5cf6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Fuchsia', value: '#d946ef' },
  // Row 4: Pinks & Neutrals
  { name: 'Pink', value: '#ec4899' },
  { name: 'Rose', value: '#f43f5e' },
  { name: 'White', value: '#f8fafc' },
  { name: 'Gray', value: '#94a3b8' },
  { name: 'Black', value: '#1e293b' },
];

interface MemberWithTeams extends Member {
  teamIds: string[];
  is_archived?: boolean;
  archived_at?: string;
}

export default function AdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { business, member, team, teamId } = useNav();

  // Get initial tab from URL or default to 'settings'
  const tabFromUrl = searchParams.get('tab') as Tab | null;
  const validTabs: Tab[] = ['settings', 'teams', 'members', 'pending', 'notifications', 'content'];
  const initialTab = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'settings';

  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Update URL when tab changes (without full page reload)
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', tab);
    router.replace(`/admin?${params.toString()}`, { scroll: false });
  };
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
  const [sendInvite, setSendInvite] = useState(false);
  const [sendingInvite, setSendingInvite] = useState<string | null>(null);

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
  const [editingTeamLogoPreview, setEditingTeamLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Member name editing
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingMemberName, setEditingMemberName] = useState('');

  // Member email editing
  const [editingMemberEmailId, setEditingMemberEmailId] = useState<string | null>(null);
  const [editingMemberEmail, setEditingMemberEmail] = useState('');

  // Member filtering
  const [memberTeamFilter, setMemberTeamFilter] = useState<string>('all');

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
  const [editingLinkId, setEditingLinkId] = useState<string | null>(null);
  const [editingLinkTitle, setEditingLinkTitle] = useState('');
  const [editingLinkDescription, setEditingLinkDescription] = useState('');
  const [editingLinkUrl, setEditingLinkUrl] = useState('');
  const [selectedTeamForContent, setSelectedTeamForContent] = useState<string>('');

  // Calendar events
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventColor, setNewEventColor] = useState('#0d9488');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventTitle, setEditingEventTitle] = useState('');
  const [editingEventColor, setEditingEventColor] = useState('');

  useEffect(() => {
    async function checkAuth() {
      const user = await getCurrentUser();
      if (!user) {
        router.push('/login');
        return;
      }
      // Admin and Lead can access admin panel
      if (!member || (member.role !== 'admin' && member.role !== 'lead')) {
        router.push('/dashboard');
        return;
      }
      // Set default tab based on role - leads only see content/notifications
      // Only override if no tab was specified in URL
      if (member.role === 'lead' && !tabFromUrl) {
        setActiveTab('content');
        router.replace('/admin?tab=content', { scroll: false });
      }
      loadData();
    }
    checkAuth();
  }, [router, member]);

  const isAdmin = member?.role === 'admin';
  const isLead = member?.role === 'lead';

  const loadData = async () => {
    if (!business) return;

    setLoading(true);
    try {
      // Leads only see their team data, Admins see all
      if (isAdmin) {
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
        setMembers(
          (membersData.members || []).map((m: Member & { teams?: { id: string }[], teamIds?: string[] }) => ({
            ...m,
            teamIds: m.teamIds || m.teams?.map((t) => t.id) || [],
          }))
        );
        setPendingUsers(pendingData.pendingUsers || []);
        setEmailMembers(emailData.members || []);
      } else if (isLead && team) {
        // Lead: fetch their team's data (members, pending, content)
        const [teamsRes, membersRes, pendingRes, emailRes] = await Promise.all([
          fetch(`/api/teams?businessId=${business.id}`),
          fetch(`/api/members?teamId=${team.id}&includeTeams=true`),
          fetch(`/api/admin/pending-users?businessId=${business.id}&teamId=${team.id}`),
          fetch(`/api/admin/email-settings?businessId=${business.id}&teamId=${team.id}`),
        ]);

        const [teamsData, membersData, pendingData, emailData] = await Promise.all([
          teamsRes.json(),
          membersRes.json(),
          pendingRes.json(),
          emailRes.json(),
        ]);

        // Filter to only show lead's team
        const leadTeams = (teamsData.teams || []).filter((t: Team) => t.id === team.id);
        setTeams(leadTeams);
        // Filter members to only those in lead's team
        const teamMembers = (membersData.members || [])
          .filter((m: Member & { teams?: { id: string }[], teamIds?: string[] }) =>
            m.teamIds?.includes(team.id) || m.teams?.some((t) => t.id === team.id)
          )
          .map((m: Member & { teams?: { id: string }[], teamIds?: string[] }) => ({
            ...m,
            teamIds: m.teamIds || m.teams?.map((t) => t.id) || [],
          }));
        setMembers(teamMembers);
        // Filter pending to only those requesting lead's team
        const teamPending = (pendingData.pendingUsers || []).filter(
          (p: PendingUser) => p.requested_team_id === team.id
        );
        setPendingUsers(teamPending);
        setEmailMembers(emailData.members || []);
      }

      // For admin, also load business settings
      if (isAdmin) {
        setBusinessName(business?.name || '');
        const bizRes = await fetch(`/api/businesses?id=${business.id}`);
        const bizData = await bizRes.json();
        if (bizData.business?.join_code) {
          setJoinCode(bizData.business.join_code);
        }
      }

      setLoading(false);
    } catch (error) {
      console.error('Failed to load data:', error);
      setLoading(false);
    }
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
        // Send invite email if checkbox is checked and email is provided
        if (sendInvite && newMemberEmail.trim()) {
          try {
            await fetch('/api/send-invite', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: newMemberEmail.trim(),
                name: newMemberName.trim(),
              }),
            });
          } catch {
            console.error('Failed to send invite');
          }
        }

        setNewMemberName('');
        setNewMemberEmail('');
        setNewMemberRole('user');
        setNewMemberTeams([]);
        setSendInvite(false);
        setShowAddMember(false);
        loadData();
      }
    } catch (error) {
      console.error('Failed to add member:', error);
    }
  };

  // Send invite to existing member
  const handleSendInvite = async (memberId: string, email: string, name: string) => {
    setSendingInvite(memberId);
    try {
      const res = await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(`Invite sent to ${email}`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send invite';
      alert(message);
    } finally {
      setSendingInvite(null);
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

  const handleUpdateMemberName = async (memberId: string) => {
    if (!editingMemberName.trim()) return;
    try {
      await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingMemberName.trim() }),
      });
      setEditingMemberId(null);
      setEditingMemberName('');
      loadData();
    } catch (error) {
      console.error('Failed to update member name:', error);
    }
  };

  const handleUpdateMemberEmail = async (memberId: string) => {
    try {
      await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: editingMemberEmail.trim() || null }),
      });
      setEditingMemberEmailId(null);
      setEditingMemberEmail('');
      loadData();
    } catch (error) {
      console.error('Failed to update member email:', error);
    }
  };

  const handleDeleteMember = async (memberId: string) => {
    if (!confirm('Delete this member?')) return;

    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.hasActiveAssignments) {
          // Member has active task assignments - offer to archive instead
          const taskList = data.taskTitles?.join(', ') || 'active tasks';
          const archiveInstead = confirm(
            `Cannot delete: This member is assigned to ${data.activeCount} step(s) in "${taskList}".\n\n` +
            `Would you like to archive them instead? Archived members won't appear in assignment dropdowns but existing assignments remain intact.`
          );

          if (archiveInstead) {
            await handleArchiveMember(memberId);
          }
        } else {
          alert(data.error || 'Failed to delete member');
        }
        return;
      }

      loadData();
    } catch (error) {
      console.error('Failed to delete member:', error);
    }
  };

  const handleArchiveMember = async (memberId: string) => {
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_archived: true,
          archived_at: new Date().toISOString(),
        }),
      });

      if (res.ok) {
        loadData();
      } else {
        alert('Failed to archive member');
      }
    } catch (error) {
      console.error('Failed to archive member:', error);
    }
  };

  const handleUnarchiveMember = async (memberId: string) => {
    try {
      const res = await fetch(`/api/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_archived: false,
          archived_at: null,
        }),
      });

      if (res.ok) {
        loadData();
      }
    } catch (error) {
      console.error('Failed to unarchive member:', error);
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

  const handleLogoUpload = async (teamId: string, file: File) => {
    setUploadingLogo(true);
    try {
      const formData = new FormData();
      formData.append('logo', file);

      const res = await fetch(`/api/teams/${teamId}/logo`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const data = await res.json();
        setEditingTeamLogoPreview(data.logo_url);
        loadData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to upload logo');
      }
    } catch (error) {
      console.error('Failed to upload logo:', error);
      alert('Failed to upload logo');
    }
    setUploadingLogo(false);
  };

  const handleLogoRemove = async (teamId: string) => {
    if (!confirm('Remove this team logo?')) return;

    setUploadingLogo(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/logo`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setEditingTeamLogoPreview(null);
        loadData();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to remove logo');
      }
    } catch (error) {
      console.error('Failed to remove logo:', error);
      alert('Failed to remove logo');
    }
    setUploadingLogo(false);
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
  const loadContent = async (teamId: string, month?: string) => {
    if (!teamId) return;
    const targetMonth = month || calendarMonth;
    try {
      const [announcementsRes, linksRes, eventsRes] = await Promise.all([
        fetch(`/api/announcements?teamId=${teamId}`),
        fetch(`/api/shared-links?teamId=${teamId}`),
        fetch(`/api/calendar-events?teamId=${teamId}&month=${targetMonth}`),
      ]);
      const [announcementsData, linksData, eventsData] = await Promise.all([
        announcementsRes.json(),
        linksRes.json(),
        eventsRes.json(),
      ]);
      setAnnouncements(announcementsData.announcements || []);
      setSharedLinks(linksData.links || []);
      setCalendarEvents(eventsData.events || []);
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

  const handleUpdateSharedLink = async (id: string) => {
    if (!editingLinkTitle.trim() || !editingLinkUrl.trim()) return;
    try {
      const res = await fetch(`/api/shared-links/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingLinkTitle.trim(),
          description: editingLinkDescription.trim() || null,
          url: editingLinkUrl.trim(),
        }),
      });
      if (res.ok) {
        setEditingLinkId(null);
        setEditingLinkTitle('');
        setEditingLinkDescription('');
        setEditingLinkUrl('');
        loadContent(selectedTeamForContent);
      }
    } catch (error) {
      console.error('Failed to update shared link:', error);
    }
  };

  // Calendar event handlers
  const handleAddCalendarEvent = async () => {
    if (!selectedTeamForContent || !selectedCalendarDate || !newEventTitle.trim() || !member) return;
    try {
      const res = await fetch('/api/calendar-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teamId: selectedTeamForContent,
          eventDate: selectedCalendarDate,
          title: newEventTitle.trim(),
          color: newEventColor,
          memberId: member.id,
        }),
      });
      if (res.ok) {
        setNewEventTitle('');
        setNewEventColor('#0d9488');
        loadContent(selectedTeamForContent, calendarMonth);
      }
    } catch (error) {
      console.error('Failed to add calendar event:', error);
    }
  };

  const handleUpdateCalendarEvent = async (id: string) => {
    if (!editingEventTitle.trim()) return;
    try {
      const res = await fetch(`/api/calendar-events/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editingEventTitle.trim(),
          color: editingEventColor,
        }),
      });
      if (res.ok) {
        setEditingEventId(null);
        setEditingEventTitle('');
        setEditingEventColor('');
        loadContent(selectedTeamForContent, calendarMonth);
      }
    } catch (error) {
      console.error('Failed to update calendar event:', error);
    }
  };

  const handleDeleteCalendarEvent = async (id: string) => {
    if (!confirm('Delete this event?')) return;
    try {
      await fetch(`/api/calendar-events/${id}`, { method: 'DELETE' });
      loadContent(selectedTeamForContent, calendarMonth);
    } catch (error) {
      console.error('Failed to delete calendar event:', error);
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
        {/* Tabs - Admin sees all, Lead sees only Notifications + Content */}
        <div className="flex flex-wrap gap-2 mb-6">
          {/* Admin-only tabs */}
          {isAdmin && (
            <>
              <button
                onClick={() => handleTabChange('settings')}
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
              <button
                onClick={() => handleTabChange('teams')}
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
            </>
          )}
          {/* Members + Pending tabs - Admin + Lead */}
          <button
            onClick={() => handleTabChange('members')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'members'
                ? 'bg-teal-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {isLead ? 'Team Members' : 'Members'}
          </button>
          <button
            onClick={() => handleTabChange('pending')}
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
          {/* Shared tabs - Notifications and Content */}
          <button
            onClick={() => handleTabChange('notifications')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'notifications'
                ? 'bg-teal-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            Notifications
          </button>
          <button
            onClick={() => {
              handleTabChange('content');
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
                    {/* Send invite checkbox - only show if email is entered */}
                    {newMemberEmail.trim() && (
                      <div className="mt-3">
                        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={sendInvite}
                            onChange={(e) => setSendInvite(e.target.checked)}
                            className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                          />
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          Send invite email
                        </label>
                      </div>
                    )}
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

                {/* Team filter */}
                <div className="mt-4 flex items-center gap-3">
                  <label className="text-sm text-gray-600">Filter by team:</label>
                  <select
                    value={memberTeamFilter}
                    onChange={(e) => setMemberTeamFilter(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="all">All Teams</option>
                    <option value="none">No Team</option>
                    {teams.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <span className="text-xs text-gray-400">
                    {memberTeamFilter === 'all'
                      ? `${members.length} members total`
                      : memberTeamFilter === 'none'
                      ? `${members.filter(m => !m.teamIds || m.teamIds.length === 0).length} members`
                      : `${members.filter(m => m.teamIds?.includes(memberTeamFilter)).length} members`
                    }
                  </span>
                </div>

                {/* Members table - grouped by category with consistent columns */}
                <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                  {(() => {
                    // Filter members based on team filter
                    const filteredMembers = members.filter(m => {
                      if (memberTeamFilter === 'all') return true;
                      if (memberTeamFilter === 'none') return !m.teamIds || m.teamIds.length === 0;
                      return m.teamIds?.includes(memberTeamFilter);
                    });

                    // Group members: Admins first, then by team
                    const adminMembers = filteredMembers.filter(m => m.role === 'admin');
                    const unassignedMembers = filteredMembers.filter(m => m.role !== 'admin' && (!m.teamIds || m.teamIds.length === 0));

                    // Group non-admin members by their team
                    const membersByTeam: { [teamId: string]: typeof filteredMembers } = {};
                    teams.forEach(t => {
                      membersByTeam[t.id] = filteredMembers.filter(m =>
                        m.role !== 'admin' && m.teamIds?.includes(t.id)
                      );
                    });

                    // Render a member row - always 5 columns for alignment
                    const renderMemberRow = (m: MemberWithTeams, teamColumn: 'all' | 'selector' | string) => (
                      <tr key={m.id} className="hover:bg-gray-50">
                        {/* Name column - 25% */}
                        <td className="py-3 px-2 sm:px-3 w-[25%]">
                          {editingMemberId === m.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editingMemberName}
                                onChange={(e) => setEditingMemberName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleUpdateMemberName(m.id);
                                  if (e.key === 'Escape') {
                                    setEditingMemberId(null);
                                    setEditingMemberName('');
                                  }
                                }}
                                className="input-field text-sm py-1 px-2 w-full"
                                autoFocus
                              />
                              <button onClick={() => handleUpdateMemberName(m.id)} className="text-teal-600 hover:text-teal-700 p-1" title="Save">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => { setEditingMemberId(m.id); setEditingMemberName(m.name); }}
                                className={`font-medium hover:text-teal-600 text-left truncate ${m.is_archived ? 'text-gray-400' : 'text-gray-900'}`}
                                title={m.name}
                              >
                                {m.name}
                              </button>
                              {m.is_archived && (
                                <span className="text-[9px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded shrink-0">Arc</span>
                              )}
                            </div>
                          )}
                        </td>
                        {/* Email column - 30% */}
                        <td className="py-3 px-2 sm:px-3 w-[30%]">
                          {editingMemberEmailId === m.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="email"
                                value={editingMemberEmail}
                                onChange={(e) => setEditingMemberEmail(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleUpdateMemberEmail(m.id);
                                  if (e.key === 'Escape') {
                                    setEditingMemberEmailId(null);
                                    setEditingMemberEmail('');
                                  }
                                }}
                                placeholder="email@example.com"
                                className="input-field text-sm py-1 px-2 w-full"
                                autoFocus
                              />
                              <button onClick={() => handleUpdateMemberEmail(m.id)} className="text-teal-600 hover:text-teal-700 p-1" title="Save">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingMemberEmailId(m.id); setEditingMemberEmail(m.email || ''); }}
                              className="text-sm text-gray-600 hover:text-teal-600 truncate block text-left w-full"
                              title={m.email || 'Click to add email'}
                            >
                              {m.email || <span className="text-gray-400">+ Add email</span>}
                            </button>
                          )}
                        </td>
                        {/* Role column - 12% */}
                        <td className="py-3 px-2 sm:px-3 hidden sm:table-cell w-[12%]">
                          <select
                            value={m.role}
                            onChange={(e) => handleUpdateMemberRole(m.id, e.target.value)}
                            className="text-xs border border-gray-200 rounded px-1 sm:px-2 py-1 bg-white w-full"
                          >
                            <option value="user">Staff</option>
                            <option value="lead">Lead</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        {/* Team/Access column - 18% - always present for alignment */}
                        <td className="py-3 px-2 sm:px-3 hidden md:table-cell w-[18%]">
                          {teamColumn === 'all' ? (
                            <span className="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded">All Teams</span>
                          ) : teamColumn === 'selector' ? (
                            <select
                              value={m.teamIds?.[0] || ''}
                              onChange={(e) => handleUpdateMemberTeams(m.id, e.target.value ? [e.target.value] : [])}
                              className="text-xs border border-gray-200 rounded px-2 py-1 bg-white w-full"
                            >
                              <option value="">No Team</option>
                              {teams.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-teal-600">✓</span>
                          )}
                        </td>
                        {/* Actions column - 15% */}
                        <td className="py-3 px-1 sm:px-3 w-[15%]">
                          <div className="flex items-center justify-center gap-0.5">
                            <div className="w-6 h-6 flex items-center justify-center">
                              {m.email ? (
                                <button
                                  onClick={() => handleSendInvite(m.id, m.email, m.name)}
                                  disabled={sendingInvite === m.id}
                                  className="text-gray-400 hover:text-teal-600 p-1 rounded hover:bg-teal-50 disabled:opacity-50"
                                  title="Send invite"
                                >
                                  {sendingInvite === m.id ? (
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                  )}
                                </button>
                              ) : null}
                            </div>
                            {m.is_archived ? (
                              <button onClick={() => handleUnarchiveMember(m.id)} className="text-amber-500 hover:text-amber-600 p-1" title="Restore">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                              </button>
                            ) : (
                              <button onClick={() => handleArchiveMember(m.id)} className="text-gray-400 hover:text-amber-600 p-1" title="Archive">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                                </svg>
                              </button>
                            )}
                            <button onClick={() => handleDeleteMember(m.id)} className="text-gray-400 hover:text-red-600 p-1" title="Delete">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );

                    return (
                      <table className="w-full table-fixed">
                        {/* Single header row for all sections */}
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-100">
                            <th className="text-left py-2 px-2 sm:px-3 text-xs font-medium text-gray-500 w-[25%]">Name</th>
                            <th className="text-left py-2 px-2 sm:px-3 text-xs font-medium text-gray-500 w-[30%]">Email</th>
                            <th className="text-left py-2 px-2 sm:px-3 text-xs font-medium text-gray-500 hidden sm:table-cell w-[12%]">Role</th>
                            <th className="text-left py-2 px-2 sm:px-3 text-xs font-medium text-gray-500 hidden md:table-cell w-[18%]">Team</th>
                            <th className="text-center py-2 px-2 sm:px-3 text-xs font-medium text-gray-500 w-[15%]">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {/* Admins Section */}
                          {adminMembers.length > 0 && (
                            <>
                              <tr className="bg-purple-50">
                                <td colSpan={5} className="py-2 px-3">
                                  <div className="text-sm font-semibold text-purple-700 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                    Admins ({adminMembers.length})
                                  </div>
                                </td>
                              </tr>
                              {adminMembers.map(m => renderMemberRow(m, 'all'))}
                            </>
                          )}

                          {/* Team Sections */}
                          {teams.map(team => {
                            const teamMembers = membersByTeam[team.id] || [];
                            if (teamMembers.length === 0 && memberTeamFilter !== 'all') return null;
                            return (
                              <React.Fragment key={team.id}>
                                <tr className="bg-gradient-to-r from-teal-50 to-emerald-50">
                                  <td colSpan={5} className="py-2 px-3">
                                    <div className="text-sm font-semibold text-teal-700 flex items-center gap-2">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                      </svg>
                                      {team.name} ({teamMembers.length})
                                    </div>
                                  </td>
                                </tr>
                                {teamMembers.length > 0 ? (
                                  teamMembers.map(m => renderMemberRow(m, team.name))
                                ) : (
                                  <tr>
                                    <td colSpan={5} className="py-4 text-center text-sm text-gray-400">
                                      No members in this team
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}

                          {/* Unassigned Members */}
                          {unassignedMembers.length > 0 && (
                            <>
                              <tr className="bg-amber-50">
                                <td colSpan={5} className="py-2 px-3">
                                  <div className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    No Team Assigned ({unassignedMembers.length})
                                  </div>
                                </td>
                              </tr>
                              {unassignedMembers.map(m => renderMemberRow(m, 'selector'))}
                            </>
                          )}
                        </tbody>
                      </table>
                    );
                  })()}
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
                            <>
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
                                    setEditingTeamLogoPreview(null);
                                  }}
                                  className="btn-secondary text-sm px-3 py-1"
                                >
                                  Cancel
                                </button>
                              </div>

                              {/* Logo Upload Section */}
                              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                              <label className="block text-sm font-medium text-gray-700 mb-2">
                                Team Logo
                              </label>
                              <div className="flex items-center gap-4">
                                {/* Logo Preview */}
                                <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-200 flex items-center justify-center">
                                  {editingTeamLogoPreview ? (
                                    <img
                                      src={editingTeamLogoPreview}
                                      alt="Team logo"
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  )}
                                </div>

                                {/* Upload Controls */}
                                <div className="flex flex-col gap-2">
                                  <label className="btn-secondary text-sm px-3 py-1 cursor-pointer inline-flex items-center gap-1">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                    </svg>
                                    {uploadingLogo ? 'Uploading...' : 'Choose File'}
                                    <input
                                      type="file"
                                      accept="image/png,image/jpeg,image/webp"
                                      className="hidden"
                                      disabled={uploadingLogo}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          handleLogoUpload(team.id, file);
                                        }
                                        e.target.value = '';
                                      }}
                                    />
                                  </label>
                                  {editingTeamLogoPreview && (
                                    <button
                                      onClick={() => handleLogoRemove(team.id)}
                                      disabled={uploadingLogo}
                                      className="text-red-600 hover:text-red-700 text-sm flex items-center gap-1"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                      Remove
                                    </button>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-gray-500 mt-2">
                                PNG, JPG, or WebP. Max 1MB. Recommended: 200x200px
                              </p>
                            </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-3">
                              {team.logo_url ? (
                                <img
                                  src={team.logo_url}
                                  alt={team.name}
                                  className="w-10 h-10 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                </div>
                              )}
                              <div>
                                <div className="font-medium text-gray-900">{team.name}</div>
                                <div className="text-sm text-gray-500">{teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''}</div>
                              </div>
                            </div>
                          )}
                        </div>
                        {!isEditing && (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                setEditingTeamId(team.id);
                                setEditingTeamName(team.name);
                                setEditingTeamLogoPreview(team.logo_url || null);
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

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
              <div className="glass-card rounded-xl p-6">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Notifications</h2>
                  <p className="text-sm text-gray-500">
                    Team leads and admins can receive dashboard summary emails.
                  </p>
                </div>

                {emailMembers.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No members with email found
                  </p>
                ) : (
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    {(() => {
                      // Group email members by category: Admins first, then by team
                      const adminEmailMembers = emailMembers.filter(m => m.role === 'admin');
                      const noTeamEmailMembers = emailMembers.filter(m => m.role !== 'admin' && (!m.teams || m.teams.length === 0));

                      // Group non-admin members by their team
                      const emailMembersByTeam: { [teamName: string]: typeof emailMembers } = {};
                      teams.forEach(t => {
                        emailMembersByTeam[t.name] = emailMembers.filter(m =>
                          m.role !== 'admin' && m.teams?.some(team => team.name === t.name)
                        );
                      });

                      // Render an email member row - consistent 5 columns
                      const renderEmailMemberRow = (m: EmailMember) => (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="py-3 px-2 sm:px-3 w-[30%]">
                            <div className="font-medium text-gray-900">{m.name}</div>
                            <div className="text-xs text-gray-500 truncate">{m.email}</div>
                          </td>
                          <td className="py-3 px-2 sm:px-3 hidden sm:table-cell w-[15%]">
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
                          <td className="py-3 px-2 sm:px-3 w-[20%]">
                            <select
                              value={m.email_settings?.frequency || 'weekly'}
                              onChange={(e) => handleUpdateEmailFrequency(m.id, e.target.value)}
                              className="text-sm border border-gray-200 rounded px-2 py-1 bg-white w-full"
                            >
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                              <option value="monthly">Monthly</option>
                              <option value="none">None</option>
                            </select>
                          </td>
                          <td className="py-3 px-2 sm:px-3 text-sm text-gray-500 hidden md:table-cell w-[20%]">
                            {m.email_settings?.last_sent_at
                              ? new Date(m.email_settings.last_sent_at).toLocaleDateString()
                              : 'Never'}
                          </td>
                          <td className="py-3 px-2 sm:px-3 text-center w-[15%]">
                            <button
                              onClick={() => handleSendEmailNow(m.id)}
                              disabled={sendingEmail === m.id}
                              className="text-sm text-teal-600 hover:text-teal-800 font-medium disabled:opacity-50"
                            >
                              {sendingEmail === m.id ? 'Sending...' : 'Send Now'}
                            </button>
                          </td>
                        </tr>
                      );

                      return (
                        <table className="w-full table-fixed">
                          {/* Single header row */}
                          <thead>
                            <tr className="border-b border-gray-200 bg-gray-100">
                              <th className="text-left py-2 px-2 sm:px-3 text-xs font-medium text-gray-500 w-[30%]">Name</th>
                              <th className="text-left py-2 px-2 sm:px-3 text-xs font-medium text-gray-500 hidden sm:table-cell w-[15%]">Role</th>
                              <th className="text-left py-2 px-2 sm:px-3 text-xs font-medium text-gray-500 w-[20%]">Frequency</th>
                              <th className="text-left py-2 px-2 sm:px-3 text-xs font-medium text-gray-500 hidden md:table-cell w-[20%]">Last Sent</th>
                              <th className="text-center py-2 px-2 sm:px-3 text-xs font-medium text-gray-500 w-[15%]">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {/* Admins Section */}
                            {adminEmailMembers.length > 0 && (
                              <>
                                <tr className="bg-purple-50">
                                  <td colSpan={5} className="py-2 px-3">
                                    <div className="text-sm font-semibold text-purple-700 flex items-center gap-2">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                      </svg>
                                      Admins ({adminEmailMembers.length})
                                      <span className="text-xs font-normal text-purple-500">— All teams</span>
                                    </div>
                                  </td>
                                </tr>
                                {adminEmailMembers.map(m => renderEmailMemberRow(m))}
                              </>
                            )}

                            {/* Team Sections */}
                            {teams.map(team => {
                              const teamEmailMembers = emailMembersByTeam[team.name] || [];
                              if (teamEmailMembers.length === 0) return null;
                              return (
                                <React.Fragment key={team.id}>
                                  <tr className="bg-gradient-to-r from-teal-50 to-emerald-50">
                                    <td colSpan={5} className="py-2 px-3">
                                      <div className="text-sm font-semibold text-teal-700 flex items-center gap-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                        {team.name} ({teamEmailMembers.length})
                                      </div>
                                    </td>
                                  </tr>
                                  {teamEmailMembers.map(m => renderEmailMemberRow(m))}
                                </React.Fragment>
                              );
                            })}

                            {/* No Team Assigned */}
                            {noTeamEmailMembers.length > 0 && (
                              <>
                                <tr className="bg-amber-50">
                                  <td colSpan={5} className="py-2 px-3">
                                    <div className="text-sm font-semibold text-amber-700 flex items-center gap-2">
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                      </svg>
                                      No Team Assigned ({noTeamEmailMembers.length})
                                    </div>
                                  </td>
                                </tr>
                                {noTeamEmailMembers.map(m => renderEmailMemberRow(m))}
                              </>
                            )}
                          </tbody>
                        </table>
                      );
                    })()}
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
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                              {editingLinkId === link.id ? (
                                <div className="space-y-2">
                                  <input
                                    type="text"
                                    value={editingLinkTitle}
                                    onChange={(e) => setEditingLinkTitle(e.target.value)}
                                    placeholder="Link title"
                                    className="input-field w-full text-sm"
                                    autoFocus
                                  />
                                  <input
                                    type="text"
                                    value={editingLinkDescription}
                                    onChange={(e) => setEditingLinkDescription(e.target.value)}
                                    placeholder="Description (optional)"
                                    className="input-field w-full text-sm"
                                  />
                                  <input
                                    type="url"
                                    value={editingLinkUrl}
                                    onChange={(e) => setEditingLinkUrl(e.target.value)}
                                    placeholder="URL"
                                    className="input-field w-full text-sm"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleUpdateSharedLink(link.id)}
                                      className="btn-primary text-xs px-3 py-1"
                                    >
                                      Save
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingLinkId(null);
                                        setEditingLinkTitle('');
                                        setEditingLinkDescription('');
                                        setEditingLinkUrl('');
                                      }}
                                      className="btn-secondary text-xs px-3 py-1"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
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
                                    <div className="flex gap-1 flex-shrink-0">
                                      <button
                                        onClick={() => {
                                          setEditingLinkId(link.id);
                                          setEditingLinkTitle(link.title);
                                          setEditingLinkDescription(link.description || '');
                                          setEditingLinkUrl(link.url);
                                        }}
                                        className="text-gray-400 hover:text-teal-600 p-1"
                                        title="Edit"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSharedLink(link.id)}
                                        className="text-gray-400 hover:text-red-600 p-1"
                                        title="Delete"
                                      >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-400 mt-2 pt-2 border-t border-gray-100">
                                    Added by {link.member?.name} • {new Date(link.created_at).toLocaleDateString()}
                                  </div>
                                </>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Calendar Events Section - Visual Calendar */}
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <svg className="w-5 h-5 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Calendar Events
                      </h3>

                      {/* Month Navigation */}
                      <div className="flex items-center justify-between mb-3">
                        <button
                          onClick={() => {
                            const [year, month] = calendarMonth.split('-').map(Number);
                            const newDate = new Date(year, month - 2, 1);
                            const newMonth = `${newDate.getFullYear()}-${(newDate.getMonth() + 1).toString().padStart(2, '0')}`;
                            setCalendarMonth(newMonth);
                            setSelectedCalendarDate(null);
                            loadContent(selectedTeamForContent, newMonth);
                          }}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-700">
                            {new Date(calendarMonth + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                          </span>
                          <button
                            onClick={() => {
                              const now = new Date();
                              const todayMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
                              setCalendarMonth(todayMonth);
                              setSelectedCalendarDate(null);
                              loadContent(selectedTeamForContent, todayMonth);
                            }}
                            className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                          >
                            Today
                          </button>
                        </div>
                        <button
                          onClick={() => {
                            const [year, month] = calendarMonth.split('-').map(Number);
                            const newDate = new Date(year, month, 1);
                            const newMonth = `${newDate.getFullYear()}-${(newDate.getMonth() + 1).toString().padStart(2, '0')}`;
                            setCalendarMonth(newMonth);
                            setSelectedCalendarDate(null);
                            loadContent(selectedTeamForContent, newMonth);
                          }}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>

                      {/* Calendar Grid */}
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden mb-3">
                        {/* Day headers */}
                        <div className="grid grid-cols-7 border-b border-gray-200">
                          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                            <div key={i} className="text-center text-[10px] font-medium text-gray-500 py-1">
                              {day}
                            </div>
                          ))}
                        </div>
                        {/* Calendar days */}
                        <div className="grid grid-cols-7">
                          {(() => {
                            const [year, month] = calendarMonth.split('-').map(Number);
                            const firstDay = new Date(year, month - 1, 1).getDay();
                            const daysInMonth = new Date(year, month, 0).getDate();
                            const today = new Date();
                            const todayStr = `${today.getFullYear()}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getDate().toString().padStart(2, '0')}`;
                            const cells = [];

                            // Empty cells for days before month starts
                            for (let i = 0; i < firstDay; i++) {
                              cells.push(<div key={`empty-${i}`} className="h-8 border-b border-r border-gray-100" />);
                            }

                            // Day cells
                            for (let day = 1; day <= daysInMonth; day++) {
                              const dateStr = `${calendarMonth}-${day.toString().padStart(2, '0')}`;
                              const dayEvents = calendarEvents.filter(e => e.event_date === dateStr);
                              const isToday = dateStr === todayStr;
                              const isSelected = dateStr === selectedCalendarDate;

                              cells.push(
                                <button
                                  key={day}
                                  onClick={() => setSelectedCalendarDate(dateStr)}
                                  className={`h-8 border-b border-r border-gray-100 relative flex flex-col items-center justify-start pt-0.5 transition-colors ${
                                    isSelected
                                      ? 'bg-teal-100'
                                      : isToday
                                      ? 'bg-teal-50'
                                      : 'hover:bg-gray-50'
                                  }`}
                                >
                                  <span className={`text-[10px] ${
                                    isToday ? 'font-bold text-teal-600' : 'text-gray-700'
                                  }`}>
                                    {day}
                                  </span>
                                  {dayEvents.length > 0 && (
                                    <div className="flex gap-0.5 mt-0.5">
                                      {dayEvents.slice(0, 3).map((e, idx) => (
                                        <div
                                          key={idx}
                                          className="w-1.5 h-1.5 rounded-full"
                                          style={{ backgroundColor: e.color }}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </button>
                              );
                            }

                            return cells;
                          })()}
                        </div>
                      </div>

                      {/* Selected Day Panel */}
                      {selectedCalendarDate && (
                        <div className="bg-white rounded-lg border border-teal-200 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium text-gray-800">
                              {new Date(selectedCalendarDate + 'T00:00:00').toLocaleDateString('en-US', {
                                weekday: 'long',
                                month: 'short',
                                day: 'numeric'
                              })}
                            </h4>
                            <button
                              onClick={() => setSelectedCalendarDate(null)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>

                          {/* Events for selected day */}
                          <div className="space-y-2 mb-3">
                            {calendarEvents.filter(e => e.event_date === selectedCalendarDate).length === 0 ? (
                              <p className="text-xs text-gray-500 italic">No events</p>
                            ) : (
                              calendarEvents.filter(e => e.event_date === selectedCalendarDate).map((event) => (
                                <div key={event.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                                  {editingEventId === event.id ? (
                                    <div className="flex-1 space-y-2">
                                      <input
                                        type="text"
                                        value={editingEventTitle}
                                        onChange={(e) => setEditingEventTitle(e.target.value)}
                                        className="input-field w-full text-xs py-1"
                                        autoFocus
                                      />
                                      <div className="flex gap-1 flex-wrap">
                                        {EVENT_COLORS.map((color) => (
                                          <button
                                            key={color.value}
                                            type="button"
                                            onClick={() => setEditingEventColor(color.value)}
                                            className={`w-4 h-4 rounded-full transition-all ${
                                              editingEventColor === color.value
                                                ? 'ring-2 ring-offset-1 ring-gray-400 scale-110'
                                                : 'hover:scale-105'
                                            }`}
                                            style={{ backgroundColor: color.value }}
                                          />
                                        ))}
                                      </div>
                                      <div className="flex gap-1">
                                        <button
                                          onClick={() => handleUpdateCalendarEvent(event.id)}
                                          className="btn-primary text-xs px-2 py-0.5"
                                        >
                                          Save
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingEventId(null);
                                            setEditingEventTitle('');
                                            setEditingEventColor('');
                                          }}
                                          className="btn-secondary text-xs px-2 py-0.5"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      <div
                                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: event.color }}
                                      />
                                      <span className="text-xs text-gray-800 flex-1">{event.title}</span>
                                      <button
                                        onClick={() => {
                                          setEditingEventId(event.id);
                                          setEditingEventTitle(event.title);
                                          setEditingEventColor(event.color);
                                        }}
                                        className="text-gray-400 hover:text-teal-600 p-0.5"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={() => handleDeleteCalendarEvent(event.id)}
                                        className="text-gray-400 hover:text-red-600 p-0.5"
                                      >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                      </button>
                                    </>
                                  )}
                                </div>
                              ))
                            )}
                          </div>

                          {/* Add new event for selected day */}
                          <div className="border-t border-gray-200 pt-2">
                            <div className="flex gap-2 mb-2">
                              <input
                                type="text"
                                value={newEventTitle}
                                onChange={(e) => setNewEventTitle(e.target.value)}
                                placeholder="New event..."
                                className="input-field flex-1 text-xs py-1"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && newEventTitle.trim()) {
                                    handleAddCalendarEvent();
                                  }
                                }}
                              />
                              <button
                                onClick={handleAddCalendarEvent}
                                disabled={!newEventTitle.trim()}
                                className="btn-primary text-xs px-2 py-1 disabled:opacity-50"
                              >
                                Add
                              </button>
                            </div>
                            <div className="flex gap-1 flex-wrap">
                              {EVENT_COLORS.map((color) => (
                                <button
                                  key={color.value}
                                  type="button"
                                  onClick={() => setNewEventColor(color.value)}
                                  className={`w-4 h-4 rounded-full transition-all ${
                                    newEventColor === color.value
                                      ? 'ring-2 ring-offset-1 ring-gray-400 scale-110'
                                      : 'hover:scale-105'
                                  }`}
                                  style={{ backgroundColor: color.value }}
                                  title={color.name}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {!selectedCalendarDate && (
                        <p className="text-xs text-gray-500 text-center">Click a day to manage events</p>
                      )}
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
