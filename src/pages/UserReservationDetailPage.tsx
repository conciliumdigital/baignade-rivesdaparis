import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { ArrowLeft, Calendar, Clock, MapPin, Download, Loader2 } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { formatDate, formatPrice, formatTimeRange } from '../lib/format';
import type { ReservationWithSlot } from '../types/database';

export function UserReservationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [reservation, setReservation] = useState<ReservationWithSlot | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setLoadError(false);
      const { data, error } = await supabase
        .from('reservations')
        .select('*, slot:slots(*)')
        .eq('id', id!)
        .maybeSingle();
      if (error) {
        setLoadError(true);
        setLoading(false);
        return;
      }
      if (data) {
        setReservation(data as ReservationWithSlot);
        if (data.qr_code_token) {
          try {
            const url = await QRCode.toDataURL(data.qr_code_token, { width: 320, margin: 2 });
            setQrUrl(url);
          } catch {
            /* QR non généré : la référence reste affichée */
          }
        }
      }
      setLoading(false);
    }
    load();
  }, [id, reloadTick]);

  if (loading) {
    return <div className="container-app py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-brand-600 mx-auto" /></div>;
  }
  if (loadError) {
    return (
      <div className="container-app py-20 text-center max-w-md">
        <p className="text-slate-600 mb-4">Une erreur réseau est survenue. Votre réservation n'est pas perdue.</p>
        <button onClick={() => setReloadTick((t) => t + 1)} className="btn-primary">Réessayer</button>
      </div>
    );
  }
  if (!reservation) {
    return <div className="container-app py-20 text-center">Réservation introuvable. <Link to="/compte" className="text-brand-700 underline">Retour</Link></div>;
  }

  return (
    <div className="container-app py-10 max-w-3xl">
      <Link to="/compte" className="inline-flex items-center text-sm text-brand-700 hover:underline mb-4">
        <ArrowLeft className="w-4 h-4 mr-1" /> Retour à mes réservations
      </Link>

      <div className="card p-8 grid md:grid-cols-2 gap-8 items-center">
        <div className="text-center">
          {qrUrl && (
            <div className="bg-white p-4 rounded-2xl border border-slate-200 inline-block">
              <img src={qrUrl} alt="QR code" className="w-full max-w-[260px]" />
            </div>
          )}
          <p className="text-xs text-slate-500 mt-3">Référence : <span className="font-mono font-bold">{reservation.reference}</span></p>
          {qrUrl && (
            <a href={qrUrl} download={`baignade-${reservation.reference}.png`} className="btn-secondary mt-3 text-sm">
              <Download className="w-4 h-4" /> Télécharger
            </a>
          )}
        </div>
        <div>
          <h1 className="font-display font-bold text-2xl mb-3">Votre réservation</h1>
          <ul className="space-y-2 text-sm">
            <li className="flex gap-2"><Calendar className="w-4 h-4 text-brand-600 mt-0.5" />{formatDate(reservation.slot.date)}</li>
            <li className="flex gap-2"><Clock className="w-4 h-4 text-brand-600 mt-0.5" />{formatTimeRange(reservation.slot.start_time, reservation.slot.end_time)}</li>
            <li className="flex gap-2"><MapPin className="w-4 h-4 text-brand-600 mt-0.5" />Berge de la Marne, Neuilly-sur-Marne</li>
          </ul>
          <div className="mt-4 pt-4 border-t border-slate-100 text-sm space-y-1">
            <div className="flex justify-between"><span>{reservation.nb_adults} adulte(s)</span></div>
            {reservation.nb_children > 0 && <div className="flex justify-between"><span>{reservation.nb_children} enfant(s)</span></div>}
            <div className="flex justify-between font-semibold pt-1"><span>Total</span><span>{formatPrice(reservation.total_amount_cents)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
