/**
 * FICTIONAL demo fields (invented names) with free-licence Unsplash photos (see public/fields/CREDITS.md).
 * Used by the automated tests and when HAJZI_SEED=demo. Real listings live in src/data/seed.ts.
 */
import { business } from '@/config/business';
import type { Field } from '@/lib/types';

const now = '2026-01-01T00:00:00.000Z';
const img = (id: string, n: number) => Array.from({ length: n }, (_, i) => `/fields/${id}-${i + 1}.webp`);

export const demoFields: Field[] = [
  {
    id: 'green-line-arena',
    name: { en: 'Green Line Arena', ar: 'ملعب الخط الأخضر' },
    type: '5v5',
    area: { en: 'Khalda, Amman', ar: 'خلدا، عمّان' },
    address: { en: 'Al-Hajjaj St, Khalda, Amman', ar: 'شارع الحجاج، خلدا، عمّان' },
    description: {
      en: 'Fast 5-a-side pitch with fresh FIFA-standard artificial turf, full floodlights and a covered spectator area. Ideal for after-work games.',
      ar: 'ملعب خماسي سريع بعشب صناعي جديد بمواصفات FIFA، إضاءة كاملة ومنطقة مظللة للمشاهدين. مثالي لمباريات ما بعد العمل.',
    },
    coordinates: { lat: 31.9993, lng: 35.8318 },
    pricePerHour: 30,
    phone: business.phone,
    whatsapp: business.whatsapp,
    size: '40m × 20m',
    surface: 'artificial',
    lighting: true,
    amenities: ['parking', 'changingRooms', 'showers'],
    images: img('green-line-arena', 3),
    featured: true,
    createdAt: now,
  },
  {
    id: 'midfield-five',
    name: { en: 'Midfield Five', ar: 'ملعب ميدفيلد الخماسي' },
    type: '5v5',
    area: { en: 'Jabal Al-Hussein, Amman', ar: 'جبل الحسين، عمّان' },
    address: { en: 'Khalid Bin Al-Walid St, Jabal Al-Hussein, Amman', ar: 'شارع خالد بن الوليد، جبل الحسين، عمّان' },
    description: {
      en: 'Enclosed 5v5 cage in the heart of the city — no lost balls, quick games, and a café to cool down after the match.',
      ar: 'ملعب خماسي مسيّج في قلب المدينة — بدون ضياع للكرة، مباريات سريعة، ومقهى للاستراحة بعد المباراة.',
    },
    coordinates: { lat: 31.9667, lng: 35.9161 },
    pricePerHour: 25,
    phone: business.phone,
    whatsapp: business.whatsapp,
    size: '36m × 18m',
    surface: 'artificial',
    lighting: true,
    amenities: ['changingRooms', 'cafe'],
    images: img('midfield-five', 2),
    featured: true,
    createdAt: now,
  },
  {
    id: 'golden-boot-stadium',
    name: { en: 'Golden Boot Stadium', ar: 'ملعب الحذاء الذهبي' },
    type: '11v11',
    area: { en: 'Sweileh, Amman', ar: 'صويلح، عمّان' },
    address: { en: 'Al-Sharia College St, Sweileh, Amman', ar: 'شارع كلية الشريعة، صويلح، عمّان' },
    description: {
      en: 'Full-size natural grass pitch with stadium-grade floodlights and proper goals — the real match-day experience for leagues and big groups.',
      ar: 'ملعب بحجم كامل بعشب طبيعي وإضاءة ملاعب احترافية ومرامي رسمية — تجربة يوم المباراة الحقيقية للدوريات والمجموعات الكبيرة.',
    },
    coordinates: { lat: 32.0234, lng: 35.8401 },
    pricePerHour: 85,
    phone: business.phone,
    whatsapp: business.whatsapp,
    size: '105m × 68m',
    surface: 'natural',
    lighting: true,
    amenities: ['parking', 'changingRooms', 'showers', 'cafe'],
    images: img('golden-boot-stadium', 3),
    featured: true,
    createdAt: now,
  },
  {
    id: 'corner-flag-park',
    name: { en: 'Corner Flag Park', ar: 'ملعب ركنية بارك' },
    type: '11v11',
    area: { en: 'Abu Nseir, Amman', ar: 'أبو نصير، عمّان' },
    address: { en: 'Abu Nseir Main St, Amman', ar: 'شارع أبو نصير الرئيسي، عمّان' },
    description: {
      en: 'All-weather full-size artificial pitch, playable every day of the year. Great value for corporate tournaments and weekly leagues.',
      ar: 'ملعب صناعي بحجم كامل يصلح لكل الأجواء ويمكن اللعب عليه طوال أيام السنة. قيمة ممتازة لبطولات الشركات والدوريات الأسبوعية.',
    },
    coordinates: { lat: 32.0538, lng: 35.8796 },
    pricePerHour: 70,
    phone: business.phone,
    whatsapp: business.whatsapp,
    size: '100m × 64m',
    surface: 'artificial',
    lighting: true,
    amenities: ['parking', 'changingRooms', 'showers'],
    images: img('corner-flag-park', 3),
    featured: false,
    createdAt: now,
  },
];
