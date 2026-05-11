// Edge Function: create-checkout-session
// Crée une session Stripe Checkout pour une réservation et retourne l'URL de redirection.
// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { reservation_id } = await req.json();
    if (!reservation_id) return json({ error: 'reservation_id requis' }, 400);

    const { data: reservation, error } = await supabase
      .from('reservations')
      .select('*, slot:slots(*), user:profiles(email, first_name, last_name)')
      .eq('id', reservation_id)
      .single();

    if (error || !reservation) return json({ error: 'Réservation introuvable' }, 404);
    if (reservation.status !== 'pending_payment') return json({ error: 'Statut invalide' }, 400);

    const appUrl = Deno.env.get('APP_URL') ?? 'https://baignade.rivesdaparis.fr';

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
              name: `Baignade Rives d'Paris — ${reservation.slot.date}`,
              description: `Créneau ${reservation.slot.start_time.slice(0, 5)} – ${reservation.slot.end_time.slice(0, 5)} · ${reservation.nb_adults} adulte(s)${reservation.nb_children > 0 ? ` + ${reservation.nb_children} enfant(s)` : ''}`,
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

    return json({ url: session.url, session_id: session.id });
  } catch (e: any) {
    return json({ error: e.message ?? 'Erreur interne' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
