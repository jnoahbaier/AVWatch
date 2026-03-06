export const INCIDENT_TYPE_LABELS: Record<string, string> = {
  collision: 'Collision',
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

export const REPORTER_TYPE_LABELS: Record<string, string> = {
  pedestrian: 'Pedestrian',
  cyclist: 'Cyclist',
  driver: 'Driver',
  rider: 'Rider',
  other: 'Other',
};

export const DATA_SOURCE_LABELS: Record<string, string> = {
  user_report: 'Community',
  nhtsa: 'NHTSA',
  cpuc: 'CPUC',
  dmv: 'CA DMV',
};

export const INCIDENT_TYPE_COLORS: Record<string, string> = {
  collision: '#dc2626',
  near_miss: '#f97316',
  sudden_behavior: '#eab308',
  blockage: '#3b82f6',
  other: '#64748b',
};

export const COMPANY_COLORS: Record<string, string> = {
  waymo: '#3b82f6',
  cruise: '#f97316',
  zoox: '#8b5cf6',
  tesla: '#ef4444',
  other: '#64748b',
  unknown: '#94a3b8',
};
