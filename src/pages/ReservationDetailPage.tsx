import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Calendar, Clock, MapPin, Users, CreditCard, ShieldCheck, Loader2, Upload, FileCheck2, X } from 'lucide-react';
import { fetchSlotById } from '../lib/slots';
import { formatDate, formatPrice, formatTimeRange } from '../lib/format';
import { useAuth } from '../lib/auth';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import type { SlotAvailability, UsagerType } from '../types/database';

const PROOF_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const PROOF_MAX_BYTES = 5 * 1024 * 1024;

export function ReservationDetailPage() {
  const { slotId } = useParams<{ slotId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // Composition restituée depuis l'URL (la redirection magic-link la
  // repasse en query : ?adults=&children=), avec repli sur ?persons=.
  const clampInt = (v: string | null, lo: number, hi: number, dflt: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.trunc(n))) : dflt;
  };
  const adultsFromUrl = clampInt(
    searchParams.get('adults') ?? searchParams.get('persons'), 1, 6, 1,
  );
  const childrenFromUrl = clampInt(searchParams.get('children'), 0, 5, 0);

  const [slot, setSlot] = useState<SlotAvailability | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [adults, setAdults] = useState(adultsFromUrl);
  const [children, setChildren] = useState(childrenFromUrl);
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [email, setEmail] = useState(profile?.email ?? user?.email ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [acceptCgu, setAcceptCgu] = useState(false);

  const [usagerType, setUsagerType] = useState<UsagerType>('exterieur');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [honorCert, setHonorCert] = useState(false);
  const proofInputRef = useRef<HTMLInputElement>(null);

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

  const isResident = usagerType === 'habitant';
  // Le tarif habitant n'est proposé que s'il constitue une vraie réduction
  // (résident < extérieur). Sur les créneaux à tarif unique — ex. créneau
  // 1 € pour tous — l'option « habitant » et le justificatif sont masqués.
  const hasResidentPrice =
    slot?.price_resident_cents != null &&
    slot.price_resident_cents > 0 &&
    slot.price_resident_cents < slot.price_cents;

  const adultPriceCents = useMemo(() => {
    if (!slot) return 0;
    return isResident && hasResidentPrice ? (slot.price_resident_cents as number) : slot.price_cents;
  }, [slot, isResident, hasResidentPrice]);

  // Tarif enfant : identique à l'adulte pour l'instant (la commune n'a pas
  // défini de tarif enfant / groupe — à reprendre ultérieurement).
  const childPriceCents = adultPriceCents;

  const totalCents = useMemo(() => {
    return adults * adultPriceCents + children * childPriceCents;
  }, [adults, children, adultPriceCents, childPriceCents]);

  const totalPersons = adults + children;
  const insufficient = slot && totalPersons > slot.remaining;

  // --- Code de réduction (aperçu ; le serveur recalcule à l'identique) ---
  const [promoCode, setPromoCode] = useState('');
  const [promo, setPromo] = useState<{ valid: boolean; discount_cents: number; label?: string; reason: string } | null>(null);
  const [checkingPromo, setCheckingPromo] = useState(false);
  // Si le montant change, l'aperçu doit être revalidé
  useEffect(() => { setPromo(null); }, [totalCents]);
  const discountCents = promo?.valid ? promo.discount_cents : 0;
  const finalTotalCents = Math.max(totalCents - discountCents, 0);

  async function applyPromo() {
    const code = promoCode.trim();
    if (!code) return;
    if (!isSupabaseConfigured) {
      setPromo({ valid: false, discount_cents: 0, reason: 'indisponible en mode démo' });
      return;
    }
    setCheckingPromo(true);
    const { data, error } = await supabase.rpc('compute_discount', { p_code: code, p_amount_cents: totalCents });
    setCheckingPromo(false);
    if (error) { toast.error('Vérification du code impossible.'); return; }
    setPromo(data as { valid: boolean; discount_cents: number; label?: string; reason: string });
  }

  function onProofChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      setProofFile(null);
      return;
    }
    if (!PROOF_MIME.includes(f.type)) {
      toast.error('Format accepté : JPG, PNG, WEBP ou PDF.');
      e.target.value = '';
      return;
    }
    if (f.size > PROOF_MAX_BYTES) {
      toast.error('Le fichier doit faire moins de 5 Mo.');
      e.target.value = '';
      return;
    }
    setProofFile(f);
  }

  function removeProof() {
    setProofFile(null);
    if (proofInputRef.current) proofInputRef.current.value = '';
  }

  async function uploadProof(userId: string, reservationId: string): Promise<string | null> {
    if (!proofFile) return null;
    const ext = proofFile.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const path = `${userId}/${reservationId}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('resident-proofs')
      .upload(path, proofFile, { upsert: true, contentType: proofFile.type });
    if (upErr) throw upErr;
    return path;
  }

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
    if (isResident) {
      if (!proofFile && isSupabaseConfigured) {
        toast.error('Veuillez joindre un justificatif de domicile pour bénéficier du tarif habitant.');
        return;
      }
      if (!honorCert) {
        toast.error('Veuillez certifier sur l\'honneur votre domiciliation à Neuilly-sur-Marne.');
        return;
      }
    }

    setSubmitting(true);
    try {
      // 1. Si non connecté → magic link
      if (!user) {
        if (!isSupabaseConfigured) {
          toast.success('Mode démonstration : aucune réservation réelle enregistrée.');
          navigate('/reserver/confirmation/demo');
          return;
        }
        const redirectUrl = `${window.location.origin}/reserver/${slot.id}?adults=${adults}&children=${children}`;
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
          usager_type: usagerType,
          honor_certification: isResident ? honorCert : false,
          discount_code: promo?.valid ? promoCode.trim().toUpperCase() : null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // 2b. Upload du justificatif si habitant
      if (isResident && proofFile) {
        try {
          const proofPath = await uploadProof(user.id, reservation.id);
          if (proofPath) {
            await supabase
              .from('reservations')
              .update({ resident_proof_url: proofPath })
              .eq('id', reservation.id);
          }
        } catch (upErr: any) {
          toast.error(`Justificatif : ${upErr.message ?? 'échec de l\'envoi'}`);
        }
      }

      // 3. Appel Edge Function pour créer la session Stripe
      const { data: checkoutData, error: fnError } = await supabase.functions.invoke('create-checkout-session', {
        body: { reservation_id: reservation.id },
      });
      if (fnError) throw fnError;
      if (checkoutData?.url) {
        window.location.href = checkoutData.url;
      } else {
        throw new Error('Le service de paiement est momentanément indisponible. Merci de réessayer dans quelques instants.');
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

  if (slot.status !== 'open' || slot.remaining <= 0) {
    const complet = slot.status === 'open' && slot.remaining <= 0;
    return (
      <div className="container-app py-20 text-center max-w-lg">
        <h1 className="text-2xl font-display font-bold mb-2">
          {complet ? 'Créneau complet' : 'Créneau non réservable'}
        </h1>
        <p className="text-slate-600 mb-6">
          {complet
            ? "Toutes les places de ce créneau sont déjà réservées."
            : "Ce créneau n'est pas ouvert à la réservation en ligne."}
        </p>
        <Link to="/reserver" className="btn-primary">Voir les créneaux disponibles</Link>
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
                <span>Adultes × {adults} {isResident && <span className="text-xs text-emerald-700 font-medium">(habitant)</span>}</span>
                <span>{formatPrice(adults * adultPriceCents)}</span>
              </div>
              {children > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Enfants × {children} (-50%)</span>
                  <span>{formatPrice(children * childPriceCents)}</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <label className="label">Code de réduction</label>
              <div className="flex gap-2">
                <input
                  className="input uppercase"
                  placeholder="Ex : ETE2026"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                />
                <button
                  type="button"
                  onClick={applyPromo}
                  disabled={checkingPromo || !promoCode.trim()}
                  className="btn-secondary text-sm flex-shrink-0"
                >
                  {checkingPromo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Appliquer'}
                </button>
              </div>
              {promo && (
                promo.valid ? (
                  <p className="text-xs text-emerald-700 mt-1.5">
                    ✓ Réduction appliquée{promo.label ? ` — ${promo.label}` : ''} : −{formatPrice(promo.discount_cents)}
                  </p>
                ) : (
                  <p className="text-xs text-red-600 mt-1.5">Code non valable : {promo.reason}</p>
                )
              )}
            </div>

            {discountCents > 0 && (
              <div className="mt-3 flex justify-between text-sm text-emerald-700">
                <span>Réduction</span>
                <span>−{formatPrice(discountCents)}</span>
              </div>
            )}
            <div className="border-t border-slate-100 mt-4 pt-4 flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="font-display font-bold text-2xl text-brand-700">{formatPrice(finalTotalCents)}</span>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4" /> Paiement par carte bancaire sécurisé
            </div>
          </div>
        </aside>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 lg:order-1 space-y-6">
          <section className="card p-6">
            <h2 className="font-display font-bold text-lg mb-1">Type de tarif</h2>
            <p className="text-sm text-slate-500 mb-4">
              Les habitant·e·s de Neuilly-sur-Marne bénéficient d'un tarif réduit sur présentation d'un justificatif de domicile.
            </p>
            <div className="grid sm:grid-cols-2 gap-3">
              <TarifCard
                selected={usagerType === 'exterieur'}
                onSelect={() => setUsagerType('exterieur')}
                title="Tarif normal"
                subtitle="Hors Neuilly-sur-Marne"
                price={formatPrice(slot.price_cents)}
              />
              <TarifCard
                selected={isResident}
                onSelect={() => setUsagerType('habitant')}
                title="Tarif habitant"
                subtitle="Neuilly-sur-Marne"
                price={hasResidentPrice ? formatPrice(slot.price_resident_cents as number) : formatPrice(slot.price_cents)}
                disabled={!hasResidentPrice}
                disabledReason="Tarif réduit non disponible pour ce créneau"
              />
            </div>

            {isResident && (
              <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
                <div>
                  <label htmlFor="proof" className="label">
                    Justificatif de domicile <span className="text-red-600">*</span>
                  </label>
                  <p className="text-xs text-slate-500 mb-2">
                    Facture (eau, électricité, internet) de moins de 3 mois, avis d'imposition ou quittance de loyer. JPG, PNG, WEBP ou PDF — max 5 Mo.
                  </p>
                  {proofFile ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileCheck2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                        <span className="truncate">{proofFile.name}</span>
                        <span className="text-xs text-slate-500 flex-shrink-0">({(proofFile.size / 1024).toFixed(0)} Ko)</span>
                      </div>
                      <button
                        type="button"
                        onClick={removeProof}
                        className="text-slate-500 hover:text-red-600 flex-shrink-0"
                        aria-label="Retirer le fichier"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 hover:border-brand-300 hover:bg-brand-50/30 px-4 py-6 cursor-pointer text-sm text-slate-600">
                      <Upload className="w-5 h-5 text-brand-600" />
                      <span>Choisir un fichier</span>
                      <input
                        ref={proofInputRef}
                        id="proof"
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                        className="hidden"
                        onChange={onProofChange}
                      />
                    </label>
                  )}
                </div>

                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={honorCert}
                    onChange={(e) => setHonorCert(e.target.checked)}
                    className="mt-1"
                  />
                  <span>
                    Je certifie sur l'honneur être domicilié·e à Neuilly-sur-Marne et reconnais que toute déclaration mensongère peut entraîner l'annulation de la réservation sans remboursement, conformément à l'article 441-1 du Code pénal.
                  </span>
                </label>
              </div>
            )}
          </section>

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
            {isResident && totalPersons > 1 && (
              <p className="text-xs text-slate-500 mt-3">
                Le tarif habitant s'applique à toutes les personnes de la réservation (un seul justificatif au nom du réservant suffit).
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
                  Vous recevrez un lien de connexion sécurisé par e-mail. Aucun mot de passe à mémoriser.
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
              Vous serez redirigé vers notre prestataire de paiement sécurisé pour régler par carte bancaire.
            </p>
          </section>
        </form>
      </div>
    </div>
  );
}

function TarifCard({
  selected,
  onSelect,
  title,
  subtitle,
  price,
  disabled,
  disabledReason,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  subtitle: string;
  price: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={`text-left rounded-2xl border-2 px-4 py-3 transition ${
        disabled
          ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
          : selected
            ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100'
            : 'border-slate-200 bg-white hover:border-brand-300'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-semibold">{title}</div>
        <div className={`font-display font-bold ${selected ? 'text-brand-700' : ''}`}>{price}</div>
      </div>
      <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>
      {disabled && disabledReason && (
        <div className="text-xs text-amber-600 mt-1.5">{disabledReason}</div>
      )}
    </button>
  );
}
