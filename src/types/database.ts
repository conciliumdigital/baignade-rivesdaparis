// Types alignés avec le schéma Supabase
export type UserRole = 'admin' | 'manager' | 'staff' | 'user';

export type SlotStatus = 'open' | 'closed' | 'private' | 'archived';

export type ReservationStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'cancelled'
  | 'refunded'
  | 'used'
  | 'no_show'
  | 'expired';

export type UsagerType = 'habitant' | 'exterieur' | 'groupe' | 'ecole';

export type ScanResult = 'valid' | 'already_used' | 'invalid' | 'expired' | 'wrong_slot';

export interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: UserRole;
  is_resident: boolean;
  resident_proof_url: string | null;
  notification_email: boolean;
  notification_sms: boolean;
  rgpd_consent_at: string | null;
  marketing_consent: boolean;
  created_at: string;
  updated_at: string;
}

export interface Slot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  capacity_residents: number;
  capacity_groups: number;
  price_cents: number;
  price_resident_cents: number | null;
  price_child_cents: number | null;
  status: SlotStatus;
  closure_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface SlotAvailability {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  capacity: number;
  price_cents: number;
  price_resident_cents: number | null;
  status: SlotStatus;
  booked: number;
  remaining: number;
}

export interface Reservation {
  id: string;
  reference: string;
  user_id: string;
  slot_id: string;
  status: ReservationStatus;
  usager_type: UsagerType;
  nb_adults: number;
  nb_children: number;
  total_amount_cents: number;
  qr_code_token: string | null;
  qr_used_at: string | null;
  scanned_by: string | null;
  stripe_session_id: string | null;
  stripe_payment_intent: string | null;
  stripe_refund_id: string | null;
  notes: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  resident_proof_url: string | null;
  honor_certification: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReservationWithSlot extends Reservation {
  slot: Slot;
}

export interface ScanLogEntry {
  id: string;
  reservation_id: string | null;
  scanned_by: string | null;
  result: ScanResult;
  scanned_at: string;
  device_info: string | null;
  notes: string | null;
}

export interface SatisfactionResponse {
  id: string;
  reservation_id: string | null;
  user_id: string | null;
  rating_overall: number | null;
  rating_cleanliness: number | null;
  rating_staff: number | null;
  comment: string | null;
  nps: number | null;
  created_at: string;
}

export interface SiteSetting {
  key: string;
  value: unknown;
  updated_at: string;
  updated_by: string | null;
}
