import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const ExpoSecureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

function buildClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      'Supabase env vars not set — auth features disabled. ' +
        'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env.'
    );
    return null;
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = buildClient();

// ── Shared types ──────────────────────────────────────────────────────────────

export interface IncidentStats {
  total_incidents: number;
  verified_incidents: number;
  incidents_this_month: number;
  incidents_this_week: number;
  total_fatalities: number;
  total_injuries: number;
  collision_count: number;
  near_miss_count: number;
  sudden_behavior_count: number;
  blockage_count: number;
  other_type_count: number;
  waymo_count: number;
  cruise_count: number;
  zoox_count: number;
  tesla_count: number;
  other_company_count: number;
  user_report_count: number;
  nhtsa_count: number;
  cpuc_count: number;
  dmv_count: number;
  last_updated: string;
}

export interface CompanyStats {
  av_company: string;
  total_incidents: number;
  collisions: number;
  near_misses: number;
  sudden_behaviors: number;
  blockages: number;
  total_fatalities: number;
  total_injuries: number;
}

export interface DailyCount {
  date: string;
  incident_type: string;
  incident_count: number;
}

// ── Query functions ───────────────────────────────────────────────────────────

function getClient() {
  if (!supabase) throw new Error('Supabase client not initialised');
  return supabase;
}

export async function fetchIncidentStats(): Promise<IncidentStats> {
  const { data, error } = await getClient()
    .from('incident_stats')
    .select('*')
    .single();
  if (error) throw error;
  return data as IncidentStats;
}

export async function fetchCompanyStats(): Promise<CompanyStats[]> {
  const { data, error } = await getClient()
    .from('company_stats')
    .select('*')
    .order('total_incidents', { ascending: false });
  if (error) throw error;
  return data as CompanyStats[];
}

export async function fetchDailyCounts(days = 30): Promise<DailyCount[]> {
  const start = new Date();
  start.setDate(start.getDate() - days);
  const { data, error } = await getClient()
    .from('daily_incident_counts')
    .select('date,incident_type,incident_count')
    .gte('date', start.toISOString().split('T')[0])
    .order('date', { ascending: true });
  if (error) throw error;
  return data as DailyCount[];
}
