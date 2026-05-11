import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Calendar, Clock, MapPin, Users, CreditCard, ShieldCheck, Loader2 } from 'lucide-react';
import { fetchSlotById } from '../lib/slots';
import { formatDate, formatPrice, formatTimeRange } from '../lib/format';
import { useAuth } from '../lib/auth';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { SlotAvailability } from '../types/database';

export function ReservationDetailPage() {
  const { slotId } = useParams<{ slotId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const personsFromUrl = Number(searchParams.get('persons') ?? 1);
  const [slot, setSlot] = useState<SlotAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [adults, setAdults] = useState(Math.max(1, personsFromUrl));
  const [children, setChildren] = useState(0);
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [email, setEmail] = useState(profile?.email ?? user?.email ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [acceptCgu, setAcceptCgu] = useState(false);

  useEffect(() => {
    if (!slotId) return;
    setLoading(true);
    fetchSlotById(slotId)
      .then(setSlot)
      .catch(() => setSlot(null))
      .finally(() => setLoading(false));
  }, [slotId]);

  useEffect(() => {
    setFirstName(profile?.first_name ?? '');
    setLastName(profile?.last_name ?? '');
    setEmail(profile?.email ?? user?.email ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile, user]);

  const totalCents = useMemo(() => {
    if (!slot) return 0;
    const adultPrice = slot.price_cents;
    const childPrice = Math.round(slot.price_cents * 0.5);
    return adults * adultPrice + children * childPrice;
  }, [slot, adults, children]);

  const totalPersons = adults + children;
  const insufficient = slot && totalPersons > slot.remaining;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slot) return;
    if (!acceptCgu) {
      toast.error('Vous devez accepter les conditions générales pour continuer.');
      return;
    }
    if (insufficient) {
      toast.error('Le nombre de personnes dépasse les places restantes.');
      return;
    }
    if (totalPersons < 1 || totalPersons > 6) {
      toast.error('Vous pouvez réserver entre 1 et 6 personnes par réservation.');
      return;
    }

    setSubmitting(true);
    try {
      // 1. Si non connecté → magic link
      if (!user) {
        if (!isSupabaseConfigured) {
          toast.success('Mode démo : aucune authentification réelle. La réservation passerait par Magic Link → Stripe.');
          navigate('/reserver/confirmation/demo');
          return;
        }
        const redirectUrl = `${window.location.origin}/reserver/${slot.id}/finaliser?adults=${adults}&children=${children}`;
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectUrl, data: { first_name: firstName, last_name: lastName } },
        });
        if (error) throw error;
        toast.success('Lien magique envoyé ! Consultez votre boîte mail pour finaliser.');
        navigate('/connexion/email-envoye');
        return;
      }

      // 2. Connecté → on crée la réservation puis on lance Stripe Checkout
      const { data: reservation, error: insertError } = await supabase
        .from('reservations')
        .insert({
          user_id: user.id,
          slot_id: slot.id,
          nb_adults: adults,
          nb_children: children,
          total_amount_cents: totalCents,
          status: 'pending_payment',
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 3. Appel Edge Function pour créer la session Stripe
      const { data: checkoutData, error: fnError } = await supabase.functions.invoke('create-checkout-session', {
        body: { reservation_id: reservation.id },
      });
      if (fnError) throw fnError;
      if (checkoutData?.url) {
        window.location.href = checkoutData.url;
      } else {
        throw new Error('URL Stripe Checkout manquante');
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="container-app py-20 text-center">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin mx-auto" />
      </div>
    );
  }

  if (!slot) {
    return (
      <div className="container-app py-20 text-center">
        <h1 className="text-2xl font-display font-bold mb-2">Créneau introuvable</h1>
        <Link to="/reserver" className="btn-secondary mt-4">Retour aux créneaux</Link>
      </div>
    );
  }

  return (
    <div className="container-app py-10 max-w-5xl">
      <Link to="/reserver" className="inline-flex items-center text-sm text-brand-700 hover:underline mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> Retour aux créneaux
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Récapitulatif */}
        <aside className="lg:col-span-1 lg:order-2">
          <div className="card p-6 sticky top-20">
            <h2 className="font-display font-bold text-lg mb-4">Votre réservation</h2>
            <ul className="space-y-3 text-sm border-b border-slate-100 pb-4 mb-4">
              <li className="flex gap-2"><Calendar className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" /><span>{formatDate(slot.date)}</span></li>
              <li className="flex gap-2"><Clock className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" /><span>{formatTimeRange(slot.start_time, slot.end_time)}</span></li>
              <li className="flex gap-2"><MapPin className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" /><span>Berge de la Marne, Neuilly-sur-Marne</span></li>
              <li className="flex gap-2"><Users className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" /><span>{totalPersons} personne{totalPersons > 1 ? 's' : ''}</span></li>
            </ul>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span>Adultes × {adults}</span>
                <span>{formatPrice(adults * slot.price_cents)}</span>
              </div>
              {children > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Enfants × {children} (-50%)</span>
                  <span>{formatPrice(children * Math.round(slot.price_cents * 0.5))}</span>
                </div>
              )}
            </div>
            <div className="border-t border-slate-100 mt-4 pt-4 flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="font-display font-bold text-2xl text-brand-700">{formatPrice(totalCents)}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4" /> Paiement sécurisé Stripe · PCI DSS
            </div>
          </div>
        </aside>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 lg:order-1 space-y-6">
          <section className="card p-6">
            <h2 className="font-display font-bold text-lg mb-4">Composition du groupe</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="adults" className="label">Adultes</label>
                <select id="adults" className="input" value={adults} onChange={(e) => setAdults(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="children" className="label">Enfants <span className="text-xs text-slate-500">(moins de 12 ans)</span></label>
                <select id="children" className="input" value={children} onChange={(e) => setChildren(Number(e.target.value))}>
                  {[0, 1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            {totalPersons > 6 && (
              <p className="text-sm text-red-600 mt-3 flex items-center gap-1">
                Maximum 6 personnes par réservation.
              </p>
            )}
            {insufficient && (
              <p className="text-sm text-red-600 mt-3">
                Il ne reste que {slot.remaining} place(s) sur ce créneau.
              </p>
            )}
          </section>

          <section className="card p-6">
            <h2 className="font-display font-bold text-lg mb-4">Vos coordonnées</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="firstName" className="label">Prénom</label>
                <input id="firstName" type="text" required className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
              </div>
              <div>
                <label htmlFor="lastName" className="label">Nom</label>
                <input id="lastName" type="text" required className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="email" className="label">Email</label>
                <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                <p className="text-xs text-slate-500 mt-1.5">
                  Vous recevrez un lien de connexion sécurisé (Magic Link). Aucun mot de passe à mémoriser.
                </p>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="phone" className="label">Téléphone <span className="text-xs text-slate-500">(facultatif)</span></label>
                <input id="phone" type="tel" className="input" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
              </div>
            </div>
          </section>

          <section className="card p-6">
            <label className="flex items-start gap-3 text-sm cursor-pointer">
              <input type="checkbox" checked={acceptCgu} onChange={(e) => setAcceptCgu(e.target.checked)} className="mt-1" required />
              <span>
                J'accepte les <Link to="/cgu" className="text-brand-700 underline">conditions générales d'utilisation</Link> et la{' '}
                <Link to="/confidentialite" className="text-brand-700 underline">politique de confidentialité</Link>.
                Je consens au traitement de mes données pour la gestion de cette réservation (RGPD).
              </span>
            </label>

            <button type="submit" disabled={submitting || !!insufficient} className="btn-primary btn-lg w-full justify-center mt-5">
              {submitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Préparation du paiement…</>
              ) : (
                <><CreditCard className="w-5 h-5" /> Payer {formatPrice(totalCents)}</>
              )}
            </button>
            <p className="text-xs text-center text-slate-500 mt-3">
              Vous serez redirigé vers Stripe pour finaliser votre paiement en toute sécurité.
            </p>
          </section>
        </form>
      </div>
    </div>
  );
}
