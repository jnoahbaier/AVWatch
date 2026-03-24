/**
 * Proxy: PATCH /api/admin/incidents/[id]/status
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
  if (!session?.user?.email || !ADMIN_EMAILS.includes(session.user.email)) return null;
  return session;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await assertAdmin();
  if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return NextResponse.json({ error: 'Backend not configured' }, { status: 503 });

  const body = await req.json();
  // Always embed the admin email so the backend knows who took the action
  const enrichedBody = { ...body, blocked_by: session.user?.email };

  const upstream = await fetch(`${apiUrl}/api/admin/incidents/${params.id}/status`, {
    method: 'PATCH',
    headers: adminHeaders(),
    body: JSON.stringify(enrichedBody),
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
