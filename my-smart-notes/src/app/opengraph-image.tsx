import { ImageResponse } from 'next/og'

export const alt = 'Sentia AI-powered notes and study tools'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: 'center',
          background:
            'radial-gradient(circle at 72% 24%, #1b4166 0, #101a2b 32%, #070a10 72%)',
          color: '#f8fbff',
          display: 'flex',
          fontFamily: 'Arial, Helvetica, sans-serif',
          height: '100%',
          justifyContent: 'space-between',
          padding: '72px 88px',
          width: '100%'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', width: 760 }}>
          <div
            style={{
              color: '#78c9ff',
              display: 'flex',
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: '0.08em',
              marginBottom: 34,
              textTransform: 'uppercase'
            }}
          >
            Sentia
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 68,
              fontWeight: 700,
              letterSpacing: '-0.04em',
              lineHeight: 1.05
            }}
          >
            Notes that help you study.
          </div>
          <div
            style={{
              color: '#adbed2',
              display: 'flex',
              fontSize: 30,
              lineHeight: 1.4,
              marginTop: 30
            }}
          >
            A familiar notebook editor with grounded AI assistance and
            adaptive quizzes.
          </div>
        </div>
        <div
          style={{
            alignItems: 'center',
            background: 'linear-gradient(145deg, #111d31, #070b13)',
            border: '3px solid #29486b',
            borderRadius: 52,
            boxShadow: '0 0 70px rgba(102, 232, 255, 0.18)',
            display: 'flex',
            height: 260,
            justifyContent: 'center',
            width: 260
          }}
        >
          <div
            style={{
              background: 'linear-gradient(135deg, #66e8ff, #a78bfa)',
              backgroundClip: 'text',
              color: 'transparent',
              display: 'flex',
              fontSize: 184,
              fontWeight: 600,
              lineHeight: 1
            }}
          >
            S
          </div>
        </div>
      </div>
    ),
    size
  )
}
