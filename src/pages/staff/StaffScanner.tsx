import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { CheckCircle2, XCircle, AlertTriangle, RotateCcw, History, ScanLine, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { formatDate, formatTimeRange } from '../../lib/format';
import type { ScanResult } from '../../types/database';

interface ValidationResult {
  result: ScanResult;
  message: string;
  reservation?: {
    reference: string;
    nb_persons: number;
    date: string;
    start_time: string;
    end_time: string;
    user_name: string;
  };
}

export function StaffScanner() {
  const { profile } = useAuth();
  const [scanning, setScanning] = useState(true);
  const [validating, setValidating] = useState(false);
  const [last, setLast] = useState<ValidationResult | null>(null);

  async function handleScan(detected: IDetectedBarcode[]) {
    if (validating || !detected.length) return;
    const token = detected[0].rawValue;
    setScanning(false);
    setValidating(true);

    try {
      if (!isSupabaseConfigured) {
        const isDemo = token.startsWith('BAIGNADE-DEMO');
        const r: ValidationResult = isDemo
          ? {
              result: 'valid',
              message: 'Accès autorisé — mode démo',
              reservation: {
                reference: 'DEMO1234',
                nb_persons: 3,
                date: new Date().toISOString().slice(0, 10),
                start_time: '14:00:00',
                end_time: '16:00:00',
                user_name: 'Démo Utilisateur',
              },
            }
          : { result: 'invalid', message: 'QR code non reconnu' };
        setLast(r);
        playSound(r.result === 'valid');
      } else {
        const { data, error } = await supabase.functions.invoke('scan-qr', {
          body: { qr_token: token, scanned_by: profile?.id },
        });
        if (error) throw error;
        setLast(data as ValidationResult);
        playSound(data.result === 'valid');
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur de scan');
      setLast({ result: 'invalid', message: err.message ?? 'Erreur' });
    } finally {
      setValidating(false);
    }
  }

  function reset() {
    setLast(null);
    setScanning(true);
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <header className="bg-slate-950/60 border-b border-slate-800 p-4 flex items-center justify-between">
        <div>
          <div className="font-display font-bold text-lg flex items-center gap-2"><ScanLine className="w-5 h-5 text-brand-400" /> Scanner d'accès</div>
          <div className="text-xs text-slate-400">{profile?.first_name} · Agent d'accueil</div>
        </div>
        <Link to="/staff/historique" className="btn-ghost text-xs text-slate-300 hover:bg-slate-800"><History className="w-4 h-4" /> Historique</Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        {validating ? (
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-brand-400 animate-spin mx-auto mb-3" />
            <p className="text-slate-300">Vérification…</p>
          </div>
        ) : last ? (
          <ValidationCard result={last} onReset={reset} />
        ) : (
          <div className="w-full max-w-md">
            <div className="aspect-square rounded-3xl overflow-hidden border-4 border-brand-400 shadow-elevated relative">
              {scanning && (
                <Scanner
                  onScan={handleScan}
                  onError={() => {}}
                  styles={{ container: { width: '100%', height: '100%' } }}
                  components={{ finder: false }}
                />
              )}
              <div className="absolute inset-8 border-2 border-white/40 rounded-2xl pointer-events-none" />
            </div>
            <p className="text-center text-slate-300 text-sm mt-4">Présentez le QR code au centre de l'écran</p>
          </div>
        )}
      </main>
    </div>
  );
}

function ValidationCard({ result, onReset }: { result: ValidationResult; onReset: () => void }) {
  const isValid = result.result === 'valid';
  const isAlreadyUsed = result.result === 'already_used';

  return (
    <div className={`w-full max-w-md rounded-3xl p-8 text-center shadow-2xl ${
      isValid ? 'bg-emerald-500' : isAlreadyUsed ? 'bg-amber-500' : 'bg-red-500'
    } text-white`}>
      <div className="mx-auto w-24 h-24 rounded-full bg-white/20 flex items-center justify-center mb-4">
        {isValid ? <CheckCircle2 className="w-14 h-14" /> : isAlreadyUsed ? <AlertTriangle className="w-14 h-14" /> : <XCircle className="w-14 h-14" />}
      </div>
      <h2 className="text-3xl font-display font-bold mb-1">
        {isValid ? 'Accès autorisé' : isAlreadyUsed ? 'Déjà utilisé' : 'Refusé'}
      </h2>
      <p className="text-white/90 text-sm">{result.message}</p>

      {result.reservation && (
        <div className="bg-white/15 rounded-xl p-4 mt-5 text-left text-sm space-y-1">
          <div className="font-semibold text-base">{result.reservation.user_name}</div>
          <div className="opacity-90">Réf : {result.reservation.reference}</div>
          <div className="opacity-90">{formatDate(result.reservation.date)} · {formatTimeRange(result.reservation.start_time, result.reservation.end_time)}</div>
          <div className="opacity-90">{result.reservation.nb_persons} personne{result.reservation.nb_persons > 1 ? 's' : ''}</div>
        </div>
      )}

      {isValid && (
        <p className="mt-5 font-semibold text-sm bg-white/20 rounded-lg py-2">
          → Remettre {result.reservation?.nb_persons ?? 1} bracelet(s) (durée 2h)
        </p>
      )}

      <button onClick={onReset} className="mt-6 w-full bg-white text-slate-900 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-100">
        <RotateCcw className="w-5 h-5" /> Scanner suivant
      </button>
    </div>
  );
}

// Bip sonore léger pour feedback rapide
function playSound(success: boolean) {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = success ? 880 : 220;
    gain.gain.value = 0.05;
    osc.start();
    setTimeout(() => { osc.stop(); ctx.close(); }, success ? 120 : 240);
  } catch { /* silent */ }
}
