import { createClient } from '@supabase/supabase-js';

// These values come from your .env.local file
// You'll get them when you create your Supabase project
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Create the connection to your database
// Note: Client will throw errors if used without proper env vars
export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null as unknown as ReturnType<typeof createClient>;
