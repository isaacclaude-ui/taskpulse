import { supabase } from './supabase';
import type { MemberWithRole, UserRole } from '@/types';

// Sign in with email and password
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

// Sign up with email and password
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  return { data, error };
}

// Sign out
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

// Get current user
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// Get current session
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Send password reset email
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { error };
}

// Check if email exists in members table (can login)
export async function isEmailAllowed(email: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('members')
    .select('email')
    .eq('email', email.toLowerCase())
    .single();

  return !error && !!data;
}

// Get member with role information
export async function getMemberWithRole(email: string): Promise<MemberWithRole | null> {
  const { data, error } = await supabase
    .from('members')
    .select('id, email, name, role, business_id')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !data) {
    return null;
  }

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    role: (data.role || 'user') as UserRole,
    business_id: data.business_id,
  };
}

// Check if user is an admin
export async function isAdmin(email: string): Promise<boolean> {
  const member = await getMemberWithRole(email);
  return member?.role === 'admin';
}

// Check if user is a lead or admin
export async function isLeadOrAdmin(email: string): Promise<boolean> {
  const member = await getMemberWithRole(email);
  return member?.role === 'admin' || member?.role === 'lead';
}

// Get teams for a member
export async function getMemberTeams(memberId: string) {
  const { data, error } = await supabase
    .from('member_teams')
    .select('team_id, teams(id, name, business_id)')
    .eq('member_id', memberId);

  if (error) {
    return [];
  }

  return data?.map(item => item.teams) || [];
}

// Request access to a business using join code
export async function requestAccess(email: string, joinCode?: string) {
  let businessId = null;

  // If join code provided, look up the business
  if (joinCode) {
    const { data: business, error: bizError } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('join_code', joinCode.toUpperCase().trim())
      .single();

    if (bizError || !business) {
      return { data: null, error: { message: 'Invalid business code', code: 'INVALID_CODE' } };
    }
    businessId = business.id;
  }

  const { data, error } = await supabase
    .from('pending_users')
    .insert({
      email: email.toLowerCase(),
      business_id: businessId,
      status: 'pending',
    })
    .select()
    .single();

  return { data, error };
}

// Get business by join code (for displaying business name)
export async function getBusinessByJoinCode(joinCode: string) {
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name')
    .eq('join_code', joinCode.toUpperCase().trim())
    .single();

  return { data, error };
}
