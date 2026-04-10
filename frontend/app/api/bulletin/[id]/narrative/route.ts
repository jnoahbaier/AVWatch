import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!backendUrl) {
    return NextResponse.json({ error: 'Backend URL not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(`${backendUrl}/api/bulletin/${params.id}/narrative`, {
      headers: { 'Content-Type': 'application/json' },
      next: { revalidate: 300 }, // cache for 5 minutes
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Failed to fetch narrative' }, { status: 500 });
  }
}
