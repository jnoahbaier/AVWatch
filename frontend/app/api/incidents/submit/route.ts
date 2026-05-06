/**
 * POST /api/incidents/submit
 *
 * Thin proxy to the Python backend's POST /api/incidents/ endpoint.
 * We forward the real client IP via X-Forwarded-For so the backend can
 * handle rate-limiting, IP hashing, Gemini quality gating, and card
 * generation — all in one place.
 */
import { NextRequest, NextResponse } from 'next/server';

type SubmitBody = {
  incident_type?: string;
  av_company?: string;
  description?: string | null;
  latitude?: number;
  longitude?: number;
  address?: string | null;
  city?: string;
  occurred_at?: string;
  reporter_type?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  media_urls?: string[];
};

export async function POST(req: NextRequest) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!backendUrl) {
    return NextResponse.json(
      { error: 'Report submission is not configured (missing backend URL).' },
      { status: 503 }
    );
  }

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const {
    incident_type,
    av_company,
    description,
    latitude,
    longitude,
    address,
    city,
    occurred_at,
    reporter_type,
    contact_name,
    contact_email,
    media_urls,
  } = body;

  // Basic validation before hitting the backend
  if (
    typeof incident_type !== 'string' ||
    !incident_type ||
    typeof latitude !== 'number' ||
    Number.isNaN(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== 'number' ||
    Number.isNaN(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    typeof occurred_at !== 'string' ||
    !occurred_at
  ) {
    return NextResponse.json(
      { error: 'Missing or invalid required fields (incident_type, latitude, longitude, occurred_at).' },
      { status: 400 }
    );
  }

  // Forward the real client IP so the backend rate-limiter and IP hasher work correctly
  const forwardedFor =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'unknown';

  // Transform flat lat/lng/address into the nested `location` object the backend expects
  const backendPayload = {
    incident_type,
    av_company: av_company || 'unknown',
    description: description ?? null,
    location: {
      latitude,
      longitude,
      address: address ?? null,
    },
    city: city || 'San Francisco',
    occurred_at,
    reporter_type: reporter_type ?? null,
    contact_name: contact_name ?? null,
    contact_email: contact_email ?? null,
    media_urls: media_urls ?? [],
  };

  let response: Response;
  try {
    response = await fetch(`${backendUrl}/api/incidents/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': forwardedFor,
      },
      body: JSON.stringify(backendPayload),
    });
  } catch (err) {
    console.error('incidents/submit: backend unreachable', err);
    return NextResponse.json(
      { error: 'Could not reach the report server. Please try again later.' },
      { status: 503 }
    );
  }

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
