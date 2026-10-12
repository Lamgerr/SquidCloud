import React from 'react';

/* ═══════════════════════════════════════════════════════════════
   NightSky. Static starry-night backdrop for the hero.

   Pure inline SVG: deep navy wash, a seeded star field, and two
   low, muted cloud bands. No animation, so reduced-motion gets
   the same sky as everyone else.
   ═══════════════════════════════════════════════════════════════ */

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(42);
const STARS = Array.from({ length: 160 }, () => ({
  x: rand() * 1440,
  y: rand() * 900,
  r: 0.4 + rand() * 1.1,
  o: 0.25 + rand() * 0.65,
}));

export default function NightSky() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <svg
        className="h-full w-full"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <linearGradient id="ns-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0a1024" />
            <stop offset="0.55" stopColor="#0b1226" />
            <stop offset="1" stopColor="#070a14" />
          </linearGradient>
          <radialGradient id="ns-glow" cx="0.5" cy="0.42" r="0.55">
            <stop offset="0" stopColor="#1b2a52" stopOpacity="0.55" />
            <stop offset="1" stopColor="#1b2a52" stopOpacity="0" />
          </radialGradient>
          <filter id="ns-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="38" />
          </filter>
        </defs>

        <rect width="1440" height="900" fill="url(#ns-sky)" />
        <rect width="1440" height="900" fill="url(#ns-glow)" />

        {STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#dfe6ff" opacity={s.o} />
        ))}

        <g filter="url(#ns-soft)" opacity="0.5">
          <ellipse cx="300" cy="180" rx="320" ry="70" fill="#2a3350" />
          <ellipse cx="1150" cy="120" rx="300" ry="60" fill="#252c46" />
          <ellipse cx="760" cy="760" rx="520" ry="90" fill="#1d2438" />
          <ellipse cx="120" cy="620" rx="260" ry="70" fill="#232a44" />
        </g>
      </svg>
    </div>
  );
}
