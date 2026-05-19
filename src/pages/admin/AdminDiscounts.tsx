import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Plus, Loader2, Trash2, Ticket, ToggleLeft, ToggleRight } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { formatPrice } from '../../lib/format';

interface Code {
  code: string;
  label: string | null;
  kind: 'percent' | 'fixed';
  value: number;
  active: boolean;
  max_uses: number | null;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  min_amount_cents: number;
}

export function AdminDiscounts() {
  const [codes, setCodes] = useState<Code[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    if (!isSupabaseConfigured) { setLoading(false); setLoadError(true); return; }
    setLoading(true);
    const { data, error } = await supabase.from('discount_codes').select('*').order('created_at', { ascending: false });
    if (error) { setLoadError(true); setLoading(false); return; }
    setCodes((data ?? []) as Code[]);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function toggle(c: Code) {
    const { error } = await supabase.from('discount_codes').update({ active: !c.active }).eq('code', c.code);
    if (error) toast.error(error.message);
    else { toast.success(c.active ? 'Code désactivé' : 'Code activé'); load(); }
  }

  async function remove(code: string) {
    if (!confirm(`Supprimer définitivement le code ${code} ?`)) return;
    const { error } = await supabase.from('discount_codes').delete().eq('code', code);
    if (error) toast.error(error.message);
    else { toast.success('Code supprimé'); load(); }
  }

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold flex items-center gap-2">
            <Ticket className="w-6 h-6 text-brand-600" /> Codes de réduction
          </h1>
          <p className="text-sm text-slate-600">La remise est validée et appliquée côté serveur (anti-fraude).</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Nouveau code</button>
      </header>

      {loading ? (
        <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="card p-4 h-14 shimmer" />)}</div>
      ) : loadError ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-slate-500">Exécutez la migration <code>discount_codes</code> dans Supabase, puis rechargez.</p>
        </div>
      ) : codes.length === 0 ? (
        <div className="card p-10 text-center">
          <Ticket className="w-9 h-9 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500 mb-4">Aucun code de réduction.</p>
          <button onClick={() => setShowCreate(true)} className="btn-primary">Créer un code</button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-left">Code</th>
                <th className="px-4 py-3 text-left">Remise</th>
                <th className="px-4 py-3 text-left">Usages</th>
                <th className="px-4 py-3 text-left">Validité</th>
                <th className="px-4 py-3 text-left">Statut</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {codes.map((c) => (
                <tr key={c.code}>
                  <td className="px-4 py-3 font-mono font-semibold">{c.code}{c.label && <span className="block text-xs font-sans font-normal text-slate-500">{c.label}</span>}</td>
                  <td className="px-4 py-3">{c.kind === 'percent' ? `−${c.value}%` : `−${formatPrice(c.value)}`}</td>
                  <td className="px-4 py-3">{c.used_count}{c.max_uses != null ? ` / ${c.max_uses}` : ''}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {c.valid_from ? `dès ${c.valid_from.slice(0, 10)}` : '—'}{c.valid_until ? ` → ${c.valid_until.slice(0, 10)}` : ''}
                  </td>
                  <td className="px-4 py-3">
                    {c.active ? <span className="badge-success">Actif</span> : <span className="badge-muted">Inactif</span>}
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    <button onClick={() => toggle(c)} className="btn-ghost text-xs" title={c.active ? 'Désactiver' : 'Activer'}>
                      {c.active ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                    <button onClick={() => remove(c.code)} className="btn-ghost text-xs" title="Supprimer"><Trash2 className="w-4 h-4 text-red-500" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateCodeModal onClose={() => setShowCreate(false)} onSaved={load} />}
    </div>
  );
}

function CreateCodeModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { profile } = useAuth();
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [kind, setKind] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState(10); // % si percent, € si fixed
  const [maxUses, setMaxUses] = useState('');
  const [until, setUntil] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) { toast.error('Code requis'); return; }
    if (kind === 'percent' && (value <= 0 || value > 100)) { toast.error('Pourcentage entre 1 et 100'); return; }
    if (!isSupabaseConfigured) { toast.success('Mode démo : code non persisté'); onClose(); return; }
    setSaving(true);
    const { error } = await supabase.from('discount_codes').insert({
      code: c,
      label: label.trim() || null,
      kind,
      value: kind === 'percent' ? Math.round(value) : Math.round(value * 100),
      max_uses: maxUses.trim() ? Number(maxUses) : null,
      valid_until: until ? new Date(until).toISOString() : null,
      active: true,
      created_by: profile?.id,
    });
    setSaving(false);
    if (error) { toast.error(error.code === '23505' ? 'Ce code existe déjà.' : error.message); return; }
    toast.success('Code créé');
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="card p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display font-bold text-lg mb-4">Nouveau code de réduction</h2>
        <form onSubmit={save} className="space-y-3">
          <div><label className="label">Code (ex : ETE2026)</label><input className="input uppercase" required value={code} onChange={(e) => setCode(e.target.value)} /></div>
          <div><label className="label">Libellé interne (facultatif)</label><input className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Opération été, partenaire…" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Type</label>
              <select className="input" value={kind} onChange={(e) => setKind(e.target.value as 'percent' | 'fixed')}>
                <option value="percent">Pourcentage (%)</option>
                <option value="fixed">Montant fixe (€)</option>
              </select>
            </div>
            <div>
              <label className="label">{kind === 'percent' ? 'Réduction (%)' : 'Réduction (€)'}</label>
              <input type="number" min={0} step={kind === 'percent' ? 1 : 0.5} className="input" value={value} onChange={(e) => setValue(Number(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Usages max (vide = illimité)</label><input type="number" min={1} className="input" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} /></div>
            <div><label className="label">Valable jusqu'au (facultatif)</label><input type="date" className="input" value={until} onChange={(e) => setUntil(e.target.value)} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-ghost">Annuler</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
