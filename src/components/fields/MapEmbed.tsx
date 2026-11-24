import { mapEmbedSrc } from '@/config/business';

/** Google Maps embed (no API key needed). Lazy-loaded to protect page performance. */
export function MapEmbed({
  lat,
  lng,
  title,
  className = '',
  zoom,
  query,
}: {
  lat: number;
  lng: number;
  title: string;
  className?: string;
  zoom?: number;
  query?: string;
}) {
  return (
    <div className={`overflow-hidden rounded-2xl border-2 border-white/80 bg-pitch-dark shadow-panel ${className}`}>
      <iframe
        title={title}
        src={mapEmbedSrc(lat, lng, zoom, query)}
        className="block h-72 w-full sm:h-80"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  );
}
