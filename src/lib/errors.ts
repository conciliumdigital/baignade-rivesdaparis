// =====================================================================
// Mapping centralisé des erreurs Supabase / PostgREST / RPC vers des
// messages utilisateur en français soutenu. À utiliser partout au lieu
// d'afficher `error.message` brut (sinon l'usager voit des messages
// techniques anglais type "JWT expired", "duplicate key value violates
// unique constraint", "new row violates row-level security policy").
//
// Source unique de vérité : appelée depuis tous les `catch` du front.
// =====================================================================

/** Codes d'erreur métier renvoyés par les RPC SQL (raise exception). */
export const SQL_CODE_MESSAGES: Record<string, string> = {
  // RPC liste d'attente (season_ops)
  AUTH_REQUIRED: 'Vous devez être connecté pour effectuer cette action.',
  INVALID_PERSONS: 'Le nombre de personnes indiqué n\'est pas valide.',
  SLOT_NOT_FOUND: 'Créneau introuvable.',
  SLOT_NOT_OPEN: 'Ce créneau n\'est pas ouvert à la réservation.',
  SLOT_IN_PAST: 'Ce créneau est déjà passé.',
  SLOT_NOT_FULL: 'Ce créneau dispose encore de places disponibles. La liste d\'attente n\'est pas nécessaire.',
  SLOT_FULL: 'Ce créneau vient d\'atteindre sa capacité maximale. Choisissez un autre créneau ou inscrivez-vous en liste d\'attente.',
  SLOT_CLOSED: 'Ce créneau a été fermé. Aucune nouvelle réservation n\'est possible.',

  // RPC cancel_reservation (audit_fixes)
  RESERVATION_NOT_FOUND: 'Réservation introuvable.',
  RESERVATION_NOT_CANCELLABLE: 'Cette réservation ne peut pas être annulée dans son état actuel.',
  CANCELLATION_DEADLINE_PASSED: 'Le délai d\'annulation est dépassé (24 h avant le créneau).',
  FORBIDDEN: 'Vous n\'êtes pas autorisé à effectuer cette action.',
};

/** Statuts SQL anglais → libellés FR (utilisé par /staff et /compte). */
export const STATUS_LABELS_FR: Record<string, string> = {
  pending_payment: 'paiement en attente',
  confirmed: 'confirmée',
  cancelled: 'annulée',
  refunded: 'remboursée',
  used: 'utilisée',
  no_show: 'non présentée',
  expired: 'expirée',
};

/**
 * Convertit un statut de réservation en libellé français.
 */
export function formatReservationStatus(status: string | null | undefined): string {
  if (!status) return 'inconnu';
  return STATUS_LABELS_FR[status] ?? status;
}

/**
 * Extrait un message lisible d'une erreur Supabase / PostgREST / Edge.
 *
 * Stratégie :
 *  1. Si le message correspond à un code SQL stable (`SLOT_FULL`,
 *     `AUTH_REQUIRED`…), retourner la traduction FR.
 *  2. Si c'est un message PostgREST connu (RLS, JWT, contrainte
 *     unique…), retourner une formulation neutre.
 *  3. Sinon : message générique sans détail technique.
 */
export function mapSupabaseError(err: unknown): string {
  // Récupération robuste du message brut
  const raw = extractRawMessage(err);

  if (!raw) return 'Une erreur inattendue est survenue. Merci de réessayer.';

  // 1. Codes métiers SQL (raise exception 'SLOT_FULL', etc.)
  // Le message Postgres peut être préfixé/suffixé ; on cherche une
  // correspondance exacte sur un mot capitalisé connu.
  for (const code of Object.keys(SQL_CODE_MESSAGES)) {
    // \b pour éviter de matcher SLOT_FULL_VARIANT
    if (new RegExp(`\\b${code}\\b`).test(raw)) {
      return SQL_CODE_MESSAGES[code];
    }
  }

  // 2. Patterns PostgREST / Supabase connus
  if (/JWT (?:expired|expired)/i.test(raw) || /JWT.*expired/i.test(raw)) {
    return 'Votre session a expiré. Merci de vous reconnecter.';
  }
  if (/refresh.*token|invalid.*token/i.test(raw)) {
    return 'Votre session n\'est plus valide. Merci de vous reconnecter.';
  }
  if (/row-level security|RLS|violates.*policy/i.test(raw)) {
    return 'Vous n\'êtes pas autorisé à effectuer cette action.';
  }
  if (/duplicate key|already exists|unique constraint/i.test(raw)) {
    return 'Cette donnée existe déjà. Veuillez vérifier votre saisie.';
  }
  if (/violates foreign key|foreign key constraint/i.test(raw)) {
    return 'Donnée référencée introuvable.';
  }
  if (/violates check constraint|check constraint/i.test(raw)) {
    return 'Une des valeurs saisies n\'est pas dans les bornes autorisées.';
  }
  if (/Failed to fetch|NetworkError|net::|ERR_NETWORK/i.test(raw)) {
    return 'Connexion impossible au serveur. Vérifiez votre connexion Internet et réessayez.';
  }
  if (/rate limit|too many requests/i.test(raw)) {
    return 'Trop de tentatives. Merci de patienter quelques instants avant de réessayer.';
  }
  if (/email rate limit|over_email_send_rate_limit/i.test(raw)) {
    return 'Trop d\'e-mails envoyés récemment. Merci de patienter quelques minutes.';
  }
  if (/Email not confirmed/i.test(raw)) {
    return 'Adresse électronique non vérifiée.';
  }
  if (/User not found|user_not_found/i.test(raw)) {
    return 'Utilisateur introuvable.';
  }
  if (/Capacit.{0,3} du cr.{0,3}neau d.{0,3}pass.{0,3}e/i.test(raw)) {
    // Message FR existant côté trigger check_slot_capacity
    return raw;
  }
  if (/Créneau introuvable/i.test(raw)) {
    return 'Créneau introuvable.';
  }

  // 3. Fallback : si le message brut a l'air français et lisible, on
  //    le garde ; sinon générique.
  if (looksLikeFrenchUserMessage(raw)) return raw;
  return 'L\'opération a échoué. Merci de réessayer dans quelques instants.';
}

function extractRawMessage(err: unknown): string {
  if (!err) return '';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message;
  if (typeof err === 'object') {
    const e = err as Record<string, unknown>;
    if (typeof e.message === 'string') return e.message;
    if (typeof e.error_description === 'string') return e.error_description as string;
    if (typeof e.error === 'string') return e.error as string;
    if (typeof e.hint === 'string' && typeof e.details === 'string') {
      return `${e.details} ${e.hint}`;
    }
  }
  return '';
}

function looksLikeFrenchUserMessage(s: string): boolean {
  // Heuristique simple : contient au moins un mot français courant et
  // pas de stack trace / JSON / code SQL en anglais.
  if (s.length > 220) return false;
  if (/^[A-Z_]{4,}$/.test(s)) return false; // code brut SLOT_FOO
  if (/at \w+\.\w+\(/.test(s)) return false; // stack trace
  if (/^\{.*\}$/.test(s)) return false; // JSON brut
  return /\b(le|la|les|un|une|des|votre|merci|veuillez|cr[ée]neau|r[ée]servation)\b/i.test(s);
}
