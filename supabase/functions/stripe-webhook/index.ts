// Edge Function: stripe-webhook
// Réceptionne les évènements Stripe (paiement validé, refund) et met à jour la réservation.
// Sur paiement validé : génère un qr_code_token unique, déclenche l'envoi du mail de confirmation.
// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import Stripe from 'https://esm.sh/stripe@16.12.0?target=deno';

serve(async (req: Request) => {
  const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2024-06-20' });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const sig = req.headers.get('stripe-signature');
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');

  if (!sig || !secret) return new Response('Missing signature', { status: 400 });

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, secret);
  } catch (err: any) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const reservationId = session.metadata?.reservation_id;
      if (!reservationId) break;

      const qrToken = `BAIGNADE-${crypto.randomUUID().toUpperCase()}`;
      await supabase
        .from('reservations')
        .update({
          status: 'confirmed',
          qr_code_token: qrToken,
          stripe_payment_intent: session.payment_intent as string,
        })
        .eq('id', reservationId);

      // Déclenche l'envoi du mail de confirmation (autre Edge Function)
      await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/send-confirmation-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({ reservation_id: reservationId }),
      }).catch(() => {});
      break;
    }

    case 'charge.refunded':
    case 'refund.created': {
      const intent = (event.data.object as any).payment_intent;
      if (!intent) break;
      await supabase
        .from('reservations')
        .update({ status: 'refunded', stripe_refund_id: (event.data.object as any).id })
        .eq('stripe_payment_intent', intent);
      break;
    }

    case 'checkout.session.expired': {
      const session = event.data.object as Stripe.Checkout.Session;
      const reservationId = session.metadata?.reservation_id;
      if (!reservationId) break;
      await supabase.from('reservations').update({ status: 'expired' }).eq('id', reservationId);
      break;
    }
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
