import { ImageResponse } from 'next/og';

// Icono para iOS "Add to Home Screen"
export const runtime = 'edge';
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1C1917 0%, #0C0A09 100%)',
          position: 'relative',
        }}
      >
        {/* Mancuerna horizontal compacta */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: 22,
              height: 74,
              background: 'linear-gradient(135deg, #FB923C 0%, #EA580C 100%)',
              borderRadius: 7,
            }}
          />
          <div
            style={{
              width: 13,
              height: 40,
              background: '#FB923C',
              borderRadius: 4,
              marginLeft: 2,
            }}
          />
          <div
            style={{
              width: 80,
              height: 14,
              background: 'linear-gradient(180deg, #F8FAFC 0%, #CBD5E1 100%)',
              borderRadius: 7,
            }}
          />
          <div
            style={{
              width: 13,
              height: 40,
              background: '#FB923C',
              borderRadius: 4,
              marginRight: 2,
            }}
          />
          <div
            style={{
              width: 22,
              height: 74,
              background: 'linear-gradient(135deg, #FB923C 0%, #EA580C 100%)',
              borderRadius: 7,
            }}
          />
        </div>
        {/* Punto verde */}
        <div
          style={{
            position: 'absolute',
            top: 22,
            right: 26,
            width: 14,
            height: 14,
            background: '#22C55E',
            borderRadius: 7,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
