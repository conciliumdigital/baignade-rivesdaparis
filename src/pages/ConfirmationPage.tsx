import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Calendar, Clock, MapPin, Download, Mail, Loader2 } from 'lucide-react';
import QRCode from 'qrcode';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { formatDate, formatPrice, formatTimeRange } from '../lib/format';
import type { ReservationWithSlot } from '../types/database';

export function ConfirmationPage() {
  const { reservationId } = useParams<{ reservationId: string }>();
  const [reservation, setReservation] = useState<ReservationWithSlot | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (reservationId === 'demo' || !isSupabaseConfigured) {
        // Démo
        const demoToken = 'BAIGNADE-DEMO-' + Math.random().toString(36).slice(2, 10).toUpperCase();
        const demo: ReservationWithSlot = {
          id: 'demo',
          reference: 'DEMO1234',
          user_id: 'demo',
          slot_id: 'demo',
          status: 'confirmed',
          usager_type: 'exterieur',
          nb_adults: 2,
          nb_children: 1,
          total_amount_cents: 1250,
          qr_code_token: demoToken,
          qr_used_at: null,
          scanned_by: null,
          stripe_session_id: null,
          stripe_payment_intent: null,
          stripe_refund_id: null,
          notes: null,
          cancelled_at: null,
          cancellation_reason: null,
          resident_proof_url: null,
          honor_certification: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          slot: {
            id: 'demo',
            date: new Date().toISOString().slice(0, 10),
            start_time: '14:00:00',
            end_time: '16:00:00',
            capacity: 50,
            capacity_residents: 0,
            capacity_groups: 0,
            price_cents: 500,
            price_resident_cents: 300,
            price_child_cents: 250,
            status: 'open',
            closure_reason: null,
            notes: null,
            created_at: '',
            updated_at: '',
            created_by: null,
          },
        };
        setReservation(demo);
        const url = await QRCode.toDataURL(demoToken, { width: 320, margin: 2 });
        setQrDataUrl(url);
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('reservations')
        .select('*, slot:slots(*)')
        .eq('id', reservationId!)
        .maybeSingle();
      if (data) {
        setReservation(data as ReservationWithSlot);
        if (data.qr_code_token) {
          const url = await QRCode.toDataURL(data.qr_code_token, { width: 320, margin: 2 });
          setQrDataUrl(url);
        }
      }
      setLoading(false);
    }
    load();
  }, [reservationId]);

  if (loading) {
    return (
      <div className="container-app py-20 text-center">
        <Loader2 className="w-8 h-8 text-brand-600 animate-spin mx-auto" />
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="container-app py-20 text-center">
        <h1 className="text-2xl font-display font-bold mb-2">Réservation introuvable</h1>
        <Link to="/" className="btn-secondary mt-4">Retour à l'accueil</Link>
      </div>
    );
  }

  return (
    <div className="container-app py-12 max-w-3xl">
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-9 h-9 text-emerald-600" />
        </div>
        <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">Réservation confirmée !</h1>
        <p className="text-slate-600">
          Référence <span className="font-mono font-bold">{reservation.reference}</span>
        </p>
      </div>

      <div className="card p-8 grid md:grid-cols-2 gap-8 items-center">
        <div>
          <h2 className="font-display font-bold text-lg mb-4">Votre QR code</h2>
          {qrDataUrl ? (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 inline-block">
              <img src={qrDataUrl} alt="QR code de votre réservation" className="w-full max-w-[280px]" />
            </div>
          ) : (
            <div className="text-sm text-slate-500">QR code en cours de génération…</div>
          )}
          <p className="text-xs text-slate-500 mt-3">
            Présentez ce QR code à l'accueil. Validation en moins d'une seconde.
          </p>
          {qrDataUrl && (
            <a
              href={qrDataUrl}
              download={`baignade-${reservation.reference}.png`}
              className="btn-secondary mt-4 text-sm"
            >
              <Download className="w-4 h-4" /> Télécharger le QR code
            </a>
          )}
        </div>

        <div>
          <h2 className="font-display font-bold text-lg mb-4">Détails du créneau</h2>
          <ul className="space-y-3 text-sm">
            <li className="flex gap-2"><Calendar className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" /><span>{formatDate(reservation.slot.date)}</span></li>
            <li className="flex gap-2"><Clock className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" /><span>{formatTimeRange(reservation.slot.start_time, reservation.slot.end_time)}</span></li>
            <li className="flex gap-2"><MapPin className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" /><span>Chemin de la Haute-Île, Neuilly-sur-Marne</span></li>
          </ul>

          <div className="mt-5 pt-5 border-t border-slate-100">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-slate-600">Adultes</span>
              <span className="font-semibold">{reservation.nb_adults}</span>
            </div>
            {reservation.nb_children > 0 && (
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-slate-600">Enfants</span>
                <span className="font-semibold">{reservation.nb_children}</span>
              </div>
            )}
            <div className="flex justify-between mt-2 pt-2 border-t border-slate-100">
              <span className="font-semibold">Total payé</span>
              <span className="font-display font-bold text-brand-700">{formatPrice(reservation.total_amount_cents)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6 mt-6 bg-brand-50/40 border-brand-100">
        <div className="flex items-start gap-3">
          <Mail className="w-5 h-5 text-brand-700 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">Confirmation envoyée par email</p>
            <p className="text-slate-600">
              Un email de confirmation contenant votre QR code a été envoyé à votre adresse. Vous pouvez aussi le retrouver à tout moment dans votre espace personnel.
            </p>
          </div>
        </div>
      </div>

      <div className="text-center mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/compte" className="btn-primary">Voir mes réservations</Link>
        <Link to="/" className="btn-ghost">Retour à l'accueil</Link>
      </div>
    </div>
  );
}
