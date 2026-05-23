/**
 * POST /api/media/presign
 *
 * Proxies to the FastAPI backend to get a short-lived presigned PUT URL for
 * Cloudflare R2. The browser then uploads the file directly to R2 — bytes
 * never pass through Next.js or the backend.
 */
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!backendUrl) {
    return NextResponse.json({ error: 'Storage not configured.' }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  let response: Response;
  try {
    response = await fetch(`${backendUrl}/api/media/presign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error('media/presign: backend unreachable', err);
    return NextResponse.json({ error: 'Could not reach storage server.' }, { status: 503 });
  }

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}
