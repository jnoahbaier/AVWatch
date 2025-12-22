/**
 * API client for AV Watch backend
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface Incident {
  id: string;
  incident_type: 'collision' | 'near_miss' | 'sudden_behavior' | 'blockage' | 'other';
  av_company: 'waymo' | 'cruise' | 'zoox' | 'tesla' | 'other' | 'unknown';
  description?: string;
  latitude: number;
  longitude: number;
  address?: string;
  city: string;
  occurred_at: string;
  reported_at: string;
  reporter_type?: string;
  status: 'unverified' | 'corroborated' | 'verified' | 'rejected';
  source: 'user_report' | 'nhtsa' | 'cpuc' | 'dmv';
  media_urls: string[];
}

export interface IncidentCreate {
  incident_type: string;
  av_company?: string;
  description?: string;
  location: {
    latitude: number;
    longitude: number;
    address?: string;
  };
  occurred_at: string;
  reporter_type?: string;
}

export interface IncidentFilters {
  incident_type?: string;
  av_company?: string;
  city?: string;
  start_date?: string;
  end_date?: string;
  min_lat?: number;
  max_lat?: number;
  min_lng?: number;
  max_lng?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface OverviewStats {
  total_incidents: number;
  by_type: Record<string, number>;
  by_company: Record<string, number>;
  by_source: Record<string, number>;
  period: {
    start?: string;
    end?: string;
  };
}

class APIClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async fetch<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.detail || `API Error: ${response.status}`);
    }

    return response.json();
  }

  // Incidents
  async createIncident(data: IncidentCreate): Promise<{ id: string }> {
    return this.fetch('/api/incidents/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getIncidents(
    page = 1,
    pageSize = 20,
    filters: IncidentFilters = {}
  ): Promise<PaginatedResponse<Incident>> {
    const params = new URLSearchParams({
      page: page.toString(),
      page_size: pageSize.toString(),
      ...Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined)
      ),
    });
    return this.fetch(`/api/incidents/?${params}`);
  }

  async getIncidentsGeoJSON(
    filters: IncidentFilters = {}
  ): Promise<GeoJSON.FeatureCollection> {
    const params = new URLSearchParams(
      Object.fromEntries(
        Object.entries(filters)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )
    );
    return this.fetch(`/api/incidents/geojson?${params}`);
  }

  async getIncident(id: string): Promise<Incident> {
    return this.fetch(`/api/incidents/${id}`);
  }

  async uploadMedia(
    incidentId: string,
    files: File[]
  ): Promise<{ message: string }> {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    const response = await fetch(
      `${this.baseUrl}/api/incidents/${incidentId}/media`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      throw new Error('Failed to upload media');
    }

    return response.json();
  }

  // Analytics
  async getOverviewStats(filters: {
    city?: string;
    start_date?: string;
    end_date?: string;
  } = {}): Promise<OverviewStats> {
    const params = new URLSearchParams(
      Object.fromEntries(
        Object.entries(filters)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )
    );
    return this.fetch(`/api/data/stats/overview?${params}`);
  }

  async getTimeseriesStats(filters: {
    granularity?: 'day' | 'week' | 'month';
    city?: string;
    av_company?: string;
    incident_type?: string;
    start_date?: string;
    end_date?: string;
  } = {}): Promise<{ granularity: string; data: any[] }> {
    const params = new URLSearchParams(
      Object.fromEntries(
        Object.entries(filters)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )
    );
    return this.fetch(`/api/data/stats/timeseries?${params}`);
  }

  async getHeatmapData(filters: IncidentFilters = {}): Promise<{
    points: Array<{ lat: number; lng: number; weight: number }>;
  }> {
    const params = new URLSearchParams(
      Object.fromEntries(
        Object.entries(filters)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )
    );
    return this.fetch(`/api/data/stats/heatmap?${params}`);
  }

  // Health
  async healthCheck(): Promise<{ status: string }> {
    return this.fetch('/health');
  }
}

export const api = new APIClient(API_BASE_URL);

