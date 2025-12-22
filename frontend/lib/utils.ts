import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date for display
 */
export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

/**
 * Format a relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 30) {
    return formatDate(date);
  } else if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHours > 0) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  } else if (diffMins > 0) {
    return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

/**
 * Incident type display names
 */
export const INCIDENT_TYPE_LABELS: Record<string, string> = {
  collision: 'Collision',
  near_miss: 'Near Miss',
  sudden_behavior: 'Sudden Behavior',
  blockage: 'Blockage',
  other: 'Other',
};

/**
 * AV company display names
 */
export const AV_COMPANY_LABELS: Record<string, string> = {
  waymo: 'Waymo',
  cruise: 'Cruise',
  zoox: 'Zoox',
  tesla: 'Tesla',
  nuro: 'Nuro',
  aurora: 'Aurora',
  motional: 'Motional',
  mercedes: 'Mercedes-Benz',
  apple: 'Apple',
  other: 'Other',
  unknown: 'Unknown',
};

/**
 * Reporter type display names
 */
export const REPORTER_TYPE_LABELS: Record<string, string> = {
  pedestrian: 'Pedestrian',
  cyclist: 'Cyclist',
  driver: 'Driver',
  rider: 'Rider',
  other: 'Other',
};

/**
 * Incident type colors for map markers
 */
export const INCIDENT_TYPE_COLORS: Record<string, string> = {
  collision: '#ef4444',
  near_miss: '#f97316',
  sudden_behavior: '#eab308',
  blockage: '#6366f1',
  other: '#64748b',
};

/**
 * AV company colors
 */
export const AV_COMPANY_COLORS: Record<string, string> = {
  waymo: '#4285f4',
  cruise: '#ff6b35',
  zoox: '#00d4aa',
  tesla: '#cc0000',
  nuro: '#6366f1',
  aurora: '#8b5cf6',
  motional: '#0ea5e9',
  mercedes: '#00adef',
  apple: '#a3a3a3',
  other: '#94a3b8',
  unknown: '#94a3b8',
};

/**
 * Data source display names and colors
 */
export const DATA_SOURCE_LABELS: Record<string, string> = {
  nhtsa: 'NHTSA',
  dmv: 'CA DMV',
  cpuc: 'CPUC',
  user_report: 'Community',
};

export const DATA_SOURCE_COLORS: Record<string, string> = {
  nhtsa: '#1e40af',
  dmv: '#7c3aed',
  cpuc: '#0891b2',
  user_report: '#16a34a',
};

