/**
 * Proxy: DELETE /api/admin/blocked-ips/[bid]
 */
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions, ADMIN_EMAILS } from '@/lib/auth';

async function assertAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) return null;
  return session;
}

export async function DELETE(_req: NextRequest, { params }: { params: { bid: string } }) {
  const session = await assertAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return NextResponse.json({ error: 'Backend not configured' }, { status: 503 });

  const upstream = await fetch(`${apiUrl}/api/admin/blocked-ips/${params.bid}`, {
    method: 'DELETE',
    headers: { 'X-Admin-Key': process.env.ADMIN_API_KEY ?? '' },
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
