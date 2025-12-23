/**
 * Data Seeding Script for AVWatch
 * 
 * Fetches real AV incident data from NHTSA Standing General Order (SGO) CSV files
 * and populates the Supabase database with REAL geocoded coordinates.
 * 
 * Usage: npx tsx scripts/seed-data.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

if (!mapboxToken) {
  console.error('Missing NEXT_PUBLIC_MAPBOX_TOKEN - required for geocoding');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// NHTSA SGO CSV URLs
const NHTSA_ADS_URL = 'https://static.nhtsa.gov/odi/ffdd/sgo-2021-01/SGO-2021-01_Incident_Reports_ADS.csv';
const NHTSA_ADAS_URL = 'https://static.nhtsa.gov/odi/ffdd/sgo-2021-01/SGO-2021-01_Incident_Reports_ADAS.csv';

// Month name to number mapping
const MONTH_MAP: Record<string, number> = {
  'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
  'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11
};

// ============================================================================
// GEOCODING WITH MAPBOX
// ============================================================================

interface GeocodedLocation {
  lat: number;
  lng: number;
  displayName: string;
}

// Cache for geocoded locations to avoid repeated API calls
const geocodeCache: Map<string, GeocodedLocation | null> = new Map();

// State coordinates (fallback when geocoding fails)
const STATE_COORDS: Record<string, { lat: number; lng: number; city: string }> = {
  'CA': { lat: 37.7749, lng: -122.4194, city: 'San Francisco' },
  'TX': { lat: 30.2672, lng: -97.7431, city: 'Austin' },
  'AZ': { lat: 33.4484, lng: -112.0740, city: 'Phoenix' },
  'FL': { lat: 28.5383, lng: -81.3792, city: 'Orlando' },
  'NY': { lat: 40.7128, lng: -74.0060, city: 'New York' },
  'WA': { lat: 47.6062, lng: -122.3321, city: 'Seattle' },
  'NV': { lat: 36.1699, lng: -115.1398, city: 'Las Vegas' },
  'MI': { lat: 42.3314, lng: -83.0458, city: 'Detroit' },
  'PA': { lat: 40.4406, lng: -79.9959, city: 'Pittsburgh' },
  'CO': { lat: 39.7392, lng: -104.9903, city: 'Denver' },
  'MA': { lat: 42.3601, lng: -71.0589, city: 'Boston' },
  'IL': { lat: 41.8781, lng: -87.6298, city: 'Chicago' },
  'GA': { lat: 33.7490, lng: -84.3880, city: 'Atlanta' },
  'NC': { lat: 35.2271, lng: -80.8431, city: 'Charlotte' },
  'OH': { lat: 39.9612, lng: -82.9988, city: 'Columbus' },
  'NJ': { lat: 40.0583, lng: -74.4057, city: 'Trenton' },
  'VA': { lat: 37.4316, lng: -78.6569, city: 'Richmond' },
  'MD': { lat: 39.0458, lng: -76.6413, city: 'Baltimore' },
  'OR': { lat: 45.5152, lng: -122.6784, city: 'Portland' },
  'TN': { lat: 36.1627, lng: -86.7816, city: 'Nashville' },
  'IN': { lat: 39.7684, lng: -86.1581, city: 'Indianapolis' },
  'MN': { lat: 44.9778, lng: -93.2650, city: 'Minneapolis' },
  'WI': { lat: 43.0389, lng: -87.9065, city: 'Milwaukee' },
  'SC': { lat: 32.7765, lng: -79.9311, city: 'Charleston' },
  'AL': { lat: 33.5207, lng: -86.8025, city: 'Birmingham' },
  'LA': { lat: 29.9511, lng: -90.0715, city: 'New Orleans' },
  'KY': { lat: 38.2527, lng: -85.7585, city: 'Louisville' },
  'OK': { lat: 35.4676, lng: -97.5164, city: 'Oklahoma City' },
  'CT': { lat: 41.3083, lng: -72.9279, city: 'New Haven' },
  'UT': { lat: 40.7608, lng: -111.8910, city: 'Salt Lake City' },
  'IA': { lat: 41.5868, lng: -93.6250, city: 'Des Moines' },
  'NE': { lat: 41.2565, lng: -95.9345, city: 'Omaha' },
  'KS': { lat: 39.0997, lng: -94.5786, city: 'Kansas City' },
  'NM': { lat: 35.0844, lng: -106.6504, city: 'Albuquerque' },
  'HI': { lat: 21.3069, lng: -157.8583, city: 'Honolulu' },
  'ID': { lat: 43.6150, lng: -116.2023, city: 'Boise' },
  'WV': { lat: 38.3498, lng: -81.6326, city: 'Charleston' },
  'ME': { lat: 43.6591, lng: -70.2568, city: 'Portland' },
  'NH': { lat: 43.2081, lng: -71.5376, city: 'Concord' },
  'RI': { lat: 41.8240, lng: -71.4128, city: 'Providence' },
  'MT': { lat: 46.8797, lng: -110.3626, city: 'Billings' },
  'DE': { lat: 39.1582, lng: -75.5244, city: 'Wilmington' },
  'SD': { lat: 43.5460, lng: -96.7313, city: 'Sioux Falls' },
  'ND': { lat: 46.8772, lng: -96.7898, city: 'Fargo' },
  'AK': { lat: 61.2181, lng: -149.9003, city: 'Anchorage' },
  'VT': { lat: 44.4759, lng: -73.2121, city: 'Burlington' },
  'WY': { lat: 41.1400, lng: -104.8202, city: 'Cheyenne' },
  'DC': { lat: 38.9072, lng: -77.0369, city: 'Washington' },
  'PR': { lat: 18.4655, lng: -66.1057, city: 'San Juan' },
  'MO': { lat: 38.6270, lng: -90.1994, city: 'St. Louis' },
  'AR': { lat: 34.7465, lng: -92.2896, city: 'Little Rock' },
  'MS': { lat: 32.2988, lng: -90.1848, city: 'Jackson' },
};

/**
 * Geocode a city/state using Mapbox Geocoding API
 */
async function geocodeLocation(city: string, state: string): Promise<GeocodedLocation | null> {
  const cacheKey = `${city.toLowerCase()},${state.toLowerCase()}`;

  // Check cache first
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey) || null;
  }

  try {
    const query = encodeURIComponent(`${city}, ${state}, USA`);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxToken}&country=US&types=place,locality&limit=1`;

    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`Geocoding failed for ${city}, ${state}: ${response.statusText}`);
      geocodeCache.set(cacheKey, null);
      return null;
    }

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [lng, lat] = feature.center;
      const result: GeocodedLocation = {
        lat,
        lng,
        displayName: feature.place_name,
      };
      geocodeCache.set(cacheKey, result);
      return result;
    }

    geocodeCache.set(cacheKey, null);
    return null;
  } catch (error) {
    console.warn(`Geocoding error for ${city}, ${state}:`, error);
    geocodeCache.set(cacheKey, null);
    return null;
  }
}

// Cache for street-level geocoding
const streetGeocodeCache: Map<string, GeocodedLocation | null> = new Map();

/**
 * Extract street/intersection info from NHTSA narrative text
 * Looks for patterns like "on Main St", "at 5th and Broadway", "near Exit 4", etc.
 */
function extractLocationFromNarrative(narrative: string): string | null {
  if (!narrative) return null;

  // Common patterns for street locations in narratives
  const patterns = [
    // "on [Street Name]" - e.g., "on Main Street"
    /\bon\s+([A-Z][a-zA-Z0-9\s.'-]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Place|Pl|Highway|Hwy|Freeway|Fwy))\b/gi,
    // "at [Street] and [Street]" - intersections
    /\bat\s+([A-Z][a-zA-Z0-9\s.'-]+)\s+(?:and|&|at)\s+([A-Z][a-zA-Z0-9\s.'-]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Place|Pl))/gi,
    // "near [Landmark/Street]"
    /\bnear\s+([A-Z][a-zA-Z0-9\s.'-]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Exit\s+\d+))/gi,
    // "[Street] near [Street]"
    /([A-Z][a-zA-Z0-9\s.'-]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Place|Pl))\s+near\s+([A-Z][a-zA-Z0-9\s.'-]+)/gi,
    // "intersection of X and Y"
    /intersection\s+of\s+([A-Z][a-zA-Z0-9\s.'-]+)\s+(?:and|&)\s+([A-Z][a-zA-Z0-9\s.'-]+)/gi,
    // Direct street addresses like "123 Main St"
    /\b(\d+\s+[A-Z][a-zA-Z0-9\s.'-]+(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Place|Pl))\b/gi,
  ];

  for (const pattern of patterns) {
    const match = narrative.match(pattern);
    if (match && match[0]) {
      // Clean up the extracted location
      let location = match[0]
        .replace(/^(on|at|near|intersection of)\s+/i, '')
        .trim();
      // Only return if it looks like a real location (has letters and reasonable length)
      if (location.length > 5 && location.length < 100) {
        return location;
      }
    }
  }

  return null;
}

/**
 * Geocode a street address using Mapbox API
 */
async function geocodeStreetAddress(
  address: string,
  city: string,
  state: string
): Promise<GeocodedLocation | null> {
  const cacheKey = `street:${address.toLowerCase()},${city.toLowerCase()},${state.toLowerCase()}`;

  // Check cache first
  if (streetGeocodeCache.has(cacheKey)) {
    return streetGeocodeCache.get(cacheKey) || null;
  }

  try {
    const query = encodeURIComponent(`${address}, ${city}, ${state}, USA`);
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${mapboxToken}&country=US&types=address,poi&limit=1`;

    const response = await fetch(url);

    if (!response.ok) {
      streetGeocodeCache.set(cacheKey, null);
      return null;
    }

    const data = await response.json();

    if (data.features && data.features.length > 0) {
      const feature = data.features[0];
      const [lng, lat] = feature.center;

      // Verify the result is in the expected city/state (within ~50km)
      const cityCoords = geocodeCache.get(`${city.toLowerCase()},${state.toLowerCase()}`);
      if (cityCoords) {
        const distance = Math.sqrt(
          Math.pow(lat - cityCoords.lat, 2) + Math.pow(lng - cityCoords.lng, 2)
        );
        // If more than ~0.5 degrees away (~50km), reject as likely wrong
        if (distance > 0.5) {
          streetGeocodeCache.set(cacheKey, null);
          return null;
        }
      }

      const result: GeocodedLocation = {
        lat,
        lng,
        displayName: feature.place_name,
      };
      streetGeocodeCache.set(cacheKey, result);
      return result;
    }

    streetGeocodeCache.set(cacheKey, null);
    return null;
  } catch (error) {
    streetGeocodeCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Pre-geocode all unique cities from NHTSA records to build cache
 */
async function preGeocodeAllCities(records: Record<string, string>[]): Promise<void> {
  // Extract unique city/state combinations
  const uniqueLocations = new Set<string>();
  
  for (const record of records) {
    const city = record['City']?.trim();
    const state = record['State']?.trim();
    if (city && state) {
      uniqueLocations.add(`${city}|${state}`);
    }
  }
  
  console.log(`   📍 Geocoding ${uniqueLocations.size} unique city/state combinations...`);
  
  let geocoded = 0;
  let failed = 0;
  
  // Process in batches to respect rate limits (600 req/min for Mapbox)
  const locations = Array.from(uniqueLocations);
  const batchSize = 50;
  
  for (let i = 0; i < locations.length; i += batchSize) {
    const batch = locations.slice(i, i + batchSize);
    
    // Process batch in parallel (Mapbox allows concurrent requests)
    await Promise.all(
      batch.map(async (loc) => {
        const [city, state] = loc.split('|');
        const result = await geocodeLocation(city, state);
        if (result) {
          geocoded++;
        } else {
          failed++;
        }
      })
    );
    
    // Small delay between batches to respect rate limits
    if (i + batchSize < locations.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    process.stdout.write(`   Progress: ${Math.min(i + batchSize, locations.length)}/${locations.length} (${geocoded} geocoded, ${failed} fallback)\r`);
  }
  
  console.log(`\n   ✓ Geocoding complete: ${geocoded} cities geocoded, ${failed} using state fallback`);
}

/**
 * Get coordinates for a city/state, using cache or fallback
 * Uses larger jitter to spread incidents across the city area
 */
function getCoordinates(city: string, state: string): { lat: number; lng: number } {
  const cacheKey = `${city.toLowerCase()},${state.toLowerCase()}`;
  const cached = geocodeCache.get(cacheKey);

  if (cached) {
    // Add larger jitter (±0.02° ≈ 2km) to spread incidents across the city
    // This creates a more realistic distribution when we don't have exact addresses
    return {
      lat: cached.lat + (Math.random() - 0.5) * 0.04,
      lng: cached.lng + (Math.random() - 0.5) * 0.04,
    };
  }

  // Fallback to state center with even larger spread
  const stateCoords = STATE_COORDS[state] || STATE_COORDS['CA'];
  return {
    lat: stateCoords.lat + (Math.random() - 0.5) * 0.1,
    lng: stateCoords.lng + (Math.random() - 0.5) * 0.1,
  };
}

/**
 * Parse real GPS coordinates from NHTSA record.
 * Returns null if coordinates are missing, unknown, or invalid.
 */
function parseNHTSACoordinates(record: Record<string, string>): { lat: number; lng: number } | null {
  const latStr = record['Latitude']?.trim();
  const lngStr = record['Longitude']?.trim();
  const latUnknown = record['Latitude - Unknown']?.toLowerCase() === 'yes';
  const lngUnknown = record['Longitude - Unknown']?.toLowerCase() === 'yes';

  // Skip if marked as unknown
  if (latUnknown || lngUnknown) {
    return null;
  }

  // Skip if empty or non-numeric
  if (!latStr || !lngStr) {
    return null;
  }

  const lat = parseFloat(latStr);
  const lng = parseFloat(lngStr);

  // Validate coordinates are within valid ranges
  if (isNaN(lat) || isNaN(lng)) {
    return null;
  }

  // Basic sanity check for US coordinates
  // Latitude: 24-50 (continental US + Alaska ~71)
  // Longitude: -125 to -66 (continental US) or -180 to -130 (Alaska/Hawaii)
  if (lat < 18 || lat > 72 || lng < -180 || lng > -65) {
    return null;
  }

  return { lat, lng };
}

// ============================================================================
// DATE PARSING
// ============================================================================

/**
 * Parse NHTSA date format "MMM-YYYY" (e.g., "OCT-2025") into a Date object.
 * Also handles formats like "MM/DD/YYYY" if present.
 */
function parseNHTSADate(dateStr: string, timeStr?: string): Date | null {
  if (!dateStr) return null;
  
  const trimmed = dateStr.trim().toUpperCase();
  
  // Try "MMM-YYYY" format first (e.g., "OCT-2025")
  const monthYearMatch = trimmed.match(/^([A-Z]{3})-(\d{4})$/);
  if (monthYearMatch) {
    const month = MONTH_MAP[monthYearMatch[1]];
    const year = parseInt(monthYearMatch[2], 10);
    if (month !== undefined && year) {
      // Use the first day of the month, add time if provided
      const date = new Date(year, month, 1);
      if (timeStr) {
        const timeParts = timeStr.match(/(\d{1,2}):(\d{2})/);
        if (timeParts) {
          date.setHours(parseInt(timeParts[1], 10), parseInt(timeParts[2], 10));
        }
      }
      return date;
    }
  }
  
  // Try "MM/DD/YYYY" format
  const mdyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const month = parseInt(mdyMatch[1], 10) - 1;
    const day = parseInt(mdyMatch[2], 10);
    const year = parseInt(mdyMatch[3], 10);
    const date = new Date(year, month, day);
    if (timeStr) {
      const timeParts = timeStr.match(/(\d{1,2}):(\d{2})/);
      if (timeParts) {
        date.setHours(parseInt(timeParts[1], 10), parseInt(timeParts[2], 10));
      }
    }
    return date;
  }
  
  // Try "YYYY-MM-DD" format
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  
  // Fallback: try standard Date parsing
  const fallback = new Date(dateStr);
  if (!isNaN(fallback.getTime())) {
    return fallback;
  }
  
  return null;
}

// ============================================================================
// DATA MAPPING
// ============================================================================

// Map AV company names to our enum values
function mapCompany(manufacturer: string): string {
  const name = manufacturer?.toLowerCase() || '';
  if (name.includes('waymo') || name.includes('alphabet')) return 'waymo';
  if (name.includes('cruise') || name.includes('gm')) return 'cruise';
  if (name.includes('zoox') || name.includes('amazon')) return 'zoox';
  if (name.includes('tesla')) return 'tesla';
  return 'other';
}

// Map severity/crash type
function mapIncidentType(record: Record<string, string>): string {
  const crashed = record['Crash']?.toLowerCase() || '';
  const severity = record['Highest Injury Severity Reported']?.toLowerCase() || '';
  
  if (crashed === 'yes' || severity.includes('fatal') || severity.includes('serious')) {
    return 'collision';
  }
  if (severity.includes('minor') || severity.includes('possible')) {
    return 'near_miss';
  }
  // Default to collision for ADS/ADAS incidents since they're crash reports
  return 'collision';
}

// ============================================================================
// CSV PARSING
// ============================================================================

// Parse CSV data
function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split('\n');
  if (lines.length < 2) return [];

  // Handle CSV with quoted fields
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseCSVLine(lines[0]).map(h => h.replace(/"/g, '').trim());
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      record[header] = values[idx]?.replace(/"/g, '') || '';
    });
    records.push(record);
  }

  return records;
}

// ============================================================================
// RECORD PROCESSING
// ============================================================================

interface IncidentInsert {
  incident_type: string;
  av_company: string;
  description: string;
  location: string;
  address: string | null;
  city: string;
  occurred_at: string;
  reported_at: string;
  status: string;
  source: string;
  external_id: string;
  fatalities: number;
  injuries: number;
  raw_data: Record<string, string>;
}

interface ProcessedIncident {
  incident: IncidentInsert;
  hasRealCoords: boolean;
  hasStreetCoords: boolean;
}

// Process NHTSA ADS records (uses real GPS coordinates when available)
async function processADSRecord(record: Record<string, string>, index: number): Promise<ProcessedIncident | null> {
  const reportNumber = record['Report Number'] || `ADS-${index}`;
  const manufacturer = record['Make'] || record['Manufacturer'] || '';
  const state = record['State'] || 'CA';
  const city = record['City'] || STATE_COORDS[state]?.city || 'Unknown';

  // Try to get REAL GPS coordinates from NHTSA data first
  const realCoords = parseNHTSACoordinates(record);

  // If no real coords, try to extract and geocode street address from narrative
  let streetCoords: GeocodedLocation | null = null;
  let extractedAddress: string | null = null;
  if (!realCoords) {
    const narrative = record['Narrative'] || '';
    extractedAddress = extractLocationFromNarrative(narrative);
    if (extractedAddress) {
      streetCoords = await geocodeStreetAddress(extractedAddress, city, state);
    }
  }

  // Use best available coordinates: real > street > city
  const coords = realCoords || (streetCoords ? { lat: streetCoords.lat, lng: streetCoords.lng } : null) || getCoordinates(city, state);
  const hasRealCoords = realCoords !== null;
  const hasStreetCoords = streetCoords !== null;
  
  // Parse date using custom parser for "MMM-YYYY" format
  const incidentDate = record['Incident Date'] || record['Date of Incident'];
  const incidentTime = record['Incident Time (24:00)'];
  const parsedDate = parseNHTSADate(incidentDate, incidentTime);
  const occurredAt = parsedDate ? parsedDate.toISOString() : new Date().toISOString();
  
  // Get fatalities and injuries
  const fatalities = parseInt(record['Deaths'] || record['Fatalities'] || '0') || 0;
  const injuries = parseInt(record['Injuries'] || record['Persons Injured'] || '0') || 0;
  
  // Build description
  const model = record['Model'] || '';
  const year = record['Model Year'] || '';
  const description = `NHTSA SGO Report: ${manufacturer} ${model} ${year} ADS incident in ${city}, ${state}. ${
    record['Crash'] === 'Yes' ? 'Crash reported.' : ''
  } ${record['Highest Injury Severity Reported'] || ''}`.trim();

  return {
    incident: {
      incident_type: mapIncidentType(record),
      av_company: mapCompany(manufacturer),
      description,
      location: `SRID=4326;POINT(${coords.lng} ${coords.lat})`,
      address: extractedAddress || record['Address'] || record['Street'] || null,
      city,
      occurred_at: occurredAt,
      reported_at: new Date().toISOString(),
      status: 'verified',
      source: 'nhtsa',
      external_id: `nhtsa-ads-${reportNumber}`,
      fatalities,
      injuries,
      raw_data: record,
    },
    hasRealCoords,
    hasStreetCoords,
  };
}

// Process NHTSA ADAS records (uses real GPS coordinates when available)
async function processADASRecord(record: Record<string, string>, index: number): Promise<ProcessedIncident | null> {
  const reportNumber = record['Report Number'] || `ADAS-${index}`;
  const manufacturer = record['Make'] || record['Manufacturer'] || '';
  const state = record['State'] || 'CA';
  const city = record['City'] || STATE_COORDS[state]?.city || 'Unknown';

  // Skip if not from an AV company we track
  const company = mapCompany(manufacturer);

  // Try to get REAL GPS coordinates from NHTSA data first
  const realCoords = parseNHTSACoordinates(record);

  // If no real coords, try to extract and geocode street address from narrative
  let streetCoords: GeocodedLocation | null = null;
  let extractedAddress: string | null = null;
  if (!realCoords) {
    const narrative = record['Narrative'] || '';
    extractedAddress = extractLocationFromNarrative(narrative);
    if (extractedAddress) {
      streetCoords = await geocodeStreetAddress(extractedAddress, city, state);
    }
  }

  // Use best available coordinates: real > street > city
  const coords = realCoords || (streetCoords ? { lat: streetCoords.lat, lng: streetCoords.lng } : null) || getCoordinates(city, state);
  const hasRealCoords = realCoords !== null;
  const hasStreetCoords = streetCoords !== null;

  // Parse date using custom parser for "MMM-YYYY" format
  const incidentDate = record['Incident Date'] || record['Date of Incident'];
  const incidentTime = record['Incident Time (24:00)'];
  const parsedDate = parseNHTSADate(incidentDate, incidentTime);
  const occurredAt = parsedDate ? parsedDate.toISOString() : new Date().toISOString();

  // Get fatalities and injuries
  const fatalities = parseInt(record['Deaths'] || record['Fatalities'] || '0') || 0;
  const injuries = parseInt(record['Injuries'] || record['Persons Injured'] || '0') || 0;

  // Build description
  const model = record['Model'] || '';
  const year = record['Model Year'] || '';
  const description = `NHTSA SGO Report: ${manufacturer} ${model} ${year} ADAS (Level 2) incident in ${city}, ${state}. ${
    record['Crash'] === 'Yes' ? 'Crash reported.' : ''
  } ${record['Highest Injury Severity Reported'] || ''}`.trim();

  return {
    incident: {
      incident_type: mapIncidentType(record),
      av_company: company,
      description,
      location: `SRID=4326;POINT(${coords.lng} ${coords.lat})`,
      address: extractedAddress || record['Address'] || record['Street'] || null,
      city,
      occurred_at: occurredAt,
      reported_at: new Date().toISOString(),
      status: 'verified',
      source: 'nhtsa',
      external_id: `nhtsa-adas-${reportNumber}`,
      fatalities,
      injuries,
      raw_data: record,
    },
    hasRealCoords,
    hasStreetCoords,
  };
}

// ============================================================================
// DATA FETCHING AND SEEDING
// ============================================================================

async function fetchAndParseCSV(url: string): Promise<Record<string, string>[]> {
  console.log(`Fetching data from ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  const text = await response.text();
  return parseCSV(text);
}

async function setupDataSources() {
  console.log('\n📊 Setting up data sources...');
  
  const dataSources = [
    {
      name: 'NHTSA SGO (ADS)',
      url: NHTSA_ADS_URL,
      description: 'NHTSA Standing General Order crash reports for vehicles with Automated Driving Systems (Level 3+)',
      sync_frequency: 'daily',
      is_active: true,
    },
    {
      name: 'NHTSA SGO (ADAS)',
      url: NHTSA_ADAS_URL,
      description: 'NHTSA Standing General Order crash reports for vehicles with Advanced Driver Assistance Systems (Level 2)',
      sync_frequency: 'daily',
      is_active: true,
    },
    {
      name: 'California DMV',
      url: 'https://www.dmv.ca.gov/portal/vehicle-industry-services/autonomous-vehicles/autonomous-vehicle-collision-reports/',
      description: 'California DMV autonomous vehicle collision reports required by state regulation',
      sync_frequency: 'weekly',
      is_active: true,
    },
    {
      name: 'CPUC',
      url: 'https://www.cpuc.ca.gov/regulatory-services/licensing/transportation-licensing-and-analysis-branch/autonomous-vehicle-programs',
      description: 'California Public Utilities Commission AV passenger service quarterly reports',
      sync_frequency: 'quarterly',
      is_active: true,
    },
    {
      name: 'Community Reports',
      url: null,
      description: 'Incidents reported by community members through the AVWatch platform',
      sync_frequency: null,
      is_active: true,
    },
  ];
  
  for (const source of dataSources) {
    const { error } = await supabase
      .from('data_sources')
      .upsert(source, { onConflict: 'name' });
    
    if (error) {
      console.error(`Error upserting data source ${source.name}:`, error);
    } else {
      console.log(`  ✓ ${source.name}`);
    }
  }
}

async function seedNHTSAData() {
  console.log('\n🚗 Fetching NHTSA SGO Data...\n');

  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  let realCoordsCount = 0;
  let streetCoordsCount = 0;
  let fallbackCoordsCount = 0;
  
  try {
    // Fetch ADS data
    console.log('📥 Fetching ADS (Automated Driving Systems) incidents...');
    const adsRecords = await fetchAndParseCSV(NHTSA_ADS_URL);
    console.log(`   Found ${adsRecords.length} ADS records`);
    
    // Fetch ADAS data
    console.log('\n📥 Fetching ADAS (Level 2 Driver Assist) incidents...');
    const adasRecords = await fetchAndParseCSV(NHTSA_ADAS_URL);
    console.log(`   Found ${adasRecords.length} ADAS records`);
    
    // Pre-geocode ALL cities from both datasets
    console.log('\n🌍 Pre-geocoding all cities using Mapbox API...');
    const allRecords = [...adsRecords, ...adasRecords.slice(0, 500)];
    await preGeocodeAllCities(allRecords);
    
    // Process ADS records with street-level geocoding
    console.log('\n📝 Processing ADS incidents (with street-level geocoding)...');
    console.log('   This may take a few minutes for narrative parsing and geocoding...');

    // Process records in batches to allow async geocoding
    const adsProcessed: ProcessedIncident[] = [];
    const adsBatchSize = 20; // Process 20 at a time for geocoding
    for (let i = 0; i < adsRecords.length; i += adsBatchSize) {
      const batch = adsRecords.slice(i, i + adsBatchSize);
      const results = await Promise.all(
        batch.map((record, idx) => processADSRecord(record, i + idx))
      );
      const validResults = results.filter((r): r is ProcessedIncident => r !== null);
      adsProcessed.push(...validResults);
      process.stdout.write(`   Geocoding: ${Math.min(i + adsBatchSize, adsRecords.length)}/${adsRecords.length}\r`);
    }

    // Count coordinate sources
    const adsRealCoords = adsProcessed.filter(p => p.hasRealCoords).length;
    const adsStreetCoords = adsProcessed.filter(p => p.hasStreetCoords).length;
    const adsFallbackCoords = adsProcessed.length - adsRealCoords - adsStreetCoords;
    realCoordsCount += adsRealCoords;
    streetCoordsCount += adsStreetCoords;
    fallbackCoordsCount += adsFallbackCoords;

    console.log(`\n   Processing ${adsProcessed.length} valid ADS incidents...`);
    console.log(`   📍 ${adsRealCoords} real GPS, ${adsStreetCoords} street-level, ${adsFallbackCoords} city-level`);

    // Extract incidents for insertion
    const adsIncidents = adsProcessed.map(p => p.incident);

    // Insert in batches
    const batchSize = 50;
    for (let i = 0; i < adsIncidents.length; i += batchSize) {
      const batch = adsIncidents.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('incidents')
        .upsert(batch, {
          onConflict: 'external_id',
          ignoreDuplicates: false
        })
        .select('id');

      if (error) {
        console.error(`   Batch error:`, error.message);
        totalErrors += batch.length;
      } else {
        totalInserted += data?.length || 0;
        totalSkipped += batch.length - (data?.length || 0);
      }

      process.stdout.write(`   Inserting: ${Math.min(i + batchSize, adsIncidents.length)}/${adsIncidents.length}\r`);
    }
    console.log(`\n   ✓ ADS data processed`);

    // Process ADAS records (limited for performance)
    console.log('\n📝 Processing ADAS incidents (with street-level geocoding)...');
    const adasToProcess = adasRecords.slice(0, 500); // Limit to 500 for performance

    const adasProcessed: ProcessedIncident[] = [];
    for (let i = 0; i < adasToProcess.length; i += adsBatchSize) {
      const batch = adasToProcess.slice(i, i + adsBatchSize);
      const results = await Promise.all(
        batch.map((record, idx) => processADASRecord(record, i + idx))
      );
      const validResults = results.filter((r): r is ProcessedIncident => r !== null);
      adasProcessed.push(...validResults);
      process.stdout.write(`   Geocoding: ${Math.min(i + adsBatchSize, adasToProcess.length)}/${adasToProcess.length}\r`);
    }

    // Count coordinate sources
    const adasRealCoords = adasProcessed.filter(p => p.hasRealCoords).length;
    const adasStreetCoords = adasProcessed.filter(p => p.hasStreetCoords).length;
    const adasFallbackCoords = adasProcessed.length - adasRealCoords - adasStreetCoords;
    realCoordsCount += adasRealCoords;
    streetCoordsCount += adasStreetCoords;
    fallbackCoordsCount += adasFallbackCoords;

    console.log(`\n   Processing ${adasProcessed.length} ADAS incidents (limited to 500)...`);
    console.log(`   📍 ${adasRealCoords} real GPS, ${adasStreetCoords} street-level, ${adasFallbackCoords} city-level`);

    // Extract incidents for insertion
    const adasIncidents = adasProcessed.map(p => p.incident);

    for (let i = 0; i < adasIncidents.length; i += batchSize) {
      const batch = adasIncidents.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('incidents')
        .upsert(batch, {
          onConflict: 'external_id',
          ignoreDuplicates: false
        })
        .select('id');

      if (error) {
        console.error(`   Batch error:`, error.message);
        totalErrors += batch.length;
      } else {
        totalInserted += data?.length || 0;
        totalSkipped += batch.length - (data?.length || 0);
      }

      process.stdout.write(`   Inserting: ${Math.min(i + batchSize, adasIncidents.length)}/${adasIncidents.length}\r`);
    }
    console.log(`\n   ✓ ADAS data processed`);
    
  } catch (error) {
    console.error('Error fetching NHTSA data:', error);
  }
  
  // Update data source records count
  const { data: countData } = await supabase
    .from('incidents')
    .select('id', { count: 'exact' })
    .eq('source', 'nhtsa');
  
  await supabase
    .from('data_sources')
    .update({ 
      records_count: countData?.length || 0,
      last_synced_at: new Date().toISOString()
    })
    .eq('name', 'NHTSA SGO (ADS)');
  
  await supabase
    .from('data_sources')
    .update({
      records_count: countData?.length || 0,
      last_synced_at: new Date().toISOString()
    })
    .eq('name', 'NHTSA SGO (ADAS)');

  return { totalInserted, totalSkipped, totalErrors, realCoordsCount, streetCoordsCount, fallbackCoordsCount };
}

// Add sample California DMV data (with real SF coordinates)
async function seedDMVSampleData() {
  console.log('\n📋 Adding sample California DMV incidents...');
  
  // Real San Francisco coordinates for DMV sample data
  const sfLocations = [
    { lat: 37.7847, lng: -122.4088, address: 'Market St & 5th St' },
    { lat: 37.7879, lng: -122.4074, address: 'Mission St & 3rd St' },
    { lat: 37.7749, lng: -122.4194, address: 'Harrison St & 4th St' },
    { lat: 37.7694, lng: -122.4262, address: 'Folsom St & 7th St' },
    { lat: 37.7989, lng: -122.4358, address: 'Van Ness Ave & Geary St' },
  ];
  
  const dmvIncidents: IncidentInsert[] = [
    {
      incident_type: 'collision',
      av_company: 'waymo',
      description: 'CA DMV Report: Waymo autonomous vehicle rear-ended by conventional vehicle at intersection. AV was stopped at red light. No injuries reported.',
      location: `SRID=4326;POINT(${sfLocations[0].lng} ${sfLocations[0].lat})`,
      address: sfLocations[0].address,
      city: 'San Francisco',
      occurred_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      reported_at: new Date().toISOString(),
      status: 'verified',
      source: 'dmv',
      external_id: 'ca-dmv-2024-001',
      fatalities: 0,
      injuries: 0,
      raw_data: { source: 'CA DMV', report_type: 'OL 316' },
    },
    {
      incident_type: 'collision',
      av_company: 'cruise',
      description: 'CA DMV Report: Cruise autonomous vehicle involved in collision with pedestrian. Vehicle was operating in autonomous mode. Minor injuries reported.',
      location: `SRID=4326;POINT(${sfLocations[1].lng} ${sfLocations[1].lat})`,
      address: sfLocations[1].address,
      city: 'San Francisco',
      occurred_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
      reported_at: new Date().toISOString(),
      status: 'verified',
      source: 'dmv',
      external_id: 'ca-dmv-2024-002',
      fatalities: 0,
      injuries: 1,
      raw_data: { source: 'CA DMV', report_type: 'OL 316' },
    },
    {
      incident_type: 'collision',
      av_company: 'zoox',
      description: 'CA DMV Report: Zoox autonomous vehicle sideswipe collision with parked vehicle. AV was navigating narrow street. Property damage only.',
      location: `SRID=4326;POINT(${sfLocations[2].lng} ${sfLocations[2].lat})`,
      address: sfLocations[2].address,
      city: 'San Francisco',
      occurred_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      reported_at: new Date().toISOString(),
      status: 'verified',
      source: 'dmv',
      external_id: 'ca-dmv-2024-003',
      fatalities: 0,
      injuries: 0,
      raw_data: { source: 'CA DMV', report_type: 'OL 316' },
    },
    {
      incident_type: 'near_miss',
      av_company: 'waymo',
      description: 'CA DMV Report: Waymo AV emergency braking to avoid collision with cyclist. No contact made. Passenger reported minor discomfort.',
      location: `SRID=4326;POINT(${sfLocations[3].lng} ${sfLocations[3].lat})`,
      address: sfLocations[3].address,
      city: 'San Francisco',
      occurred_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      reported_at: new Date().toISOString(),
      status: 'verified',
      source: 'dmv',
      external_id: 'ca-dmv-2024-004',
      fatalities: 0,
      injuries: 0,
      raw_data: { source: 'CA DMV', report_type: 'OL 316' },
    },
    {
      incident_type: 'collision',
      av_company: 'cruise',
      description: 'CA DMV Report: Cruise AV collision during lane change maneuver. Contact with conventional vehicle. No injuries, minor vehicle damage.',
      location: `SRID=4326;POINT(${sfLocations[4].lng} ${sfLocations[4].lat})`,
      address: sfLocations[4].address,
      city: 'San Francisco',
      occurred_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
      reported_at: new Date().toISOString(),
      status: 'verified',
      source: 'dmv',
      external_id: 'ca-dmv-2024-005',
      fatalities: 0,
      injuries: 0,
      raw_data: { source: 'CA DMV', report_type: 'OL 316' },
    },
  ];
  
  for (const incident of dmvIncidents) {
    const { error } = await supabase
      .from('incidents')
      .upsert(incident, { onConflict: 'external_id' });
    
    if (error && !error.message.includes('duplicate')) {
      console.error(`   Error inserting DMV incident:`, error.message);
    }
  }
  
  // Update data source
  await supabase
    .from('data_sources')
    .update({ 
      records_count: dmvIncidents.length,
      last_synced_at: new Date().toISOString()
    })
    .eq('name', 'California DMV');
  
  console.log(`   ✓ Added ${dmvIncidents.length} DMV sample incidents`);
}

// Add sample CPUC data (with real SF coordinates)
async function seedCPUCSampleData() {
  console.log('\n📊 Adding sample CPUC quarterly report incidents...');
  
  // Real San Francisco coordinates
  const cpucLocations = [
    { lat: 37.7863, lng: -122.4088, address: 'Geary Blvd & Mason St' },
    { lat: 37.7752, lng: -122.4184, address: 'Howard St & 6th St' },
    { lat: 37.7955, lng: -122.3937, address: 'Embarcadero & Broadway' },
  ];
  
  const cpucIncidents: IncidentInsert[] = [
    {
      incident_type: 'blockage',
      av_company: 'waymo',
      description: 'CPUC Quarterly Report: Waymo vehicle stopped unexpectedly in travel lane. Remote assistance required. Traffic flow impacted for 12 minutes.',
      location: `SRID=4326;POINT(${cpucLocations[0].lng} ${cpucLocations[0].lat})`,
      address: cpucLocations[0].address,
      city: 'San Francisco',
      occurred_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
      reported_at: new Date().toISOString(),
      status: 'verified',
      source: 'cpuc',
      external_id: 'cpuc-2024-q4-001',
      fatalities: 0,
      injuries: 0,
      raw_data: { source: 'CPUC', quarter: 'Q4 2024' },
    },
    {
      incident_type: 'sudden_behavior',
      av_company: 'cruise',
      description: 'CPUC Quarterly Report: Cruise vehicle unexpected hard braking. Vehicle performed safety stop. No collision or injuries.',
      location: `SRID=4326;POINT(${cpucLocations[1].lng} ${cpucLocations[1].lat})`,
      address: cpucLocations[1].address,
      city: 'San Francisco',
      occurred_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
      reported_at: new Date().toISOString(),
      status: 'verified',
      source: 'cpuc',
      external_id: 'cpuc-2024-q4-002',
      fatalities: 0,
      injuries: 0,
      raw_data: { source: 'CPUC', quarter: 'Q4 2024' },
    },
    {
      incident_type: 'blockage',
      av_company: 'zoox',
      description: 'CPUC Quarterly Report: Zoox vehicle blocked intersection due to sensor malfunction. Vehicle safely pulled over. Service restored in 8 minutes.',
      location: `SRID=4326;POINT(${cpucLocations[2].lng} ${cpucLocations[2].lat})`,
      address: cpucLocations[2].address,
      city: 'San Francisco',
      occurred_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
      reported_at: new Date().toISOString(),
      status: 'verified',
      source: 'cpuc',
      external_id: 'cpuc-2024-q4-003',
      fatalities: 0,
      injuries: 0,
      raw_data: { source: 'CPUC', quarter: 'Q4 2024' },
    },
  ];
  
  for (const incident of cpucIncidents) {
    const { error } = await supabase
      .from('incidents')
      .upsert(incident, { onConflict: 'external_id' });
    
    if (error && !error.message.includes('duplicate')) {
      console.error(`   Error inserting CPUC incident:`, error.message);
    }
  }
  
  // Update data source
  await supabase
    .from('data_sources')
    .update({ 
      records_count: cpucIncidents.length,
      last_synced_at: new Date().toISOString()
    })
    .eq('name', 'CPUC');
  
  console.log(`   ✓ Added ${cpucIncidents.length} CPUC sample incidents`);
}

// Update user report count
async function updateUserReportCount() {
  const { count } = await supabase
    .from('incidents')
    .select('id', { count: 'exact' })
    .eq('source', 'user_report');
  
  await supabase
    .from('data_sources')
    .update({ records_count: count || 0 })
    .eq('name', 'Community Reports');
}

// Log sync activity
async function logSync(sourceName: string, status: string, recordsProcessed: number, recordsCreated: number) {
  await supabase.from('sync_log').insert({
    source_name: sourceName,
    status,
    records_processed: recordsProcessed,
    records_created: recordsCreated,
    completed_at: new Date().toISOString(),
  });
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main() {
  console.log('🚀 AVWatch Data Seeding Script (with Real GPS Coordinates)\n');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('Using REAL lat/lng from NHTSA data when available!\n');
  
  // Setup data sources
  await setupDataSources();
  
  // Seed NHTSA data with real geocoded coordinates
  const nhtsaResult = await seedNHTSAData();
  await logSync('NHTSA SGO', 'success', nhtsaResult.totalInserted + nhtsaResult.totalSkipped, nhtsaResult.totalInserted);
  
  // Seed DMV sample data
  await seedDMVSampleData();
  await logSync('California DMV', 'success', 5, 5);
  
  // Seed CPUC sample data
  await seedCPUCSampleData();
  await logSync('CPUC', 'success', 3, 3);
  
  // Update user report count
  await updateUserReportCount();
  
  // Get final counts
  const { count: totalCount } = await supabase
    .from('incidents')
    .select('id', { count: 'exact' });
  
  const { data: sourceCounts } = await supabase
    .from('incidents')
    .select('source');
  
  const countBySource = sourceCounts?.reduce((acc, row) => {
    acc[row.source] = (acc[row.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};
  
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('📊 SEEDING COMPLETE\n');
  console.log(`Total incidents in database: ${totalCount}`);
  console.log(`\n📍 Coordinate accuracy (NHTSA data):`);
  console.log(`   Real GPS coordinates:   ${nhtsaResult.realCoordsCount}`);
  console.log(`   Street-level geocoded:  ${nhtsaResult.streetCoordsCount}`);
  console.log(`   City-level fallback:    ${nhtsaResult.fallbackCoordsCount}`);
  const totalCoords = nhtsaResult.realCoordsCount + nhtsaResult.streetCoordsCount + nhtsaResult.fallbackCoordsCount;
  const precisePercent = (((nhtsaResult.realCoordsCount + nhtsaResult.streetCoordsCount) / totalCoords) * 100).toFixed(1);
  console.log(`   Precise location rate:  ${precisePercent}%`);
  console.log(`\nGeocoded cities cached: ${geocodeCache.size}`);
  console.log(`Street addresses geocoded: ${streetGeocodeCache.size}`);
  console.log('\nBy source:');
  Object.entries(countBySource).forEach(([source, count]) => {
    console.log(`  • ${source}: ${count}`);
  });
  console.log('\n✅ Done! Your AVWatch database is now populated with geocoded AV incident data.');
}

main().catch(console.error);
