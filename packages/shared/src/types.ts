// ---------------------------------------------------------------------------
// Incident types
// ---------------------------------------------------------------------------

export type IncidentType =
  | 'collision'
  | 'injury'
  | 'near_miss'
  | 'sudden_behavior'
  | 'blockage'
  | 'other';

export type AVCompany =
  | 'waymo'
  | 'cruise'
  | 'zoox'
  | 'tesla'
  | 'other'
  | 'unknown';

export type IncidentStatus = 'unverified' | 'corroborated' | 'verified' | 'rejected';

export type IncidentSource = 'user_report' | 'nhtsa' | 'cpuc' | 'dmv';

export interface Incident {
  id: string;
  incident_type: IncidentType;
  av_company: AVCompany | null;
  description: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  city: string;
  occurred_at: string;
  reported_at: string;
  reporter_type: string | null;
  status: IncidentStatus;
  source: IncidentSource;
  media_urls: string[];
  fatalities: number;
  injuries: number;
  external_id: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Stats (Supabase view format — used by both web and mobile via direct queries)
// ---------------------------------------------------------------------------

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
  other_incidents: number;
  fatalities: number;
  injuries: number;
}

export interface DailyCount {
  date: string;
  incident_count: number;
  incident_type?: string;
  av_company?: string | null;
  city?: string;
  fatalities?: number;
  injuries?: number;
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

// ---------------------------------------------------------------------------
// News
// ---------------------------------------------------------------------------

export interface NewsItem {
  title: string;
  url: string;
  source_name: string;
  /** ISO-8601 string or null */
  published_at: string | null;
  summary: string | null;
  image_url: string | null;
}

// ---------------------------------------------------------------------------
// API client request / response types
// ---------------------------------------------------------------------------

export interface IncidentFilters {
  incident_type?: string;
  av_company?: string;
  city?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  page?: number;
}

export interface IncidentListResponse {
  items: Incident[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface ReportPayload {
  incident_type: string;
  av_company: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  city?: string;
  occurred_at: string;
  reporter_type?: string;
}

export interface SubmitReportResponse {
  message: string;
  id: string;
  status: string;
}

export interface MonthlyDataPoint {
  month: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const INCIDENT_TYPE_LABELS: Record<IncidentType, string> = {
  collision: 'Collision',
  injury: 'Injury',
  near_miss: 'Near Miss',
  sudden_behavior: 'Sudden Behavior',
  blockage: 'Blockage',
  other: 'Other',
};

export const AV_COMPANY_LABELS: Record<string, string> = {
  waymo: 'Waymo',
  cruise: 'Cruise',
  zoox: 'Zoox',
  tesla: 'Tesla',
  other: 'Other',
  unknown: 'Unknown',
};

export const AV_COMPANY_COLORS: Record<string, string> = {
  waymo: '#1a73e8',
  cruise: '#ff6b35',
  zoox: '#7c3aed',
  tesla: '#e31937',
  other: '#6b7280',
  unknown: '#9ca3af',
};
