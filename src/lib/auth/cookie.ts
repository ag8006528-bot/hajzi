/** Edge-safe constants (imported by middleware — no Node APIs here). */
// "__Host-" prefix: browser enforces Secure, Path=/ and no Domain (can't be set by subdomains).
export const SESSION_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-hajzi_session' : 'hajzi_session';
/** Separate cookie for customer accounts. */
export const CUSTOMER_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-hajzi_customer' : 'hajzi_customer';
