import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 600_000; // 10 minutes

function clientIpFromRequest(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return 'unknown';
}

function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'Report submission is not configured (missing Supabase service credentials).' },
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

  const clientIp = clientIpFromRequest(req);
  const ipHash = sha256Hex(clientIp);

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: blocked } = await supabase
    .from('blocked_ips')
    .select('id')
    .eq('ip_hash', ipHash)
    .maybeSingle();

  if (blocked) {
    return NextResponse.json({ error: 'Submission not allowed.' }, { status: 403 });
  }

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();
  const { count, error: countError } = await supabase
    .from('incidents')
    .select('*', { count: 'exact', head: true })
    .eq('reporter_ip_hash', ipHash)
    .gte('reported_at', since);

  if (countError) {
    console.error('incidents submit: rate count error', countError);
    return NextResponse.json({ error: 'Could not verify submission rate. Try again later.' }, { status: 500 });
  }

  if ((count ?? 0) >= RATE_LIMIT_MAX) {
    return NextResponse.json(
      {
        error:
          'Too many submissions. Please wait a few minutes before submitting again.',
      },
      { status: 429 }
    );
  }

  const { data, error } = await supabase
    .from('incidents')
    .insert({
      incident_type,
      av_company: av_company || 'unknown',
      description: description ?? null,
      location: `SRID=4326;POINT(${longitude} ${latitude})`,
      address: address ?? null,
      city: city || 'San Francisco',
      occurred_at,
      reporter_type: reporter_type ?? null,
      source: 'user_report',
      status: 'unverified',
      media_urls: media_urls ?? [],
      contact_name: contact_name || null,
      contact_email: contact_email || null,
      reporter_ip_hash: ipHash,
    })
    .select()
    .single();

  if (error) {
    console.error('incidents submit: insert error', error);
    return NextResponse.json({ error: error.message || 'Failed to save report.' }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
