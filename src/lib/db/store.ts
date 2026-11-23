import type {
  AuditEntry,
  Block,
  Booking,
  BookingInput,
  BusyInterval,
  ContactMessage,
  Customer,
  Field,
  FieldInput,
  Session,
  User,
} from '../types';

export interface BookingFilter {
  date?: string;
  fieldId?: string;
  fieldType?: string;
  status?: string;
  customerId?: string;
}

export interface CreateBookingOptions {
  /** Max confirmed bookings one phone number may hold for the same day. */
  maxPerPhonePerDay: number;
  /** Max upcoming confirmed bookings one phone number may hold in total. */
  maxActivePerPhone: number;
  /** SHA-256 of the customer's access token. */
  accessTokenHash: string;
  ref: string;
  /** Signed-in customer making the booking, if any. */
  customerId?: string;
}

/**
 * The data-access contract used by the whole app.
 * The default implementation stores everything in a JSON file (see json-store.ts).
 * To move to Supabase / PostgreSQL, implement this interface and return it from getStore()
 * (see supabase/migrations/001_schema_rls.sql for the schema, constraints and RLS policies).
 * IMPORTANT: createBooking() must be atomic (transaction + exclusion constraint) so that
 * double booking stays impossible.
 */
export interface DataStore {
  listFields(): Promise<Field[]>;
  getField(id: string): Promise<Field | null>;
  createField(input: FieldInput): Promise<Field>;
  updateField(id: string, input: Partial<FieldInput>): Promise<Field | null>;
  deleteField(id: string): Promise<boolean>;

  listBookings(filter?: BookingFilter): Promise<Booking[]>;
  getBookingById(id: string): Promise<Booking | null>;
  getBookingByRef(ref: string): Promise<Booking | null>;
  /** Throws SlotTakenError / PhoneLimitError / NotFoundError. */
  createBooking(input: BookingInput, opts: CreateBookingOptions): Promise<Booking>;
  setBookingStatus(id: string, status: Booking['status']): Promise<Booking | null>;

  listBlocks(fieldId: string, date: string): Promise<Block[]>;
  addBlock(fieldId: string, date: string, startMinutes: number, durationMinutes: number): Promise<Block>;
  removeBlock(id: string): Promise<Block | null>;

  getBusy(fieldId: string, date: string): Promise<BusyInterval[]>;

  countUsers(): Promise<number>;
  listUsers(): Promise<User[]>;
  getUserByEmail(email: string): Promise<User | null>;
  getUserById(id: string): Promise<User | null>;
  createUser(user: User): Promise<User>;
  updateUser(id: string, patch: Partial<User>): Promise<User | null>;

  getCustomerByEmail(email: string): Promise<Customer | null>;
  getCustomerById(id: string): Promise<Customer | null>;
  /** Throws Error('CUSTOMER_EXISTS') if the email is taken. */
  createCustomer(c: Customer): Promise<Customer>;
  updateCustomer(id: string, patch: Partial<Customer>): Promise<Customer | null>;

  createSession(s: Session): Promise<void>;
  getSession(id: string): Promise<Session | null>;
  deleteSession(id: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;

  addAudit(e: AuditEntry): Promise<void>;
  listAudit(limit: number): Promise<AuditEntry[]>;

  addMessage(m: ContactMessage): Promise<void>;
  listMessages(limit: number): Promise<ContactMessage[]>;

  /** Anonymise bookings / delete logs older than the cutoff (ISO date). Returns counts. */
  runRetention(cutoffDate: string): Promise<{ bookings: number; audit: number; messages: number }>;
}

export class SlotTakenError extends Error {
  constructor() {
    super('SLOT_TAKEN');
  }
}
export class PhoneLimitError extends Error {
  constructor() {
    super('PHONE_LIMIT');
  }
}
export class NotFoundError extends Error {
  constructor(what = 'NOT_FOUND') {
    super(what);
  }
}
