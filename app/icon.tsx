import { ImageResponse } from 'next/og';

// Icono principal (browsers, Android PWA)
export const runtime = 'edge';
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
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
          borderRadius: 120,
          position: 'relative',
        }}
      >
        {/* Mancuerna horizontal */}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {/* Disco exterior izquierdo */}
          <div
            style={{
              width: 60,
              height: 200,
              background: 'linear-gradient(135deg, #FB923C 0%, #EA580C 100%)',
              borderRadius: 18,
              boxShadow: '0 0 40px rgba(249, 115, 22, 0.5)',
            }}
          />
          {/* Disco interior izquierdo */}
          <div
            style={{
              width: 36,
              height: 110,
              background: '#FB923C',
              borderRadius: 10,
              marginLeft: 6,
            }}
          />
          {/* Barra */}
          <div
            style={{
              width: 230,
              height: 40,
              background: 'linear-gradient(180deg, #F8FAFC 0%, #CBD5E1 100%)',
              borderRadius: 20,
              boxShadow: 'inset 0 -4px 8px rgba(0,0,0,0.2)',
            }}
          />
          {/* Disco interior derecho */}
          <div
            style={{
              width: 36,
              height: 110,
              background: '#FB923C',
              borderRadius: 10,
              marginRight: 6,
            }}
          />
          {/* Disco exterior derecho */}
          <div
            style={{
              width: 60,
              height: 200,
              background: 'linear-gradient(135deg, #FB923C 0%, #EA580C 100%)',
              borderRadius: 18,
              boxShadow: '0 0 40px rgba(249, 115, 22, 0.5)',
            }}
          />
        </div>
        {/* Punto verde acento (energía) */}
        <div
          style={{
            position: 'absolute',
            top: 70,
            right: 80,
            width: 36,
            height: 36,
            background: '#22C55E',
            borderRadius: 18,
            boxShadow: '0 0 20px rgba(34, 197, 94, 0.6)',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
