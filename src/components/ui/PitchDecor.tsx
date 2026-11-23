/** Decorative white pitch markings (purely visual, hidden from assistive tech). */

export function CenterCircle({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden="true" focusable="false" fill="none">
      <circle cx="200" cy="200" r="150" stroke="currentColor" strokeWidth="3" />
      <circle cx="200" cy="200" r="6" fill="currentColor" />
      <line x1="200" y1="0" x2="200" y2="400" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

/** Full pitch outline seen from above — used as hero backdrop. */
export function PitchOutline({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 1050 680" className={className} aria-hidden="true" focusable="false" fill="none" preserveAspectRatio="xMidYMid slice">
      <g stroke="currentColor" strokeWidth="3">
        <rect x="25" y="25" width="1000" height="630" />
        <line x1="525" y1="25" x2="525" y2="655" />
        <circle cx="525" cy="340" r="91.5" />
        <rect x="25" y="138.5" width="165" height="403" />
        <rect x="25" y="248.5" width="55" height="183" />
        <rect x="860" y="138.5" width="165" height="403" />
        <rect x="970" y="248.5" width="55" height="183" />
        <path d="M190 267a91.5 91.5 0 0 1 0 146" />
        <path d="M860 267a91.5 91.5 0 0 0 0 146" />
        <path d="M25 40a15 15 0 0 0 15-15M1010 25a15 15 0 0 0 15 15M25 640a15 15 0 0 1 15 15M1010 655a15 15 0 0 1 15-15" />
      </g>
      <g fill="currentColor">
        <circle cx="525" cy="340" r="5" />
        <circle cx="135" cy="340" r="4" />
        <circle cx="915" cy="340" r="4" />
      </g>
    </svg>
  );
}

/** Section divider styled like a halfway line with a center circle. */
export function HalfwayDivider({ className = '' }: { className?: string }) {
  return (
    <div className={`relative mx-auto flex max-w-6xl items-center px-4 ${className}`} aria-hidden="true">
      <span className="h-[2px] flex-1 bg-white/40" />
      <span className="mx-3 grid h-12 w-12 place-items-center rounded-full border-2 border-white/40">
        <span className="h-2 w-2 rounded-full bg-white/60" />
      </span>
      <span className="h-[2px] flex-1 bg-white/40" />
    </div>
  );
}

/** Penalty-box corner bracket used to frame section headings. */
export function BoxCorners({ className = '' }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`pointer-events-none absolute inset-0 ${className}`}>
      <span className="absolute start-0 top-0 h-5 w-5 border-s-2 border-t-2 border-white/60" />
      <span className="absolute end-0 top-0 h-5 w-5 border-e-2 border-t-2 border-white/60" />
      <span className="absolute bottom-0 start-0 h-5 w-5 border-b-2 border-s-2 border-white/60" />
      <span className="absolute bottom-0 end-0 h-5 w-5 border-b-2 border-e-2 border-white/60" />
    </span>
  );
}

export function SectionHeading({ title, subtitle, align = 'center' }: { title: string; subtitle?: string; align?: 'center' | 'start' }) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <h2 className="heading text-4xl sm:text-5xl">{title}</h2>
      {subtitle && <p className="mt-3 text-base text-white/85 sm:text-lg">{subtitle}</p>}
      <span aria-hidden="true" className={`mt-4 block h-1 w-16 rounded-full bg-card ${align === 'center' ? 'mx-auto' : ''}`} />
    </div>
  );
}
