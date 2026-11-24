/**
 * REAL football fields in Amman, collected from public Google Maps listings (name, phone, map location)
 * on 23 Nov 2026, with neighbourhoods checked against OpenStreetMap.
 *
 * Customers book these fields ONLINE through HAJZI (no calls needed). Bookings appear in /admin → Bookings,
 * and the HAJZI team passes them on to the venue (none of these venues has a partner agreement yet).
 *  - Price: 3 venues publish their own price (used as-is, with the source shown). For the rest the price is an
 *    ESTIMATE from typical Amman prices for similar pitches in that area, clearly labelled "approx." on the site.
 *  - Bookable hours follow each venue's listed closing time.
 *  - Surface / size are "unknown" where no reliable public source states them.
 *  - No photos: the venues' own photos are copyrighted, so the site shows its illustrated pitches.
 * Update any field in /admin → Fields (real price, photos, details) as you sign venues up.
 *
 * Apply to the database with:  npm run demo:reset-fields
 * The fictional, bookable demo fields (used by the tests) are in ./demo-fields.ts (HAJZI_SEED=demo).
 */
import type { Field, Localized } from '@/lib/types';
import { demoFields } from './demo-fields';

const now = '2026-11-23T00:00:00.000Z';
const slugify = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40); // same rule as the store, so ids stay stable

interface Listing {
  name: Localized;
  /** The venue's name exactly as listed on Google Maps (used for the "See real photos" link). */
  google: string;
  area: Localized;
  address: Localized;
  lat: number;
  lng: number;
  /** Local mobile number exactly as listed, e.g. "079 666 0022". */
  phone: string;
  /** Opening hours as listed on Google Maps (for the description). */
  hours: Localized;
  /** Listed as open late / 24 h, so the pitch is floodlit. */
  lit: boolean;
  kind?: 'pitch' | 'academy' | 'club';
  featured?: boolean;
  /** Only prices the venue itself published recently (own website / own social page), never guesses. */
  price?: { perHour: number; source: Localized };
  /** Facts confirmed on the venue's own website. */
  surface?: Field['surface'];
  amenities?: Field['amenities'];
  extra?: Localized;
}

const desc = (l: Listing): Localized => {
  const what =
    l.kind === 'academy'
      ? { en: 'Football academy with pitches for hire', ar: 'أكاديمية كرة قدم مع ملاعب للإيجار' }
      : l.kind === 'club'
        ? { en: 'Sports club football pitches', ar: 'ملاعب كرة قدم تابعة لنادٍ رياضي' }
        : { en: 'Football pitch for hire', ar: 'ملعب كرة قدم للإيجار' };
  return {
    en: `${what.en} in ${l.area.en}. ${l.hours.en}.${l.extra ? ` ${l.extra.en}` : ''} Pick a time and book online in seconds.`,
    ar: `${what.ar} في ${l.area.ar}. ${l.hours.ar}.${l.extra ? ` ${l.extra.ar}` : ''} اختر الوقت واحجز أونلاين خلال ثوانٍ.`,
  };
};

/** "079 666 0022" → { phone: "+962 79 666 0022", whatsapp: "962796660022" } */
const contact = (local: string) => {
  const d = local.replace(/\D/g, '').replace(/^0/, '');
  return { phone: `+962 ${d.slice(0, 2)} ${d.slice(2, 5)} ${d.slice(5)}`, whatsapp: `962${d}` };
};

/**
 * Approximate JOD/hour for a 5/6-a-side pitch, by area. Based on prices Amman venues publish themselves
 * (Nov 2026): Marar 15 (Al-Yarmouk), Al-Dasan 25 (Tareq), Al-Yarmouk SC 25, Aldaoud 25–30 (Shafa Badran),
 * Trax 35 peak (west Amman). West Amman is pricier than the east and south.
 */
const ESTIMATE_BY_AREA: Record<string, number> = {
  "Tla'a Al-Ali, Amman": 30, 'Dabouq, Amman': 30, 'Umm Al-Summaq, Amman': 30, 'Wadi Al-Seer, Amman': 30,
  'Al-Dhuhair, Marj Al-Hamam': 30, 'Shafa Badran, Amman': 25, 'Abu Nseir, Amman': 25, 'Al-Hussein Youth City, Amman': 25,
  'Basman, Amman': 25, 'Urjan, Amman': 25, 'Tareq, Amman': 25, 'Al-Muqabalain, Amman': 20, 'Al-Yarmouk, Amman': 20,
  'Khraibet Al-Souq, Amman': 20,
};
const estimate = (area: string) => ESTIMATE_BY_AREA[area] ?? 25;

/** "Open daily until 9 PM" → 1260 (minutes after midnight of the booking day; after-midnight values exceed 1440). */
const closeFrom = (hoursEn: string): number | undefined => {
  const m = /until (\d{1,2})(?::(\d{2}))? (AM|PM)/.exec(hoursEn);
  if (!m) return undefined;
  let h = Number(m[1]) % 12;
  if (m[3] === 'PM') h += 12;
  let mins = h * 60 + Number(m[2] ?? 0);
  if (m[3] === 'AM') mins += 1440; // closes after midnight
  return mins;
};

const H24 = { en: 'Open 24 hours', ar: 'مفتوح 24 ساعة' };
const until = (en: string, ar: string) => ({ en: `Open daily until ${en}`, ar: `مفتوح يومياً حتى ${ar}` });
const askHours = { en: 'Ask the field for opening hours', ar: 'اسأل الملعب عن أوقات الدوام' };

const listings: Listing[] = [
  {
    name: { en: 'Mayar Football Pitch', ar: 'ملعب ميار لكرة القدم' },
    google: "Mayar Football Pitch",
    area: { en: "Tla'a Al-Ali, Amman", ar: 'تلاع العلي، عمّان' },
    address: { en: "Usamah Bin Munqeth St, Al-Baraka, Tla'a Al-Ali (XVVJ+8CF)", ar: 'شارع أسامة بن منقذ، البركة، تلاع العلي (XVVJ+8CF)' },
    lat: 31.993322, lng: 35.881036, phone: '079 077 7983', hours: until('9 PM', '9 مساءً'), lit: true,
  },
  {
    name: { en: 'Al-Hussein Youth City 6-a-side Pitches', ar: 'ملاعب سداسية مدينة الحسين للشباب' },
    google: "ملاعب سداسية مدينة الحسين للشباب",
    area: { en: 'Al-Hussein Youth City, Amman', ar: 'مدينة الحسين للشباب، عمّان' },
    address: { en: 'Queen Alia St, Al-Hussein Youth City (XWJ3+P2P)', ar: 'شارع الملكة علياء، مدينة الحسين للشباب (XWJ3+P2P)' },
    lat: 31.9818254, lng: 35.9025911, phone: '078 160 0016', hours: until('12 AM', '12 منتصف الليل'), lit: true,
  },
  {
    name: { en: 'KHBP Football Field', ar: 'ملعب KHBP لكرة القدم' },
    google: "KHBP Football Field",
    area: { en: 'Dabouq, Amman', ar: 'دابوق، عمّان' },
    address: { en: 'King Abdullah II St, King Hussein Business Park (XRCJ+3WC)', ar: 'شارع الملك عبدالله الثاني، مجمع الملك حسين للأعمال (XRCJ+3WC)' },
    lat: 31.9703331, lng: 35.8325457, phone: '079 162 0626', hours: until('9 PM', '9 مساءً'), lit: true,
  },
  {
    name: { en: 'Aldaoud Goal Space', ar: 'ملعب الداود جول سبيس' },
    google: "Aldaoud goal space",
    area: { en: 'Shafa Badran, Amman', ar: 'شفا بدران، عمّان' },
    address: { en: 'Shafa Badran St, Yajouz, Amman', ar: 'شارع شفا بدران، ياجوز، عمّان' },
    lat: 32.0323357, lng: 35.9132521, phone: '079 570 2164', hours: until('2 AM', '2 فجراً'), lit: true,
    price: {
      perHour: 30,
      source: {
        en: 'its own website (25 JD/hour daytime, 30 JD/hour evenings), checked 23 Nov 2026',
        ar: 'موقعه الإلكتروني (25 د.أ للساعة نهاراً، 30 د.أ للساعة مساءً)، تم التحقق في 23 تشرين الثاني 2026',
      },
    },
    surface: 'artificial',
    amenities: ['parking', 'changingRooms', 'showers'],
    extra: {
      en: 'Four 5-a-side courts with FIFA-grade artificial turf and LED floodlights.',
      ar: 'أربعة ملاعب خماسية بعشب صناعي بمواصفات FIFA وإضاءة LED.',
    },
  },
  {
    name: { en: 'Champions Football Academy', ar: 'أكاديمية الأبطال لكرة القدم' },
    google: "Champions Football Academy",
    area: { en: 'Al-Dhuhair, Marj Al-Hamam', ar: 'الظهير، مرج الحمام' },
    address: { en: 'Al-Dhuhair, Marj Al-Hamam (WV95+W7P)', ar: 'الظهير، مرج الحمام (WV95+W7P)' },
    lat: 31.9198378, lng: 35.8582166, phone: '079 667 7481', hours: H24, lit: true, kind: 'academy', featured: true,
  },
  {
    name: { en: 'Amman Football Club', ar: 'نادي عمّان لكرة القدم' },
    google: "Amman Football Club",
    area: { en: 'Wadi Al-Seer, Amman', ar: 'وادي السير، عمّان' },
    address: { en: 'Wadi Al-Seer, Amman (WRJV+G2W)', ar: 'وادي السير، عمّان (WRJV+G2W)' },
    lat: 31.931354, lng: 35.8425649, phone: '079 528 8323', hours: until('10:30 PM', '10:30 مساءً'), lit: true, kind: 'club',
  },
  {
    name: { en: 'JO Street Court', ar: 'ملعب جو ستريت' },
    google: "JO STREET COURT",
    area: { en: 'Abu Nseir, Amman', ar: 'أبو نصير، عمّان' },
    address: { en: 'Al-Urdon St, Abu Nseir, Amman', ar: 'شارع الأردن، أبو نصير، عمّان' },
    lat: 32.0407237, lng: 35.8822935, phone: '078 805 1885', hours: H24, lit: true,
  },
  {
    name: { en: 'Yarmouk Sports Stadiums', ar: 'ملاعب اليرموك الرياضية' },
    google: "Yarmouk Sports stadiums",
    area: { en: 'Basman, Amman', ar: 'بسمان، عمّان' },
    address: { en: 'Istiqlal St 90, Amman', ar: 'شارع الاستقلال 90، عمّان' },
    lat: 31.9807549, lng: 35.921602, phone: '079 778 8304', hours: until('12:30 AM', '12:30 بعد منتصف الليل'), lit: true,
  },
  {
    name: { en: 'Al-Shifa Pitches', ar: 'ملاعب الشفا' },
    google: "ملاعب الشفا",
    area: { en: 'Shafa Badran, Amman', ar: 'شفا بدران، عمّان' },
    address: { en: 'Shafa Badran St, Shafa Badran, Amman', ar: 'شارع شفا بدران، شفا بدران، عمّان' },
    lat: 32.0454499, lng: 35.9092845, phone: '079 773 1135', hours: H24, lit: true,
  },
  {
    name: { en: 'Martyr Pilot Ayed Al-Dasan 6-a-side Pitches', ar: 'ملاعب الشهيد الطيار عايد الدعسان السداسية لكرة القدم' },
    google: "ملاعب الشهيد الطيار عايد الدعسان السداسية لكرة القدم",
    area: { en: 'Tareq, Amman', ar: 'طارق، عمّان' },
    address: { en: 'Tareq, Marka, Amman (2X99+3PQ)', ar: 'طارق، ماركا، عمّان (2X99+3PQ)' },
    lat: 32.0177111, lng: 35.969358, phone: '079 595 3848', hours: H24, lit: true, featured: true,
    price: {
      perHour: 25,
      source: {
        en: 'its Facebook page (1 h 25 JD, 1.5 h 35 JD, 2 h 45 JD), checked 23 Nov 2026',
        ar: 'صفحته على فيسبوك (ساعة 25 د.أ، ساعة ونصف 35 د.أ، ساعتان 45 د.أ)، تم التحقق في 23 تشرين الثاني 2026',
      },
    },
  },
  {
    name: { en: 'Jordan Galaxy Stadium', ar: 'ملاعب جوردن جلاكسي' },
    google: "Jordan galaxy stadium",
    area: { en: 'Al-Dhuhair, Marj Al-Hamam', ar: 'الظهير، مرج الحمام' },
    address: { en: 'Naltshek St, Al-Dhuhair, Marj Al-Hamam', ar: 'شارع نالتشك، الظهير، مرج الحمام' },
    lat: 31.9297393, lng: 35.8484681, phone: '077 248 2828', hours: H24, lit: true,
  },
  {
    name: { en: 'PASS Soccer Field', ar: 'ملعب باس لكرة القدم' },
    google: "PASS soccer field",
    area: { en: 'Al-Muqabalain, Amman', ar: 'المقابلين، عمّان' },
    address: { en: 'Sheehan St, Al-Yasmeen, Al-Muqabalain (WV7W+4R6)', ar: 'شارع شيحان، الياسمين، المقابلين (WV7W+4R6)' },
    lat: 31.9128125, lng: 35.8970625, phone: '078 666 0727', hours: H24, lit: true,
  },
  {
    name: { en: 'Stadiums Legend Football Academy', ar: 'أكاديمية ستاديومز ليجند لكرة القدم' },
    google: "Stadiums Legend Football Academy",
    area: { en: 'Wadi Al-Seer, Amman', ar: 'وادي السير، عمّان' },
    address: { en: 'Salama Ben Hatib St, Wadi Al-Seer, Amman', ar: 'شارع سلامة بن حاطب، وادي السير، عمّان' },
    lat: 31.9338229, lng: 35.845833, phone: '079 111 1450', hours: H24, lit: true, kind: 'academy', featured: true,
  },
  {
    name: { en: 'Mecca Campo', ar: 'مكة كامبو' },
    google: "Mecca Campo",
    area: { en: "Tla'a Al-Ali, Amman", ar: 'تلاع العلي، عمّان' },
    address: { en: "Mamdouh Al-Sarayrah St, Tla'a Al-Ali, Amman", ar: 'شارع ممدوح الصرايرة، تلاع العلي، عمّان' },
    lat: 31.9745781, lng: 35.8471669, phone: '077 750 0025', hours: H24, lit: true,
  },
  {
    name: { en: 'Jordan Knights Football Academy', ar: 'أكاديمية فرسان الأردن لكرة القدم' },
    google: "Jordan Knights FootballAcademy",
    area: { en: 'Wadi Al-Seer, Amman', ar: 'وادي السير، عمّان' },
    address: { en: 'Al-Imam Shamel St, Wadi Al-Seer, Amman (WRHV+GR)', ar: 'شارع الإمام شامل، وادي السير، عمّان (WRHV+GR)' },
    lat: 31.9309616, lng: 35.8446587, phone: '077 181 1111', hours: until('11:30 PM', '11:30 مساءً'), lit: true, kind: 'academy', featured: true,
  },
  {
    name: { en: 'Dabouq Football Pitch', ar: 'ملعب الفردوس' },
    google: "Dabouq Football Pitch",
    area: { en: 'Dabouq, Amman', ar: 'دابوق، عمّان' },
    address: { en: 'Dabouq, Amman (XRQ6+R83)', ar: 'دابوق، عمّان (XRQ6+R83)' },
    lat: 31.9895007, lng: 35.8107838, phone: '079 970 4094', hours: H24, lit: true,
  },
  {
    name: { en: 'Al-Hikma Schools Sports Complex', ar: 'مجمع مدارس الحكمة الرياضي' },
    google: "مجمع مدارس الحكمة الرياضي",
    area: { en: 'Urjan, Amman', ar: 'عرجان، عمّان' },
    address: { en: 'Yahya Al-Idrisi St, next to Al-Hikma Boys School, Urjan', ar: 'شارع يحيى الإدريسي، بجانب مدارس الحكمة للبنين، عرجان' },
    lat: 31.9808625, lng: 35.9212697, phone: '079 737 7577', hours: until('12 AM', '12 منتصف الليل'), lit: true,
  },
  {
    name: { en: 'Arab Community College Pitch', ar: 'ملعب كلية المجتمع العربي' },
    google: "ملعب كلية المجتمع العربي",
    area: { en: "Tla'a Al-Ali, Amman", ar: 'تلاع العلي، عمّان' },
    address: { en: "Suheil Al-Majdhoubeh St, Tla'a Al-Ali (former Philadelphia parking)", ar: 'شارع سهيل المجذوبة، تلاع العلي (مواقف فيلادلفيا سابقاً)' },
    lat: 32.0060213, lng: 35.8692489, phone: '079 577 9933', hours: until('12 AM', '12 منتصف الليل'), lit: true,
  },
  {
    name: { en: 'Abu Nseir Sports Club Pitches', ar: 'ملاعب نادي أبو نصير الرياضي' },
    google: "ملاعب نادي ابو نصير الرياضي",
    area: { en: 'Abu Nseir, Amman', ar: 'أبو نصير، عمّان' },
    address: { en: 'Nahr Banias St, Al-Farouq, Abu Nseir (3V6P+P3Q)', ar: 'شارع نهر بانياس، الفاروق، أبو نصير (3V6P+P3Q)' },
    lat: 32.0618351, lng: 35.8852345, phone: '079 983 3681', hours: askHours, lit: false, kind: 'club',
  },
  {
    name: { en: "Al-Khawarizmi College 6-a-side Pitch", ar: 'ملعب كلية الخوارزمي السداسي' },
    google: "ملعب كلية الخوارزمي تلاع العلي",
    area: { en: 'Umm Al-Summaq, Amman', ar: 'أم السماق، عمّان' },
    address: { en: "Flayeh Al-Sulayman Al-Assaf St, Umm Al-Summaq, Tla'a Al-Ali", ar: 'شارع فليح السليمان العساف، أم السماق، تلاع العلي' },
    lat: 31.9928826, lng: 35.8603765, phone: '079 551 5517', hours: until('12 AM', '12 منتصف الليل'), lit: true,
  },
  {
    name: { en: 'Al-Maaref Pitches', ar: 'ملاعب المعارف' },
    google: "ملاعب المعارف",
    area: { en: 'Umm Al-Summaq, Amman', ar: 'أم السماق، عمّان' },
    address: { en: 'Bahjat Al-Talhouni St, Umm Al-Summaq, Amman', ar: 'شارع بهجت التلهوني، أم السماق، عمّان' },
    lat: 31.9889109, lng: 35.8424205, phone: '079 880 3134', hours: until('2 AM', '2 فجراً'), lit: true,
  },
  {
    name: { en: 'Marar Football Pitch', ar: 'ملعب مرار لكرة القدم' },
    google: "ملعب مرار لكرة القدم",
    area: { en: 'Al-Yarmouk, Amman', ar: 'اليرموك، عمّان' },
    address: { en: 'Al-Sirat St 2, Al-Yarmouk, Amman', ar: 'شارع الصراط 2، اليرموك، عمّان' },
    lat: 31.921647, lng: 35.941997, phone: '079 120 0201', hours: H24, lit: true,
    price: {
      perHour: 15,
      source: {
        en: 'its Instagram and Facebook pages ("fixed prices, 15 JD per hour"), checked 23 Nov 2026',
        ar: 'صفحاته على إنستغرام وفيسبوك ("أسعارنا ثابتة، الساعة 15 دينار")، تم التحقق في 23 تشرين الثاني 2026',
      },
    },
  },
  {
    name: { en: 'Al-Wehdat Club Pitches', ar: 'ملاعب نادي الوحدات' },
    google: "ملاعب نادي الوحدات",
    area: { en: 'Khraibet Al-Souq, Amman', ar: 'خريبة السوق، عمّان' },
    address: { en: 'Khraibet Al-Souq, Amman', ar: 'خريبة السوق، عمّان' },
    lat: 31.8613452, lng: 35.9034843, phone: '078 817 1714', hours: until('2 AM', '2 فجراً'), lit: true, kind: 'club',
  },
];

export const realFields: Field[] = listings.map((l) => ({
  id: slugify(l.name.en),
  name: l.name,
  type: '5v5',
  area: l.area,
  address: l.address,
  description: desc(l),
  coordinates: { lat: l.lat, lng: l.lng },
  mapsQuery: l.google,
  pricePerHour: l.price?.perHour ?? estimate(l.area.en),
  ...(l.price ? { priceSource: l.price.source } : { priceEstimated: true }),
  onlineBooking: true,
  ...(closeFrom(l.hours.en) !== undefined ? { closeMinutes: closeFrom(l.hours.en) } : {}),
  ...contact(l.phone),
  size: '',
  surface: l.surface ?? 'unknown',
  lighting: l.lit,
  amenities: l.amenities ?? [],
  images: [],
  featured: Boolean(l.featured),
  createdAt: now,
}));

/** Fields used to create a new database (and by `npm run demo:reset-fields`). */
export const seedFields = (): Field[] => (process.env.HAJZI_SEED === 'demo' ? demoFields : realFields);
