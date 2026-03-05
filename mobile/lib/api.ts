const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000';

export interface Incident {
  id: string;
  incident_type: string;
  av_company: string;
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  city: string;
  occurred_at: string;
  reported_at: string;
  reporter_type?: string;
  status: string;
  source: string;
  media_urls: string[];
}

export interface IncidentStats {
  total: number;
  thisMonth: number;
  byType: Record<string, number>;
  byCompany: Record<string, number>;
  bySource: Record<string, number>;
  trend: number;
}

export interface MonthlyDataPoint {
  month: string;
  count: number;
}

export interface IncidentFilters {
  incident_type?: string;
  av_company?: string;
  city?: string;
  start_date?: string;
  end_date?: string;
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

async function fetchJSON<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options,
    });
    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export interface IncidentListResponse {
  items: Incident[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export async function getIncidents(
  filters?: IncidentFilters & { limit?: number }
): Promise<IncidentListResponse> {
  const params = new URLSearchParams();
  if (filters?.limit) params.set('page_size', String(filters.limit));
  if (filters?.incident_type) params.set('incident_type', filters.incident_type);
  if (filters?.av_company) params.set('av_company', filters.av_company);
  if (filters?.start_date) params.set('start_date', filters.start_date);
  if (filters?.end_date) params.set('end_date', filters.end_date);

  const query = params.toString();
  return fetchJSON(`/api/incidents${query ? `?${query}` : ''}`);
}

export async function getIncidentStats(): Promise<IncidentStats> {
  return fetchJSON('/api/data/stats');
}

export async function getMonthlyTrend(): Promise<MonthlyDataPoint[]> {
  return fetchJSON('/api/data/trend');
}

export async function submitReport(payload: ReportPayload): Promise<SubmitReportResponse> {
  return fetchJSON('/api/incidents', {
    method: 'POST',
    body: JSON.stringify({
      incident_type: payload.incident_type,
      av_company: payload.av_company,
      description: payload.description,
      occurred_at: payload.occurred_at,
      reporter_type: payload.reporter_type,
      location: {
        latitude: payload.latitude,
        longitude: payload.longitude,
        address: payload.address,
      },
    }),
  });
}
