import { createClient } from '@supabase/supabase-js';

// Use placeholder values during build time if env vars are not set
// These pages are client-side only, so the real values will be used at runtime
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Incident {
  id: string;
  incident_type: 'collision' | 'near_miss' | 'sudden_behavior' | 'blockage' | 'other';
  av_company: 'waymo' | 'cruise' | 'zoox' | 'tesla' | 'other' | 'unknown' | null;
  description: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  city: string;
  occurred_at: string;
  reported_at: string;
  reporter_type: string | null;
  status: 'unverified' | 'corroborated' | 'verified' | 'rejected';
  source: 'user_report' | 'nhtsa' | 'cpuc' | 'dmv';
  media_urls: string[];
  fatalities: number;
  injuries: number;
  external_id: string | null;
  created_at: string;
}

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

export interface DataSource {
  id: string;
  name: string;
  url: string | null;
  description: string | null;
  last_synced_at: string | null;
  sync_frequency: string | null;
  records_count: number;
  is_active: boolean;
}

export interface DailyIncidentCount {
  date: string;
  incident_type: string;
  av_company: string | null;
  city: string;
  incident_count: number;
  fatalities: number;
  injuries: number;
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
  earliest_incident: string;
  latest_incident: string;
}

// API functions
export async function getIncidents(options?: {
  city?: string;
  incident_type?: string;
  av_company?: string;
  source?: string;
  limit?: number;
  offset?: number;
}) {
  let query = supabase
    .from('incidents')
    .select('*')
    .neq('status', 'rejected')
    .order('occurred_at', { ascending: false });

  if (options?.city) {
    query = query.eq('city', options.city);
  }
  if (options?.incident_type) {
    query = query.eq('incident_type', options.incident_type);
  }
  if (options?.av_company) {
    query = query.eq('av_company', options.av_company);
  }
  if (options?.source) {
    query = query.eq('source', options.source);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit || 20) - 1);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: data as Incident[], count };
}

export async function getIncidentStats() {
  const { data, error } = await supabase
    .from('incident_stats')
    .select('*')
    .single();

  if (error) throw error;
  return data as IncidentStats;
}

export async function getDailyIncidentCounts(options?: {
  days?: number;
  incident_type?: string;
  av_company?: string;
}) {
  const daysAgo = options?.days || 30;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysAgo);

  let query = supabase
    .from('daily_incident_counts')
    .select('*')
    .gte('date', startDate.toISOString().split('T')[0])
    .order('date', { ascending: true });

  if (options?.incident_type) {
    query = query.eq('incident_type', options.incident_type);
  }
  if (options?.av_company) {
    query = query.eq('av_company', options.av_company);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as DailyIncidentCount[];
}

export async function getCompanyStats() {
  const { data, error } = await supabase
    .from('company_stats')
    .select('*')
    .order('total_incidents', { ascending: false });

  if (error) throw error;
  return data as CompanyStats[];
}

export async function getDataSources() {
  const { data, error } = await supabase
    .from('data_sources')
    .select('*')
    .order('name');

  if (error) throw error;
  return data as DataSource[];
}

export async function createIncident(incident: {
  incident_type: string;
  av_company?: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  occurred_at: string;
  reporter_type?: string;
}) {
  // latitude and longitude are generated columns computed from location geometry
  // So we only insert the location field using PostGIS EWKT format
  const { data, error } = await supabase
    .from('incidents')
    .insert({
      incident_type: incident.incident_type,
      av_company: incident.av_company || 'unknown',
      description: incident.description,
      location: `SRID=4326;POINT(${incident.longitude} ${incident.latitude})`,
      address: incident.address,
      city: incident.city || 'San Francisco',
      occurred_at: incident.occurred_at,
      reporter_type: incident.reporter_type,
      source: 'user_report',
      status: 'unverified',
      media_urls: [],
    })
    .select()
    .single();

  if (error) {
    console.error('Supabase insert error:', error);
    throw error;
  }
  return data as Incident;
}

export async function getRecentIncidents(limit = 5) {
  const { data, error } = await supabase
    .from('incidents')
    .select('*')
    .neq('status', 'rejected')
    .order('occurred_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data as Incident[];
}

