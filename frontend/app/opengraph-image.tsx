import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'AVWatch — Report autonomous vehicle incidents';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          padding: '72px 80px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 55%, #0f172a 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
        }}
      >
        {/* Grid overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Accent glow */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            right: '-80px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(59,130,246,0.25) 0%, transparent 70%)',
          }}
        />

        {/* Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(59,130,246,0.15)',
            border: '1px solid rgba(59,130,246,0.4)',
            borderRadius: '999px',
            padding: '6px 16px',
            marginBottom: '28px',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#3b82f6',
            }}
          />
          <span style={{ color: '#93c5fd', fontSize: '16px', fontWeight: 600 }}>
            UC Berkeley School of Information
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: '68px',
            fontWeight: 800,
            color: '#ffffff',
            lineHeight: 1.08,
            letterSpacing: '-2px',
            marginBottom: '24px',
          }}
        >
          AVWatch
        </div>

        {/* Sub-headline */}
        <div
          style={{
            fontSize: '28px',
            fontWeight: 400,
            color: '#94a3b8',
            lineHeight: 1.4,
            maxWidth: '680px',
            marginBottom: '48px',
          }}
        >
          Community platform for reporting &amp; tracking
          autonomous vehicle incidents in real time.
        </div>

        {/* CTA pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            background: '#2563eb',
            borderRadius: '12px',
            padding: '16px 28px',
          }}
        >
          <span style={{ color: '#ffffff', fontSize: '22px', fontWeight: 600 }}>
            Submit a report at avwatch.org
          </span>
          <span style={{ color: '#bfdbfe', fontSize: '22px' }}>→</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
