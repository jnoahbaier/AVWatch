/**
 * Proxy: GET /api/admin/stats
 */
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions, ADMIN_EMAILS } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return NextResponse.json({ error: 'Backend not configured' }, { status: 503 });

  const upstream = await fetch(`${apiUrl}/api/admin/stats`, {
    headers: { 'X-Admin-Key': process.env.ADMIN_API_KEY ?? '' },
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
