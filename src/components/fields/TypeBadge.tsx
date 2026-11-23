import type { FieldType } from '@/lib/types';

/** High-visibility field type badge (5v5 = yellow card, 11v11 = white). */
export function TypeBadge({ type, className = '', size = 'md' }: { type: FieldType; className?: string; size?: 'md' | 'lg' }) {
  const color = type === '5v5' ? 'bg-card text-ink' : 'bg-white text-pitch-dark';
  const sz = size === 'lg' ? 'px-4 py-1.5 text-2xl' : 'px-3 py-1 text-lg';
  return (
    <span
      dir="ltr"
      className={`inline-flex items-center gap-1 rounded-md font-display leading-none tracking-wider shadow-md ring-1 ring-black/10 ${color} ${sz} ${className}`}
      style={{ fontFamily: 'var(--font-display)' }}
    >
      {type}
    </span>
  );
}
