import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Scanner, type IDetectedBarcode } from '@yudiel/react-qr-scanner';
import { CheckCircle2, XCircle, AlertTriangle, RotateCcw, History, ScanLine, Loader2, Home, FileText, ShieldAlert, Keyboard, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { formatDate, formatTimeRange } from '../../lib/format';
import { mapSupabaseError } from '../../lib/errors';
import type { ScanResult, UsagerType } from '../../types/database';

interface ValidationResult {
  result: ScanResult;
  message: string;
  reservation?: {
    reference: string;
    nb_persons: number;
    nb_adults?: number;
    nb_children?: number;
    date: string;
    start_time: string;
    end_time: string;
    user_name: string;
    usager_type?: UsagerType;
    honor_certification?: boolean;
    proof_url?: string | null;
  };
}

// Reprise auto du scan après un accès VALIDE (fluidifie la file).
const AUTO_RESET_MS = 2400;
// Ignore le même QR re-détecté dans la foulée (évite les doublons).
const DUPLICATE_COOLDOWN_MS = 5000;

export function StaffScanner() {
  const { profile } = useAuth();
  const [scanning, setScanning] = useState(true);
  const [validating, setValidating] = useState(false);
  const [last, setLast] = useState<ValidationResult | null>(null);
  const [validCount, setValidCount] = useState(0);
  // RGAA 7 — alternative équivalente au scan caméra : saisie manuelle.
  const [manualOpen, setManualOpen] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const lastTokenRef = useRef<string | null>(null);

  const autoResetTimer = useRef<number | null>(null);
  const lastScan = useRef<{ token: string; at: number } | null>(null);

  const clearAutoReset = useCallback(() => {
    if (autoResetTimer.current) {
      clearTimeout(autoResetTimer.current);
      autoResetTimer.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    clearAutoReset();
    setLast(null);
    setValidating(false);
    setScanning(true);
    lastTokenRef.current = null;
  }, [clearAutoReset]);

  useEffect(() => () => clearAutoReset(), [clearAutoReset]);

  async function processToken(token: string, { manual = false }: { manual?: boolean } = {}) {
    if (validating || !token) return;
    // Anti-doublon caméra : même QR re-vu juste après → on ignore (sauf
    // saisie manuelle où l'agent veut explicitement re-tester).
    if (!manual) {
      const now = Date.now();
      if (lastScan.current && lastScan.current.token === token && now - lastScan.current.at < DUPLICATE_COOLDOWN_MS) {
        return;
      }
      lastScan.current = { token, at: Date.now() };
    }
    lastTokenRef.current = token;
    setScanning(false);
    setValidating(true);
    setManualOpen(false);

    try {
      let r: ValidationResult;
      if (!isSupabaseConfigured) {
        r = token.startsWith('BAIGNADE-DEMO')
          ? {
              result: 'valid',
              message: 'Accès autorisé — mode démonstration.',
              reservation: {
                reference: 'DEMO1234', nb_persons: 4, nb_adults: 2, nb_children: 2,
                date: new Date().toISOString().slice(0, 10), start_time: '14:00:00', end_time: '16:00:00',
                user_name: 'Famille de démonstration', usager_type: 'habitant', honor_certification: true, proof_url: null,
              },
            }
          : { result: 'invalid', message: 'QR code non reconnu.' };
      } else {
        const { data, error } = await supabase.functions.invoke('scan-qr', {
          body: { qr_token: token },
        });
        if (error) throw error;
        r = data as ValidationResult;
      }
      setLast(r);
      const ok = r.result === 'valid';
      feedback(ok);
      if (ok) {
        setValidCount((c) => c + 1);
        // Reprise automatique du scan → l'agent enchaîne sans taper
        autoResetTimer.current = window.setTimeout(reset, AUTO_RESET_MS);
      }
    } catch (err) {
      const msg = mapSupabaseError(err);
      toast.error(msg);
      setLast({ result: 'invalid', message: 'Erreur de connexion : ' + msg });
      feedback(false);
    } finally {
      setValidating(false);
    }
  }

  async function handleScan(detected: IDetectedBarcode[]) {
    if (validating || last || !detected.length) return;
    await processToken(detected[0].rawValue);
  }

  function retryLast() {
    if (lastTokenRef.current) {
      processToken(lastTokenRef.current, { manual: true });
    } else {
      reset();
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <header className="bg-slate-950/60 border-b border-slate-800 p-4 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-display font-bold text-lg flex items-center gap-2"><ScanLine className="w-5 h-5 text-brand-400" aria-hidden="true" /> Scanner d&apos;accès</div>
          <div className="text-xs text-slate-400 truncate">{profile?.first_name} · Agent d&apos;accueil</div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-slate-300 bg-slate-800 rounded-lg px-2.5 py-1.5 font-semibold tabular-nums" title="Entrées validées depuis l'ouverture de la page">
            ✓ {validCount}
          </span>
          <Link to="/staff/historique" className="btn-ghost text-xs text-slate-300 hover:bg-slate-800 min-h-[36px]"><History className="w-4 h-4" aria-hidden="true" /> Historique</Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        {validating ? (
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-brand-400 animate-spin mx-auto mb-3" aria-hidden="true" />
            <p className="text-slate-300">Vérification…</p>
          </div>
        ) : last ? (
          <ValidationCard
            result={last}
            onReset={reset}
            onRetry={retryLast}
            autoResume={last.result === 'valid'}
            retryable={!!lastTokenRef.current && last.result !== 'valid'}
          />
        ) : (
          <div className="w-full max-w-md">
            <div className="aspect-square rounded-3xl overflow-hidden border-4 border-brand-400 shadow-elevated relative">
              {scanning && !manualOpen && (
                <Scanner
                  onScan={handleScan}
                  onError={() => {}}
                  styles={{ container: { width: '100%', height: '100%' } }}
                  components={{ finder: false }}
                />
              )}
              <div className="absolute inset-[12%] border-2 border-white/40 rounded-2xl pointer-events-none" aria-hidden="true" />
            </div>
            <p className="text-center text-slate-300 text-sm mt-4">Présentez le QR code au centre de l&apos;écran.</p>
            <div className="mt-4 flex justify-center gap-4 text-xs text-slate-400 flex-wrap">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Accès</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Déjà utilisé</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Refusé</span>
            </div>

            {/* RGAA 7 — alternative manuelle si caméra indisponible / inaccessible */}
            <div className="mt-6 pt-5 border-t border-slate-800">
              {!manualOpen ? (
                <button
                  type="button"
                  onClick={() => setManualOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-2 text-sm text-slate-200 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl px-4 py-3 min-h-[44px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  <Keyboard className="w-4 h-4" aria-hidden="true" /> Saisir le code de la réservation au clavier
                </button>
              ) : (
                <form
                  onSubmit={(e) => { e.preventDefault(); processToken(manualToken.trim(), { manual: true }); setManualToken(''); }}
                  className="space-y-2"
                >
                  <label htmlFor="qr-token" className="block text-sm text-slate-300">
                    Code de la réservation (visible sous le QR code de l&apos;usager)
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="qr-token"
                      type="text"
                      autoFocus
                      required
                      className="flex-1 rounded-lg bg-slate-800 border border-slate-700 text-white px-3 py-2.5 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-brand-400"
                      value={manualToken}
                      onChange={(e) => setManualToken(e.target.value)}
                      placeholder="Ex. ABC123XYZ…"
                      autoComplete="off"
                      autoCapitalize="characters"
                    />
                    <button
                      type="submit"
                      disabled={!manualToken.trim()}
                      className="inline-flex items-center justify-center gap-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg px-4 min-h-[44px] disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" aria-hidden="true" /> Valider
                    </button>
                  </div>
                  <button type="button" onClick={() => { setManualOpen(false); setManualToken(''); }} className="text-xs text-slate-400 underline">Revenir au scan caméra</button>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function ValidationCard({ result, onReset, onRetry, autoResume, retryable }: { result: ValidationResult; onReset: () => void; onRetry: () => void; autoResume: boolean; retryable: boolean }) {
  const isValid = result.result === 'valid';
  const isAlreadyUsed = result.result === 'already_used';
  // Couleurs ajustées pour passer le contraste 4.5:1 du texte blanc
  // (emerald-500/red-500 sur fond plein passaient juste sous le seuil).
  const bg = isValid ? 'bg-emerald-700' : isAlreadyUsed ? 'bg-amber-600' : 'bg-red-700';

  return (
    <div className={`fixed inset-0 z-50 ${bg} text-white flex flex-col items-center justify-center p-6 overflow-y-auto`} role="alert" aria-live="assertive">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto w-28 h-28 rounded-full bg-white/20 flex items-center justify-center mb-4">
          {isValid ? <CheckCircle2 className="w-16 h-16" aria-hidden="true" /> : isAlreadyUsed ? <AlertTriangle className="w-16 h-16" aria-hidden="true" /> : <XCircle className="w-16 h-16" aria-hidden="true" />}
        </div>
        <h2 className="text-4xl font-display font-extrabold mb-1">
          {isValid ? 'Accès autorisé' : isAlreadyUsed ? 'Déjà utilisé' : 'Refusé'}
        </h2>
        <p className="text-white/95">{result.message}</p>

        {result.reservation && (
          <div className="bg-white/15 rounded-xl p-4 mt-5 text-left text-sm space-y-1.5">
            <div className="font-semibold text-base">{result.reservation.user_name}</div>
            <div className="opacity-90">Référence : {result.reservation.reference}</div>
            <div className="opacity-90">{formatDate(result.reservation.date)} · {formatTimeRange(result.reservation.start_time, result.reservation.end_time)}</div>
            <div className="opacity-90">
              {result.reservation.nb_persons} personne{result.reservation.nb_persons > 1 ? 's' : ''}
              {typeof result.reservation.nb_adults === 'number' && (
                <span className="opacity-80">
                  {' '}({result.reservation.nb_adults} adulte{result.reservation.nb_adults > 1 ? 's' : ''}
                  {(result.reservation.nb_children ?? 0) > 0 && `, ${result.reservation.nb_children} enfant${result.reservation.nb_children! > 1 ? 's' : ''}`})
                </span>
              )}
            </div>

            {result.reservation.usager_type === 'habitant' && (
              <div className="mt-2 pt-2 border-t border-white/20 space-y-1.5">
                <div className="inline-flex items-center gap-1.5 bg-white/25 rounded-md px-2 py-1 text-xs font-semibold">
                  <Home className="w-3.5 h-3.5" aria-hidden="true" /> Tarif Nocéen — Neuilly-sur-Marne
                </div>
                {result.reservation.proof_url ? (
                  <a href={result.reservation.proof_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs underline hover:opacity-90">
                    <FileText className="w-3.5 h-3.5" aria-hidden="true" /> Voir le justificatif de domicile
                  </a>
                ) : (
                  <div className="flex items-center gap-1.5 text-xs opacity-90">
                    <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" /> Justificatif non joint
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {isValid && (
          <p className="mt-5 font-bold text-lg bg-white/20 rounded-xl py-3">
            → Remettre {result.reservation?.nb_persons ?? 1} bracelet{(result.reservation?.nb_persons ?? 1) > 1 ? 's' : ''} (durée 2 h).
          </p>
        )}

        <div className="mt-6 flex flex-col gap-2">
          <button onClick={onReset} className="w-full bg-white text-slate-900 font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-100 text-lg min-h-[56px] focus:outline-none focus-visible:ring-2 focus-visible:ring-white">
            <RotateCcw className="w-5 h-5" aria-hidden="true" /> Scanner suivant
          </button>
          {retryable && (
            <button onClick={onRetry} className="w-full bg-white/15 hover:bg-white/25 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 text-sm min-h-[44px]">
              <RotateCcw className="w-4 h-4" aria-hidden="true" /> Réessayer ce même QR
            </button>
          )}
        </div>
        {autoResume && (
          <p className="mt-3 text-xs text-white/85">Reprise automatique du scan…</p>
        )}
      </div>
    </div>
  );
}

// Feedback agent : haptique (vibration) + sonore, distincts OK / refus.
function feedback(success: boolean) {
  try { navigator.vibrate?.(success ? 90 : [130, 70, 130]); } catch { /* non supporté */ }
  playSound(success);
}

function playSound(success: boolean) {
  if (typeof window === 'undefined') return;
  try {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    const beep = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.06;
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur);
    };
    if (success) {
      // double note montante, agréable
      beep(880, 0, 0.1);
      beep(1175, 0.12, 0.14);
      setTimeout(() => ctx.close(), 400);
    } else {
      // buzz grave plus long
      beep(196, 0, 0.32);
      setTimeout(() => ctx.close(), 450);
    }
  } catch { /* silent */ }
}
