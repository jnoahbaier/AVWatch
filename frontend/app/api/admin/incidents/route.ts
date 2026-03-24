/**
 * Proxy: GET /api/admin/incidents
 * Validates the NextAuth session server-side, then forwards to FastAPI with the admin key.
 */
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions, ADMIN_EMAILS } from '@/lib/auth';

function adminHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Admin-Key': process.env.ADMIN_API_KEY ?? '',
  };
}

async function assertAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return null;
  }
  return session;
}

export async function GET(req: NextRequest) {
  const session = await assertAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return NextResponse.json({ error: 'Backend not configured' }, { status: 503 });

  const url = new URL('/api/admin/incidents', apiUrl);
  // Forward all query params
  req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

  const upstream = await fetch(url.toString(), { headers: adminHeaders() });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
