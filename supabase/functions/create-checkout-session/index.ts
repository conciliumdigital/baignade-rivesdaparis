// Edge Function: create-checkout-session
// Crée une session Stripe Checkout pour une réservation et retourne
// l'URL de redirection.
//
// SÉCURITÉ (durcissement v1.4.0) :
//  - JWT requis : déployer avec `--verify-jwt` (sans `--no-verify-jwt`).
//  - Vérification d'ownership : le caller doit être propriétaire de la
//    réservation OU staff/admin. Empêche un anon de deviner un UUID et
//    de générer une session Stripe pour la réservation d'autrui (fuite
//    de customer_email + détournement de checkout).
//  - CORS restreint au domaine de production + previews Netlify.
// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';

const ALLOWED_ORIGINS = new Set([
  'https://baignade.lesrivesdeparis.fr',
  'https://exquisite-sable-8f9d45.netlify.app',
  'http://localhost:5173',
  'http://localhost:4173',
]);

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://baignade.lesrivesdeparis.fr';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

serve(async (req: Request) => {
  const cors = corsHeaders(req.headers.get('Origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    // --- Authentification : identité dérivée du JWT, jamais du body ---
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return json(cors, { error: 'Authentification requise' }, 401);
    }
    const authClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await authClient.auth.getUser();
    if (authErr || !user) {
      return json(cors, { error: 'Session invalide' }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const reservation_id = typeof body?.reservation_id === 'string' ? body.reservation_id : null;
    if (!reservation_id) return json(cors, { error: 'reservation_id requis' }, 400);

    const { data: reservation, error } = await supabase
      .from('reservations')
      .select('*, slot:slots(*), user:profiles(email, first_name, last_name)')
      .eq('id', reservation_id)
      .single();

    if (error || !reservation) return json(cors, { error: 'Réservation introuvable' }, 404);

    // --- Ownership check (anti-énumération d'UUID + fuite d'email) ---
    // Le caller doit être propriétaire OU staff/admin.
    let isStaff = false;
    {
      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).maybeSingle();
      isStaff = !!profile && ['admin', 'manager', 'staff'].includes(profile.role);
    }
    if (reservation.user_id !== user.id && !isStaff) {
      return json(cors, { error: 'Accès refusé' }, 403);
    }

    if (reservation.status !== 'pending_payment') {
      return json(cors, { error: 'Cette réservation n\'est pas dans un état permettant un paiement.' }, 409);
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });
    const appUrl = Deno.env.get('APP_URL') ?? 'https://baignade.lesrivesdeparis.fr';

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: reservation.user?.email,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            unit_amount: reservation.total_amount_cents,
            product_data: {
              name: `Baignade Rives d'Paris · ${reservation.slot.date}`,
              description: `Créneau ${reservation.slot.start_time.slice(0, 5)} à ${reservation.slot.end_time.slice(0, 5)} · ${reservation.nb_adults} adulte(s)${reservation.nb_children > 0 ? ` + ${reservation.nb_children} enfant(s)` : ''}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        reservation_id: reservation.id,
        reference: reservation.reference,
      },
      success_url: `${appUrl}/reserver/confirmation/${reservation.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/reserver/${reservation.slot_id}`,
      locale: 'fr',
      allow_promotion_codes: true,
    });

    await supabase
      .from('reservations')
      .update({ stripe_session_id: session.id })
      .eq('id', reservation.id);

    return json(cors, { url: session.url, session_id: session.id });
  } catch (e: any) {
    return json(cors, { error: e?.message ?? 'Erreur interne' }, 500);
  }
});

function json(cors: Record<string, string>, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}
