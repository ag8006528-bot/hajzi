import { ImageResponse } from 'next/og';

export const alt = 'HAJZI — Book Your Football Field in Seconds';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OgImage() {
  const stripes = Array.from({ length: 10 });
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', background: '#1B7A3D' }}>
        {stripes.map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: i * 120,
              width: 120,
              background: i % 2 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.06)',
            }}
          />
        ))}
        <div style={{ position: 'absolute', inset: 30, border: '4px solid rgba(255,255,255,0.7)', display: 'flex' }} />
        <div style={{ position: 'absolute', left: 598, top: 30, bottom: 30, width: 4, background: 'rgba(255,255,255,0.7)' }} />
        <div
          style={{
            position: 'absolute',
            left: 450,
            top: 165,
            width: 300,
            height: 300,
            borderRadius: 300,
            border: '4px solid rgba(255,255,255,0.7)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
          }}
        >
          <div style={{ fontSize: 180, fontWeight: 900, letterSpacing: 16, display: 'flex' }}>
            HAJ<span style={{ color: '#FFD60A' }}>Z</span>I
          </div>
          <div
            style={{
              marginTop: 10,
              fontSize: 44,
              fontWeight: 700,
              background: '#FFD60A',
              color: '#1A1A1A',
              padding: '10px 32px',
              borderRadius: 999,
            }}
          >
            Book Your Field in Seconds
          </div>
        </div>
      </div>
    ),
    size,
  );
}
