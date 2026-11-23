/**
 * Lightweight SVG "photo" placeholders (no image downloads, great for performance).
 * Replace by adding real image URLs to a field in /admin.
 */
import type { FieldType } from '@/lib/types';

const stripes = (n: number, w: number, h: number) =>
  Array.from({ length: n }, (_, i) => (
    <rect key={i} x={(i * w) / n} y="0" width={w / n} height={h} fill={i % 2 ? '#1F8444' : '#1B7A3D'} />
  ));

export function FieldArt({
  variant = 0,
  type,
  label,
  className = '',
}: {
  variant?: number;
  type: FieldType;
  label: string;
  className?: string;
}) {
  const v = ((variant % 4) + 4) % 4;
  return (
    <svg viewBox="0 0 400 250" className={className} role="img" aria-label={label} preserveAspectRatio="xMidYMid slice">
      {v === 0 && (
        // Top-down pitch view
        <g>
          {stripes(10, 400, 250)}
          <g fill="none" stroke="#fff" strokeWidth="2.5" opacity="0.9">
            <rect x="20" y="20" width="360" height="210" />
            <line x1="200" y1="20" x2="200" y2="230" />
            <circle cx="200" cy="125" r="34" />
            <rect x="20" y="70" width={type === '5v5' ? 40 : 58} height="110" />
            <rect x={type === '5v5' ? 340 : 322} y="70" width={type === '5v5' ? 40 : 58} height="110" />
          </g>
          <circle cx="200" cy="125" r="4" fill="#fff" />
          <circle cx="250" cy="150" r="7" fill="#fff" stroke="#1A1A1A" strokeWidth="1.5" />
        </g>
      )}
      {v === 1 && (
        // Night match with floodlights
        <g>
          <rect width="400" height="250" fill="#0A3A1C" />
          <defs>
            <radialGradient id="fl" cx="0.5" cy="0" r="0.9">
              <stop offset="0" stopColor="#FFF7C2" stopOpacity="0.55" />
              <stop offset="1" stopColor="#FFF7C2" stopOpacity="0" />
            </radialGradient>
          </defs>
          <polygon points="0,250 400,250 330,130 70,130" fill="#1B7A3D" />
          {Array.from({ length: 6 }, (_, i) => (
            <polygon key={i} points={`${i * 66.6},250 ${(i + 1) * 66.6},250 ${70 + (i + 1) * 43.3},130 ${70 + i * 43.3},130`} fill={i % 2 ? '#21874A' : '#1B7A3D'} />
          ))}
          <polygon points="0,250 400,250 330,130 70,130" fill="none" stroke="#fff" strokeWidth="2" opacity="0.85" />
          <line x1="200" y1="130" x2="200" y2="250" stroke="#fff" strokeWidth="2" opacity="0.85" />
          <ellipse cx="200" cy="185" rx="60" ry="22" fill="none" stroke="#fff" strokeWidth="2" opacity="0.85" />
          {[40, 360].map((x) => (
            <g key={x}>
              <rect x={x - 3} y="30" width="6" height="110" fill="#cfd8d3" />
              <rect x={x - 22} y="18" width="44" height="16" rx="2" fill="#FFF7C2" />
              <circle cx={x} cy="26" r="70" fill="url(#fl)" />
            </g>
          ))}
        </g>
      )}
      {v === 2 && (
        // Goal and net, front view
        <g>
          <rect width="400" height="250" fill="#2E9E55" />
          {stripes(8, 400, 250).map((s, i) => (
            <g key={i} opacity="0.6">
              {s}
            </g>
          ))}
          <rect x="0" y="0" width="400" height="90" fill="#0F4D26" />
          <g stroke="#fff" strokeWidth="1" opacity="0.35">
            {Array.from({ length: 21 }, (_, i) => (
              <line key={`v${i}`} x1={90 + i * 11} y1="70" x2={90 + i * 11} y2="190" />
            ))}
            {Array.from({ length: 12 }, (_, i) => (
              <line key={`h${i}`} x1="90" y1={70 + i * 11} x2="310" y2={70 + i * 11} />
            ))}
          </g>
          <path d="M84 192V64h232v128" fill="none" stroke="#fff" strokeWidth="8" strokeLinejoin="round" />
          <line x1="0" y1="194" x2="400" y2="194" stroke="#fff" strokeWidth="3" />
          <circle cx="200" cy="225" r="13" fill="#fff" stroke="#1A1A1A" strokeWidth="2" />
          <path d="m200 217 6 4-2 7h-8l-2-7z" fill="#1A1A1A" />
        </g>
      )}
      {v === 3 && (
        // Centre circle close-up with ball
        <g>
          {stripes(6, 400, 250)}
          <g fill="none" stroke="#fff" strokeWidth="3" opacity="0.9">
            <circle cx="200" cy="125" r="95" />
            <line x1="200" y1="0" x2="200" y2="250" />
          </g>
          <circle cx="200" cy="125" r="5" fill="#fff" />
          <circle cx="232" cy="140" r="22" fill="#fff" stroke="#1A1A1A" strokeWidth="2" />
          <path d="m232 127 11 8-4 13h-14l-4-13z" fill="#1A1A1A" />
          <ellipse cx="236" cy="166" rx="20" ry="4" fill="#000" opacity="0.2" />
        </g>
      )}
    </svg>
  );
}
