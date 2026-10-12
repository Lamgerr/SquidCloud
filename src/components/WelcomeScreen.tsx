import { useState, useEffect, useRef } from 'react'
import { kza, formatGreeting } from '@/lib/kza-locale'

interface WelcomeScreenProps {
  workspaceName: string
  onComplete: () => void
}

const FONT_SIZE = 72
const PERIMETER_PER_CHAR = FONT_SIZE * 6

function estimatePerimeter(text: string) {
  const visible = text.replace(/\s/g, '').length
  return Math.max(4000, visible * PERIMETER_PER_CHAR)
}

function handwritingFont(lang: string): string {
  const cursiveLangs = ['en', 'fr', 'es', 'de', 'it', 'pt', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'cs', 'hu', 'ro', 'hr', 'sk', 'sl', 'lt', 'lv', 'et', 'is', 'ga', 'tr', 'vi', 'id', 'ms', 'fil', 'ru', 'uk', 'bg', 'sr']
  if (cursiveLangs.includes(lang)) {
    return "'Caveat', 'SF Pro Display', 'Geist Sans', cursive, sans-serif"
  }
  return "'SF Pro Display', 'Geist Sans', -apple-system, BlinkMacSystemFont, 'Noto Sans', sans-serif"
}

export default function WelcomeScreen({ workspaceName, onComplete }: WelcomeScreenProps) {
  const [greeting, setGreeting] = useState(`Welcome to ${workspaceName || 'Your Workspace'}`)
  const [lang, setLang] = useState('en')
  const [showFill, setShowFill] = useState(false)
  const [stageOpacity, setStageOpacity] = useState(0)
  const [stageScale, setStageScale] = useState(0.98)
  const [showContinue, setShowContinue] = useState(false)
  const [fontLoaded, setFontLoaded] = useState(false)
  const [phase, setPhase] = useState<'loading' | 'reveal' | 'fill' | 'finish'>('loading')
  const completedRef = useRef(false)

  const text = greeting
  const fontFamily = handwritingFont(lang)
  const perimeter = estimatePerimeter(text)
  const dashArray = Math.ceil(perimeter * 1.5)
  const nonSpace = text.replace(/\s/g, '').length
  const animDuration = Math.max(1.8, nonSpace * 0.12)

  useEffect(() => {
    completedRef.current = false

    const link = document.createElement('link')
    link.href = 'https://fonts.googleapis.com/css2?family=Caveat:wght@400..700&display=swap'
    link.rel = 'stylesheet'
    link.onload = () => setFontLoaded(true)
    document.head.appendChild(link)

    kza().then(region => {
      setLang(region.lang)
      setGreeting(formatGreeting(region.greeting, workspaceName))
    })

    return () => {
      document.head.removeChild(link)
    }
  }, [workspaceName])

  useEffect(() => {
    if (phase !== 'loading') return
    if (!fontLoaded) return

    const t0 = performance.now()
    const fadeMs = 400

    let raf: number
    function tick(now: number) {
      const t = Math.min((now - t0) / fadeMs, 1)
      const eased = bezier(0.16, 1, 0.3, 1, t)
      setStageOpacity(Math.min(t * 3, 1))
      setStageScale(0.98 + 0.02 * eased)

      if (t < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        setPhase('reveal')
      }
    }
    raf = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(raf)
  }, [phase, fontLoaded])

  useEffect(() => {
    if (phase !== 'reveal') return

    const fillTimer = setTimeout(() => {
      setShowFill(true)
    }, animDuration * 1000 + 400)

    const continueTimer = setTimeout(() => {
      if (completedRef.current) return
      setShowContinue(true)
      setPhase('finish')

      let handleInput: (() => void) | undefined

      handleInput = () => {
        if (completedRef.current) return
        completedRef.current = true
        window.removeEventListener('keydown', handleInput!)
        onComplete()
      }

      window.addEventListener('keydown', handleInput)
      window.addEventListener('click', handleInput, { once: true })

      setTimeout(() => {
        if (completedRef.current) return
        completedRef.current = true
        if (handleInput) window.removeEventListener('keydown', handleInput)
        onComplete()
      }, 6000)
    }, animDuration * 1000 + 2200)

    return () => {
      clearTimeout(fillTimer)
      clearTimeout(continueTimer)
    }
  }, [phase, animDuration, onComplete])

  return (
    <div className="fixed inset-0 overflow-hidden bg-[#0a0a0f] select-none">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'url(/artwork.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'blur(50px) saturate(0.6)',
          transform: 'scale(1.15)',
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 25%, rgba(0,0,0,0.85) 100%)',
        }}
      />
      <div className="absolute inset-0 bg-black/45" />

      <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-8">
        <svg
          viewBox="0 0 800 160"
          className="w-full max-w-[90vw] h-auto"
          style={{
            maxHeight: '160px',
            opacity: stageOpacity,
            transform: `scale(${stageScale}) translateZ(0)`,
            transition: phase === 'finish' ? 'opacity 0.6s ease' : 'none',
          }}
        >
          <defs>
            <filter id="glassGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow in="SourceGraphic" dx="0" dy="0" stdDeviation="40" floodColor="rgba(255,255,255,0.10)" result="s1" />
              <feDropShadow in="SourceGraphic" dx="0" dy="0" stdDeviation="20" floodColor="rgba(255,255,255,0.08)" result="s2" />
              <feDropShadow in="SourceGraphic" dx="0" dy="0" stdDeviation="10" floodColor="rgba(255,255,255,0.05)" result="s3" />
              <feDropShadow in="SourceGraphic" dx="0" dy="1" stdDeviation="15" floodColor="rgba(120,180,255,0.06)" result="s4" />
              <feMerge>
                <feMergeNode in="SourceGraphic" />
                <feMergeNode in="s1" />
                <feMergeNode in="s2" />
                <feMergeNode in="s3" />
                <feMergeNode in="s4" />
              </feMerge>
            </filter>
          </defs>

          {/* Fill layer — behind stroke, has glass glow */}
          <text
            x="400"
            y="90"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={fontFamily}
            fontSize={FONT_SIZE}
            fontWeight="600"
            letterSpacing="-0.02em"
            fill="rgba(255,255,255,0.92)"
            filter="url(#glassGlow)"
            style={{
              opacity: showFill ? 1 : 0,
              transition: 'opacity 0.5s ease',
            }}
          >
            {text}
          </text>

          {/* Stroke layer — front, draws like handwriting */}
          <text
            x="400"
            y="90"
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily={fontFamily}
            fontSize={FONT_SIZE}
            fontWeight="600"
            letterSpacing="-0.02em"
            fill="none"
            stroke="rgba(255,255,255,0.92)"
            strokeWidth={FONT_SIZE * 0.7}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={dashArray}
            style={{
              strokeDashoffset: dashArray,
              animation: `drawText ${animDuration}s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
              opacity: showFill ? 0 : 1,
              transition: 'opacity 0.4s ease',
              filter: 'drop-shadow(0 0 20px rgba(255,255,255,0.06))',
            }}
          >
            {text}
          </text>
        </svg>

        {showContinue && (
          <p
            className="antialiased"
            style={{
              marginTop: 'clamp(24px, 5vh, 48px)',
              fontSize: '13px',
              fontWeight: 400,
              letterSpacing: '0.14em',
              color: 'rgba(255,255,255,0.2)',
              fontFamily: "'SF Pro Display', 'Geist Sans', sans-serif",
              animation: 'fadeInUp 0.65s cubic-bezier(0.16, 1, 0.3, 1) forwards, subtlePulse 3s ease-in-out 0.8s infinite',
              opacity: 0,
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
            onClick={() => { if (!completedRef.current) { completedRef.current = true; onComplete() } }}
          >
            Press any key to continue
          </p>
        )}
      </div>

      <style>{`
        @keyframes drawText {
          from { stroke-dashoffset: ${dashArray}; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes subtlePulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>
    </div>
  )
}

function bezier(x1: number, y1: number, x2: number, y2: number, x: number): number {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by
  const sX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sY = (t: number) => ((ay * t + by) * t + cy) * t

  function solveT(target: number) {
    let t = target
    for (let i = 0; i < 12; i++) {
      const err = sX(t) - target
      const der = (3 * ax * t + 2 * bx) * t + cx
      if (Math.abs(err) < 1e-8) return t
      if (Math.abs(der) < 1e-7) break
      t -= err / der
    }
    let lo = 0, hi = 1
    while (hi - lo > 1e-7) {
      const m = (lo + hi) * 0.5
      sX(m) < target ? (lo = m) : (hi = m)
    }
    return (lo + hi) * 0.5
  }
  return sY(solveT(Math.max(0, Math.min(1, x))))
}
