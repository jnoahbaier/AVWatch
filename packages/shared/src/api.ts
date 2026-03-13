/**
 * Platform-agnostic API client factory.
 * Uses the native `fetch` API which is available in both Next.js and React Native/Expo.
 */

import type {
  NewsItem,
  Incident,
  IncidentFilters,
  IncidentListResponse,
  ReportPayload,
  SubmitReportResponse,
  MonthlyDataPoint,
} from './types';

async function fetchJSON<T>(
  baseUrl: string,
  path: string,
  options?: RequestInit
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      ...options,
    });
    if (!res.ok) {
      throw new Error(`API error: ${res.status} ${res.statusText}`);
    }
    return res.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

export interface AVWatchApiClient {
  getNews(limit?: number): Promise<NewsItem[]>;
  getIncidents(filters?: IncidentFilters): Promise<IncidentListResponse>;
  getIncident(id: string): Promise<Incident>;
  getMonthlyTrend(): Promise<MonthlyDataPoint[]>;
  submitReport(payload: ReportPayload): Promise<SubmitReportResponse>;
}

export function createApiClient(baseUrl: string): AVWatchApiClient {
  const get = <T>(path: string) => fetchJSON<T>(baseUrl, path);
  const post = <T>(path: string, body: unknown) =>
    fetchJSON<T>(baseUrl, path, { method: 'POST', body: JSON.stringify(body) });

  return {
    getNews(limit = 20): Promise<NewsItem[]> {
      return get<NewsItem[]>(`/api/news/?limit=${limit}`);
    },

    getIncidents(filters?: IncidentFilters): Promise<IncidentListResponse> {
      const params = new URLSearchParams();
      if (filters?.limit) params.set('page_size', String(filters.limit));
      if (filters?.page) params.set('page', String(filters.page));
      if (filters?.incident_type) params.set('incident_type', filters.incident_type);
      if (filters?.av_company) params.set('av_company', filters.av_company);
      if (filters?.city) params.set('city', filters.city);
      if (filters?.start_date) params.set('start_date', filters.start_date);
      if (filters?.end_date) params.set('end_date', filters.end_date);
      const qs = params.toString();
      return get<IncidentListResponse>(`/api/incidents/${qs ? `?${qs}` : ''}`);
    },

    getIncident(id: string): Promise<Incident> {
      return get<Incident>(`/api/incidents/${id}`);
    },

    getMonthlyTrend(): Promise<MonthlyDataPoint[]> {
      return get<MonthlyDataPoint[]>('/api/data/trend');
    },

    submitReport(payload: ReportPayload): Promise<SubmitReportResponse> {
      return post<SubmitReportResponse>('/api/incidents/', {
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
      });
    },
  };
}
