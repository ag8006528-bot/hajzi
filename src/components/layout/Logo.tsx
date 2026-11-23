import Link from 'next/link';

/** Text logo: "HAJZI" with the "A" replaced by a center-circle pitch motif. */
export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true" focusable="false">
      <rect x="1.5" y="1.5" width="37" height="37" rx="9" fill="#FFD60A" />
      <rect x="6" y="9" width="28" height="22" rx="1.5" fill="none" stroke="#0F4D26" strokeWidth="2" />
      <line x1="20" y1="9" x2="20" y2="31" stroke="#0F4D26" strokeWidth="2" />
      <circle cx="20" cy="20" r="5" fill="none" stroke="#0F4D26" strokeWidth="2" />
      <circle cx="20" cy="20" r="1.6" fill="#0F4D26" />
      <rect x="6" y="15" width="4" height="10" fill="none" stroke="#0F4D26" strokeWidth="1.6" />
      <rect x="30" y="15" width="4" height="10" fill="none" stroke="#0F4D26" strokeWidth="1.6" />
    </svg>
  );
}

export function Logo({ className = '', size = 'md' }: { className?: string; size?: 'md' | 'lg' }) {
  const text = size === 'lg' ? 'text-5xl sm:text-6xl' : 'text-3xl';
  const mark = size === 'lg' ? 'h-12 w-12 sm:h-14 sm:w-14' : 'h-9 w-9';
  return (
    <Link href="/" className={`group inline-flex items-center gap-2.5 ${className}`} aria-label="HAJZI — home">
      <LogoMark className={`${mark} transition-transform duration-300 group-hover:rotate-[-8deg]`} />
      <span dir="ltr" className={`font-display ${text} leading-none tracking-[0.08em] text-white`} style={{ fontFamily: 'var(--font-display)' }}>
        HAJ<span className="text-card">Z</span>I
      </span>
    </Link>
  );
}
