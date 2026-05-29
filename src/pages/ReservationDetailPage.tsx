import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Calendar, Clock, MapPin, Users, CreditCard, ShieldCheck, Loader2, Upload, FileCheck2, X, BellRing, Check, AlertCircle } from 'lucide-react';
import { fetchSlotById } from '../lib/slots';
import { formatDate, formatPrice, formatTimeRange } from '../lib/format';
import { useAuth } from '../lib/auth';
import { AnimatedPrice } from '../components/AnimatedPrice';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { mapSupabaseError } from '../lib/errors';
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
  // (résident < extérieur). Sur les créneaux à tarif unique (ex. créneau
  // 1 € pour tous), l'option « habitant » et le justificatif sont masqués.
  const hasResidentPrice =
    slot?.price_resident_cents != null &&
    slot.price_resident_cents > 0 &&
    slot.price_resident_cents < slot.price_cents;

  const adultPriceCents = useMemo(() => {
    if (!slot) return 0;
    return isResident && hasResidentPrice ? (slot.price_resident_cents as number) : slot.price_cents;
  }, [slot, isResident, hasResidentPrice]);

  // Tarif enfant : identique à l'adulte pour l'instant (la commune n'a pas
  // défini de tarif enfant / groupe, à reprendre ultérieurement).
  const childPriceCents = adultPriceCents;

  const totalCents = useMemo(() => {
    return adults * adultPriceCents + children * childPriceCents;
  }, [adults, children, adultPriceCents, childPriceCents]);

  const totalPersons = adults + children;
  const tooMany = totalPersons > 6;
  const insufficient = !!slot && totalPersons > slot.remaining;

  // --- Code de réduction (aperçu ; le serveur recalcule à l'identique) ---
  const [promoCode, setPromoCode] = useState('');
  const [promo, setPromo] = useState<{ valid: boolean; discount_cents: number; label?: string; reason: string } | null>(null);
  const [checkingPromo, setCheckingPromo] = useState(false);
  // Si le montant change, l'aperçu doit être revalidé
  useEffect(() => { setPromo(null); }, [totalCents]);
  const discountCents = promo?.valid ? promo.discount_cents : 0;
  const finalTotalCents = Math.max(totalCents - discountCents, 0);

  async function applyPromo() {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    setPromoCode(code);
    if (!isSupabaseConfigured) {
      setPromo({ valid: false, discount_cents: 0, reason: 'indisponible en mode démonstration' });
      return;
    }
    setCheckingPromo(true);
    const { data, error } = await supabase.rpc('compute_discount', { p_code: code, p_amount_cents: totalCents });
    setCheckingPromo(false);
    if (error) { toast.error(mapSupabaseError(error)); return; }
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

  async function uploadProof(userId: string, fileSafeId: string): Promise<string> {
    if (!proofFile) throw new Error('Aucun justificatif sélectionné.');
    const ext = proofFile.name.split('.').pop()?.toLowerCase() ?? 'bin';
    const path = `${userId}/${fileSafeId}.${ext}`;
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
    if (tooMany || totalPersons < 1) {
      toast.error('Le nombre de personnes par réservation doit être compris entre 1 et 6.');
      return;
    }
    if (isResident) {
      if (!hasResidentPrice) {
        // Garde-fou : le tarif habitant ne devrait pas être sélectionnable
        setUsagerType('exterieur');
        toast.error('Le tarif Nocéen n\'est pas disponible pour ce créneau.');
        return;
      }
      if (!proofFile && isSupabaseConfigured) {
        toast.error('Le justificatif de domicile est requis pour le tarif Nocéen.');
        return;
      }
      if (!honorCert) {
        toast.error('La certification sur l\'honneur de votre domiciliation à Neuilly-sur-Marne est requise.');
        return;
      }
    }

    // --- Cas non connecté : on bloque proprement plutôt que d'envoyer un
    //     magic link qui ferait perdre justificatif + case sur l'honneur.
    if (!user) {
      if (!isSupabaseConfigured) {
        toast.success('Mode démonstration : aucune réservation réelle enregistrée.');
        navigate('/reserver/confirmation/demo');
        return;
      }
      if (isResident) {
        // Le justificatif et la case sur l'honneur ne survivent pas à la
        // redirection magic-link ; on demande la connexion d'abord.
        toast.error('Connectez-vous d\'abord pour réserver au tarif Nocéen (le justificatif doit rester attaché à votre compte).');
        const redirectUrl = `${window.location.origin}/reserver/${slot.id}?adults=${adults}&children=${children}`;
        navigate(`/connexion?next=${encodeURIComponent(redirectUrl)}`, { state: { from: redirectUrl, email } });
        return;
      }
      // Cas extérieur non connecté : magic link OK (rien à perdre côté formulaire)
      setSubmitting(true);
      try {
        const redirectUrl = `${window.location.origin}/reserver/${slot.id}?adults=${adults}&children=${children}`;
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectUrl, data: { first_name: firstName, last_name: lastName } },
        });
        if (error) throw error;
        toast.success('Un lien de connexion vient de vous être envoyé.');
        navigate('/connexion/email-envoye', { state: { email } });
      } catch (err) {
        toast.error(mapSupabaseError(err));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      // 0. Re-fetch instantané du créneau pour détecter une condition de
      //    course (place prise pendant la saisie). On préfère bloquer
      //    avant Stripe que d'avoir à rembourser.
      const fresh = await fetchSlotById(slot.id);
      if (!fresh || fresh.status !== 'open' || fresh.remaining < totalPersons) {
        setSlot(fresh);
        toast.error('Ce créneau vient de changer (places ou statut). Merci de re-vérifier votre saisie.');
        return;
      }

      // 1. Upload du justificatif AVANT création de la réservation, pour
      //    éviter de créer une résa orpheline si l'upload échoue. On
      //    utilise un identifiant temporaire dans le chemin Storage ;
      //    l'objet sera référencé après création.
      let proofPath: string | null = null;
      if (isResident && proofFile) {
        const tempId = (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
        try {
          proofPath = await uploadProof(user.id, tempId);
        } catch (upErr) {
          toast.error('Le téléversement du justificatif a échoué : ' + mapSupabaseError(upErr));
          return;
        }
      }

      // 2. Insertion réservation (le trigger serveur recalcule prix + remise)
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
          resident_proof_url: proofPath,
          discount_code: promo?.valid ? promoCode.trim().toUpperCase() : null,
        })
        .select()
        .single();

      if (insertError) {
        // Rollback : on retire le justificatif uploadé pour rien
        if (proofPath) {
          await supabase.storage.from('resident-proofs').remove([proofPath]).catch(() => undefined);
        }
        throw insertError;
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
    } catch (err) {
      toast.error(mapSupabaseError(err));
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
        <h1 className="text-2xl font-display font-bold mb-2">Créneau introuvable.</h1>
        <Link to="/reserver" className="btn-secondary mt-4">Retour aux créneaux</Link>
      </div>
    );
  }

  if (slot.status !== 'open' || slot.remaining <= 0) {
    const complet = slot.status === 'open' && slot.remaining <= 0;
    if (complet) {
      return (
        <WaitlistCard
          slot={slot}
          defaultPersons={Math.max(1, adultsFromUrl + childrenFromUrl)}
        />
      );
    }
    return (
      <div className="container-app py-20 text-center max-w-lg">
        <h1 className="text-2xl font-display font-bold mb-2">Créneau non réservable.</h1>
        <p className="text-slate-600 mb-6">
          Ce créneau n&apos;est pas ouvert à la réservation en ligne.
        </p>
        <Link to="/reserver" className="btn-primary">Voir les créneaux disponibles</Link>
      </div>
    );
  }

  const personsErrorId = (tooMany || insufficient) ? 'persons-error' : undefined;

  return (
    <div className="container-app py-10 pb-32 lg:pb-10 max-w-5xl">
      <Link to="/reserver" className="inline-flex items-center text-sm text-brand-700 hover:underline mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" aria-hidden="true" /> Retour aux créneaux
      </Link>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Récapitulatif (desktop : sticky côté, mobile : version sticky bottom plus bas) */}
        <aside className="hidden lg:block lg:col-span-1 lg:order-2" aria-label="Récapitulatif">
          <div className="card p-6 sticky top-20">
            <h2 className="font-display font-bold text-lg mb-4">Votre réservation</h2>
            <ul className="space-y-3 text-sm border-b border-slate-100 pb-4 mb-4">
              <li className="flex gap-2"><Calendar className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" aria-hidden="true" /><span>{formatDate(slot.date)}</span></li>
              <li className="flex gap-2"><Clock className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" aria-hidden="true" /><span>{formatTimeRange(slot.start_time, slot.end_time)}</span></li>
              <li className="flex gap-2"><MapPin className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" aria-hidden="true" /><span>Chemin de la Haute-Île, Neuilly-sur-Marne</span></li>
              <li className="flex gap-2"><Users className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" aria-hidden="true" /><span>{totalPersons} personne{totalPersons > 1 ? 's' : ''}</span></li>
            </ul>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span>Adultes × {adults} {isResident && <span className="text-xs text-emerald-700 font-medium">(Nocéen)</span>}</span>
                <span>{formatPrice(adults * adultPriceCents)}</span>
              </div>
              {children > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Enfants × {children}</span>
                  <span>{formatPrice(children * childPriceCents)}</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100">
              <label className="label" htmlFor="promo-code">Code de réduction</label>
              <div className="flex gap-2">
                <input
                  id="promo-code"
                  className="input uppercase"
                  placeholder="Ex : ETE2026"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={applyPromo}
                  disabled={checkingPromo || !promoCode.trim()}
                  className="btn-secondary text-sm flex-shrink-0"
                >
                  {checkingPromo ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : 'Appliquer'}
                </button>
              </div>
              {promo && (
                promo.valid ? (
                  <p className="text-xs text-emerald-700 mt-1.5" role="status">
                    ✓ Réduction appliquée{promo.label ? ` (${promo.label})` : ''} : −{formatPrice(promo.discount_cents)}
                  </p>
                ) : (
                  <p className="text-xs text-red-600 mt-1.5" role="alert">Code non valable : {promo.reason}.</p>
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
              <AnimatedPrice cents={finalTotalCents} className="font-display font-bold text-2xl text-brand-700" />
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4" aria-hidden="true" /> Paiement par carte bancaire sécurisé.
            </div>
          </div>
        </aside>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="lg:col-span-2 lg:order-1 space-y-6">
          {/* --- Tarif (groupe radio sémantique) --- */}
          <section className="card p-6">
            <fieldset>
              <legend className="font-display font-bold text-lg mb-1">Type de tarif</legend>
              <p className="text-sm text-slate-500 mb-4">
                Les Nocéens (habitants de Neuilly-sur-Marne) bénéficient d&apos;un tarif réduit sur présentation d&apos;un justificatif de domicile.
              </p>
              <div className="grid sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Type de tarif">
                <TarifRadio
                  name="usager_type"
                  value="exterieur"
                  checked={usagerType === 'exterieur'}
                  onChange={() => setUsagerType('exterieur')}
                  title="Tarif normal"
                  subtitle="Hors Neuilly-sur-Marne"
                  price={formatPrice(slot.price_cents)}
                />
                <TarifRadio
                  name="usager_type"
                  value="habitant"
                  checked={isResident}
                  onChange={() => setUsagerType('habitant')}
                  title="Tarif Nocéen"
                  subtitle="Habitant de Neuilly-sur-Marne"
                  price={hasResidentPrice ? formatPrice(slot.price_resident_cents as number) : formatPrice(slot.price_cents)}
                  disabled={!hasResidentPrice}
                  disabledReason="Tarif réduit non disponible pour ce créneau."
                />
              </div>
            </fieldset>

            {isResident && (
              <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
                <div>
                  <label htmlFor="proof" className="label">
                    Justificatif de domicile <span className="text-red-600" aria-hidden="true">*</span>
                  </label>
                  <p id="proof-help" className="text-xs text-slate-500 mb-2">
                    Facture (eau, électricité, internet) de moins de 3 mois, avis d&apos;imposition ou quittance de loyer. JPG, PNG, WEBP ou PDF, 5 Mo maximum.
                  </p>
                  {proofFile ? (
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileCheck2 className="w-5 h-5 text-emerald-600 flex-shrink-0" aria-hidden="true" />
                        <span className="truncate">{proofFile.name}</span>
                        <span className="text-xs text-slate-500 flex-shrink-0">({(proofFile.size / 1024).toFixed(0)} Ko)</span>
                      </div>
                      <button
                        type="button"
                        onClick={removeProof}
                        className="inline-flex items-center justify-center w-10 h-10 -mr-2 -my-1 rounded-lg text-slate-500 hover:text-red-600 hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                        aria-label="Retirer le justificatif joint"
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        ref={proofInputRef}
                        id="proof"
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf"
                        capture="environment"
                        className="sr-only"
                        onChange={onProofChange}
                        aria-describedby="proof-help"
                        required={isResident && isSupabaseConfigured}
                      />
                      <label htmlFor="proof" className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 hover:border-brand-300 hover:bg-brand-50/30 px-4 py-6 cursor-pointer text-sm text-slate-600 min-h-[88px] focus-within:ring-2 focus-within:ring-brand-300">
                        <Upload className="w-5 h-5 text-brand-600" aria-hidden="true" />
                        <span>Choisir un fichier ou prendre une photo</span>
                      </label>
                    </>
                  )}
                </div>

                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={honorCert}
                    onChange={(e) => setHonorCert(e.target.checked)}
                    className="mt-1"
                    required={isResident}
                  />
                  <span>
                    Je certifie sur l&apos;honneur être domicilié à Neuilly-sur-Marne et reconnais que toute déclaration mensongère peut entraîner l&apos;annulation de la réservation sans remboursement, conformément à l&apos;article 441-1 du Code pénal.
                  </span>
                </label>
              </div>
            )}
          </section>

          {/* --- Composition (fieldset) --- */}
          <section className="card p-6">
            <fieldset>
              <legend className="font-display font-bold text-lg mb-4">Composition du groupe</legend>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="adults" className="label">Adultes</label>
                  <select
                    id="adults"
                    className="input"
                    value={adults}
                    onChange={(e) => setAdults(Number(e.target.value))}
                    aria-describedby={personsErrorId}
                    aria-invalid={tooMany || insufficient}
                  >
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="children" className="label">Enfants <span className="text-xs text-slate-500">(moins de 12 ans)</span></label>
                  <select
                    id="children"
                    className="input"
                    value={children}
                    onChange={(e) => setChildren(Number(e.target.value))}
                    aria-describedby={personsErrorId}
                    aria-invalid={tooMany || insufficient}
                  >
                    {[0, 1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              </div>
              {(tooMany || insufficient) && (
                <p id="persons-error" role="alert" className="text-sm text-red-600 mt-3 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" aria-hidden="true" />
                  {tooMany
                    ? 'Le nombre total de personnes par réservation doit être compris entre 1 et 6.'
                    : `Il ne reste que ${slot.remaining} place${slot.remaining > 1 ? 's' : ''} sur ce créneau.`}
                </p>
              )}
              {isResident && totalPersons > 1 && (
                <p className="text-xs text-slate-500 mt-3">
                  Le tarif Nocéen s&apos;applique à toutes les personnes de la réservation (un seul justificatif au nom du réservant suffit).
                </p>
              )}
            </fieldset>
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
                <label htmlFor="email" className="label">Adresse électronique</label>
                <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" aria-describedby="email-help" />
                <p id="email-help" className="text-xs text-slate-500 mt-1.5">
                  Vous recevrez un lien de connexion sécurisé par courriel. Aucun mot de passe à mémoriser.
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
                J&apos;accepte les <Link to="/cgu" className="text-brand-700 underline">conditions générales d&apos;utilisation</Link> et la{' '}
                <Link to="/confidentialite" className="text-brand-700 underline">politique de confidentialité</Link>.
                Je consens au traitement de mes données pour la gestion de cette réservation (RGPD).
              </span>
            </label>

            <button type="submit" disabled={submitting || tooMany || insufficient} className="btn-primary btn-lg w-full justify-center mt-5">
              {submitting ? (
                <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Préparation du paiement…</>
              ) : (
                <><CreditCard className="w-5 h-5" aria-hidden="true" /> Payer {formatPrice(finalTotalCents)}</>
              )}
            </button>
            <p className="text-xs text-center text-slate-500 mt-3">
              Vous serez redirigé vers notre prestataire de paiement sécurisé pour régler par carte bancaire.
            </p>
          </section>
        </form>
      </div>

      {/* --- Récap mobile sticky bas --- */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 px-4 py-3 shadow-lg" role="complementary" aria-label="Récapitulatif">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-slate-500 truncate">{totalPersons} personne{totalPersons > 1 ? 's' : ''} · {formatDate(slot.date)}</div>
            <div className="font-display font-bold text-lg text-brand-700">{formatPrice(finalTotalCents)}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              const form = document.querySelector('form');
              form?.requestSubmit?.();
            }}
            disabled={submitting || tooMany || insufficient}
            className="btn-primary text-sm min-h-[44px]"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <CreditCard className="w-4 h-4" aria-hidden="true" />}
            Payer
          </button>
        </div>
      </div>
    </div>
  );
}

// Carte d'inscription en liste d'attente : affichée quand le créneau est
// complet (status='open' & remaining=0). Le serveur revérifie ces deux
// conditions (RPC join_waitlist SECURITY DEFINER) ; le client ne fait
// que présenter le formulaire.
function WaitlistCard({ slot, defaultPersons }: { slot: SlotAvailability; defaultPersons: number }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [persons, setPersons] = useState(Math.min(6, Math.max(1, defaultPersons)));
  const [emailField, setEmailField] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [needEmail, setNeedEmail] = useState(false);

  async function handleJoin() {
    if (!isSupabaseConfigured) {
      toast.success('Mode démonstration : inscription en liste d\'attente fictive.');
      setDone(true);
      return;
    }
    if (!user) {
      if (!needEmail) { setNeedEmail(true); return; }
      const email = emailField.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        toast.error('Veuillez saisir une adresse électronique valide.');
        return;
      }
      const redirectUrl = `${window.location.origin}/reserver/${slot.id}?adults=${persons}&children=0`;
      setSubmitting(true);
      const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectUrl } });
      setSubmitting(false);
      if (error) { toast.error(mapSupabaseError(error)); return; }
      toast.success('Un lien de connexion vient de vous être envoyé. Une fois connecté, vous pourrez confirmer votre inscription.');
      navigate('/connexion/email-envoye', { state: { email } });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.rpc('join_waitlist', {
      p_slot_id: slot.id,
      p_persons: persons,
    });
    setSubmitting(false);
    if (error) {
      toast.error(mapSupabaseError(error));
      return;
    }
    setDone(true);
    toast.success('Inscription confirmée. Vous serez prévenu par courriel dès qu\'une place se libère.');
  }

  if (done) {
    return (
      <div className="container-app py-20 max-w-lg">
        <div className="card p-8 text-center">
          <div className="inline-flex w-14 h-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 mb-4">
            <Check className="w-7 h-7" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-display font-bold mb-2">Inscription enregistrée.</h1>
          <p className="text-slate-600 mb-6">
            Vous êtes en liste d&apos;attente pour le créneau du <strong>{formatDate(slot.date)}</strong>,
            de {formatTimeRange(slot.start_time, slot.end_time)}.
            Dès qu&apos;une place se libère, vous recevez un courriel (vous avez alors 24 h pour réserver).
          </p>
          <div className="flex flex-wrap gap-2 justify-center">
            <Link to="/reserver" className="btn-secondary">Voir d&apos;autres créneaux</Link>
            <Link to="/compte" className="btn-primary">Mes inscriptions</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-app py-20 max-w-lg">
      <div className="card p-8">
        <div className="inline-flex w-12 h-12 items-center justify-center rounded-full bg-brand-50 text-brand-700 mb-4">
          <BellRing className="w-6 h-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-display font-bold mb-1">Créneau complet.</h1>
        <p className="text-slate-600 mb-2">
          {formatDate(slot.date)} · {formatTimeRange(slot.start_time, slot.end_time)}
        </p>
        <p className="text-sm text-slate-600 leading-relaxed mb-6">
          Toutes les places sont réservées. Inscrivez-vous en liste d&apos;attente :
          si une réservation est annulée, nous vous prévenons aussitôt par courriel.
          Vous disposerez alors de 24 h pour finaliser votre réservation.
        </p>

        <div className="mb-5">
          <label className="label" htmlFor="wl-persons">Nombre de personnes</label>
          <select
            id="wl-persons"
            className="input"
            value={persons}
            onChange={(e) => setPersons(Number(e.target.value))}
          >
            {[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>

        {needEmail && !user && (
          <div className="mb-5">
            <label className="label" htmlFor="wl-email">Adresse électronique</label>
            <input
              id="wl-email"
              type="email"
              required
              autoComplete="email"
              className="input"
              value={emailField}
              onChange={(e) => setEmailField(e.target.value)}
              placeholder="vous@exemple.fr"
            />
            <p className="text-xs text-slate-500 mt-1.5">Un lien de connexion va vous être envoyé pour finaliser l&apos;inscription.</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleJoin}
          disabled={submitting}
          className="btn-primary btn-lg w-full justify-center min-h-[44px]"
        >
          {submitting ? (
            <><Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Inscription…</>
          ) : (
            <><BellRing className="w-5 h-5" aria-hidden="true" /> M&apos;inscrire en liste d&apos;attente</>
          )}
        </button>

        <p className="text-xs text-slate-500 mt-4 text-center">
          Service gratuit. Vous pouvez vous désinscrire à tout moment depuis votre espace.
        </p>

        <div className="mt-6 pt-6 border-t border-slate-100 text-center">
          <Link to="/reserver" className="text-sm text-brand-700 hover:underline">
            Voir tous les créneaux disponibles
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============== Carte radio accessible pour le choix du tarif ==============
function TarifRadio({
  name,
  value,
  checked,
  onChange,
  title,
  subtitle,
  price,
  disabled,
  disabledReason,
}: {
  name: string;
  value: string;
  checked: boolean;
  onChange: () => void;
  title: string;
  subtitle: string;
  price: string;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const id = `tarif-${value}`;
  return (
    <label
      htmlFor={id}
      className={`block text-left rounded-2xl border-2 px-4 py-3 transition cursor-pointer ${
        disabled
          ? 'border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed'
          : checked
            ? 'border-brand-500 bg-brand-50 ring-2 ring-brand-100'
            : 'border-slate-200 bg-white hover:border-brand-300'
      }`}
    >
      <input
        id={id}
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        className="sr-only"
      />
      <div className="flex items-baseline justify-between gap-2">
        <div className="font-semibold">{title}</div>
        <div className={`font-display font-bold ${checked ? 'text-brand-700' : ''}`}>{price}</div>
      </div>
      <div className="text-xs text-slate-500 mt-0.5">{subtitle}</div>
      {disabled && disabledReason && (
        <div className="text-xs text-amber-600 mt-1.5">{disabledReason}</div>
      )}
    </label>
  );
}

// Export par défaut + nommé (le router code-split utilise le nommé)
export default ReservationDetailPage;
