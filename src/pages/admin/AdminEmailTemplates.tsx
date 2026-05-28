import { useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Loader2, Save, RotateCcw, Mail, Eye, AlertTriangle } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { RichTextEditor } from '../../components/RichTextEditor';
import { mapSupabaseError } from '../../lib/errors';

// Modèles dont le déclencheur d'envoi est aujourd'hui câblé (côté SQL ou
// Edge Functions). Les autres sont enregistrés mais pas encore envoyés.
const WIRED = new Set(['confirmation', 'closure', 'waitlist_offered', 'reminder_j1', 'reminder_h1']);

interface Template { key: string; name: string; subject: string; body_html: string }

const VARS = ['prenom', 'nom', 'reference', 'date', 'horaire', 'nb_personnes', 'total', 'lieu', 'lien_compte'];

// Échantillon pour l'aperçu (les vraies valeurs sont injectées à l'envoi)
const SAMPLE: Record<string, string> = {
  prenom: 'Camille', nom: 'Dubois', reference: 'ABC12345',
  date: 'samedi 4 juillet 2026', horaire: '12:00 – 14:00',
  nb_personnes: '2 adulte(s) + 1 enfant(s)', total: '12,00 €',
  lieu: 'Berge de la Marne, Neuilly-sur-Marne', lien_compte: '#',
};

// Valeurs par défaut (miroir de la migration) pour « Réinitialiser ».
const DEFAULTS: Record<string, { subject: string; body_html: string }> = {
  confirmation: {
    subject: 'Votre réservation est confirmée — {{date}}',
    body_html:
      '<p>Bonjour {{prenom}},</p><p>Votre réservation est confirmée. Présentez le QR code ci-dessous à l\'accueil le jour de votre visite.</p><p><strong>Date :</strong> {{date}}<br><strong>Horaire :</strong> {{horaire}}<br><strong>Personnes :</strong> {{nb_personnes}}<br><strong>Total payé :</strong> {{total}}</p><p><strong>Lieu :</strong> {{lieu}}</p><p>À apporter : maillot de bain, serviette, crème solaire. Casiers gratuits sur place.</p><p><a href="{{lien_compte}}">Voir ma réservation</a></p>',
  },
  reminder_j1: {
    subject: 'Demain : votre baignade à Neuilly-sur-Marne',
    body_html: '<p>Bonjour {{prenom}},</p><p>Petit rappel : votre créneau de baignade est prévu <strong>demain {{date}}</strong>, de {{horaire}}. Pensez à votre QR code (réf. {{reference}}).</p><p>À demain !</p>',
  },
  reminder_h1: {
    subject: 'Votre créneau commence dans 1 heure',
    body_html: '<p>Bonjour {{prenom}},</p><p>Votre créneau de baignade ({{horaire}}) commence bientôt. Présentez votre QR code à l\'accueil. Réf. {{reference}}.</p>',
  },
  closure: {
    subject: 'Information importante — créneau du {{date}} modifié',
    body_html: '<p>Bonjour {{prenom}},</p><p>En raison des conditions météo, votre créneau du <strong>{{date}}</strong> ({{horaire}}) est impacté. Vous serez recontacté pour un report ou un remboursement.</p><p>Merci de votre compréhension.</p>',
  },
  satisfaction: {
    subject: 'Votre avis sur votre baignade du {{date}}',
    body_html: '<p>Bonjour {{prenom}},</p><p>Vous avez profité de la zone de baignade le {{date}}. Votre avis nous aide à améliorer le service : <a href="{{lien_compte}}">donner mon avis</a>.</p>',
  },
};

function subst(s: string) {
  return s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => SAMPLE[k] ?? `{{${k}}}`);
}

export function AdminEmailTemplates() {
  const { profile } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeKey, setActiveKey] = useState<string>('confirmation');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [dirty, setDirty] = useState(false);
  const bodyAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) { setLoading(false); setLoadError(true); return; }
      const { data, error } = await supabase
        .from('email_templates')
        .select('key, name, subject, body_html')
        .order('key');
      if (error || !data) { setLoadError(true); setLoading(false); return; }
      setTemplates(data as Template[]);
      const first = (data as Template[]).find((t) => t.key === 'confirmation') ?? (data as Template[])[0];
      if (first) { setActiveKey(first.key); setSubject(first.subject); setBody(first.body_html); }
      setLoading(false);
    }
    load();
  }, []);

  function selectTemplate(key: string) {
    if (dirty && !confirm('Vous avez des modifications non enregistrées. Les abandonner ?')) {
      return;
    }
    const t = templates.find((x) => x.key === key);
    if (!t) return;
    setActiveKey(key);
    setSubject(t.subject);
    setBody(t.body_html);
    setDirty(false);
  }

  function resetToDefault() {
    const d = DEFAULTS[activeKey];
    if (!d) return;
    if (!confirm('Réinitialiser ce modèle au texte par défaut ? (non enregistré tant que vous ne sauvegardez pas)')) return;
    setSubject(d.subject);
    setBody(d.body_html);
    setDirty(true);
  }

  // Insertion d'une variable {{xxx}} à la fin de l'objet ou du corps,
  // selon le dernier champ ayant le focus. Cliquable au lieu d'imposer
  // une recopie manuelle.
  function insertVariable(v: string) {
    const token = `{{${v}}}`;
    const active = document.activeElement as HTMLElement | null;
    if (active && active.tagName === 'INPUT') {
      setSubject((s) => s + token);
    } else {
      setBody((s) => s + token);
    }
    setDirty(true);
  }

  async function save() {
    if (!subject.trim() || !body.trim()) { toast.error('L\'objet et le corps sont requis.'); return; }
    if (!isSupabaseConfigured) { toast.success('Mode démonstration : modèle non persisté.'); return; }
    setSaving(true);
    const { error } = await supabase
      .from('email_templates')
      .update({ subject, body_html: body, updated_by: profile?.id })
      .eq('key', activeKey);
    setSaving(false);
    if (error) { toast.error(mapSupabaseError(error)); return; }
    setTemplates((prev) => prev.map((t) => (t.key === activeKey ? { ...t, subject, body_html: body } : t)));
    setDirty(false);
    toast.success('Modèle enregistré.');
  }

  const activeName = useMemo(
    () => templates.find((t) => t.key === activeKey)?.name ?? activeKey,
    [templates, activeKey],
  );

  if (loading) {
    return <div className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin text-brand-600 mx-auto" /></div>;
  }
  if (loadError) {
    return (
      <div className="card p-10 text-center max-w-lg">
        <AlertTriangle className="w-9 h-9 text-amber-500 mx-auto mb-3" aria-hidden="true" />
        <h2 className="font-display font-bold mb-1">Modèles indisponibles.</h2>
        <p className="text-sm text-slate-500">Exécutez la migration <code>email_templates</code> dans Supabase, puis rechargez.</p>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Mail className="w-6 h-6 text-brand-600" aria-hidden="true" /> Modèles d&apos;e-mails automatiques
        </h1>
        <p className="text-sm text-slate-600">
          Modifiez l&apos;objet et le contenu des e-mails. L&apos;en-tête, le QR code et le pied de page
          sont gérés automatiquement (non modifiables) pour garantir un rendu fiable.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 mb-5" role="tablist" aria-label="Liste des modèles d'e-mails">
        {templates.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={activeKey === t.key}
            onClick={() => selectTemplate(t.key)}
            className={`text-sm px-3 py-1.5 rounded-lg border min-h-[36px] ${
              activeKey === t.key ? 'bg-brand-50 border-brand-200 text-brand-700 font-semibold' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.name}
            {!WIRED.has(t.key) && <span className="ml-1.5 text-[10px] text-amber-600">(déclencheur à brancher)</span>}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <section className="space-y-3">
          <div className="card p-5">
            <label className="label" htmlFor="tpl-subject">Objet de l&apos;e-mail — « {activeName} »</label>
            <input
              id="tpl-subject"
              className="input"
              value={subject}
              onChange={(e) => { setSubject(e.target.value); setDirty(true); }}
            />
            <label className="label mt-4" htmlFor="tpl-body">Corps de l&apos;e-mail</label>
            <div ref={bodyAreaRef}>
              <RichTextEditor value={body} onChange={(v) => { setBody(v); setDirty(true); }} />
            </div>
            <div className="text-xs text-slate-500 mt-2">
              <p className="mb-1">Variables (cliquez pour insérer à l&apos;endroit du dernier champ utilisé) :</p>
              <div className="flex flex-wrap gap-1.5">
                {VARS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded font-mono text-xs min-h-[28px]"
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            </div>
            {!WIRED.has(activeKey) && (
              <p className="text-xs text-amber-700 mt-2">
                Ce modèle est enregistré mais pas encore envoyé automatiquement (déclencheur à brancher ultérieurement).
              </p>
            )}
            <div className="flex justify-between items-center gap-2 pt-4">
              <button onClick={resetToDefault} className="btn-ghost text-sm"><RotateCcw className="w-4 h-4" aria-hidden="true" /> Réinitialiser</button>
              <div className="flex gap-2">
                <button onClick={() => setShowPreview((s) => !s)} className="btn-ghost text-sm lg:hidden"><Eye className="w-4 h-4" aria-hidden="true" /> Aperçu</button>
                <button onClick={save} disabled={saving || !dirty} className="btn-primary text-sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <><Save className="w-4 h-4" aria-hidden="true" /> {dirty ? 'Enregistrer' : 'Enregistré'}</>}
                </button>
              </div>
            </div>
          </div>
        </section>

        {showPreview && (
          <section className={showPreview ? '' : 'hidden lg:block'}>
            <div className="card p-5 sticky top-6">
              <h2 className="font-semibold text-sm mb-3 flex items-center gap-2"><Eye className="w-4 h-4 text-brand-600" /> Aperçu (données d'exemple)</h2>
              <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                <div style={{ background: 'linear-gradient(135deg,#0284c7,#0c4a6e)', color: '#fff', padding: '20px 24px' }}>
                  <div className="font-bold text-lg">Réservation confirmée</div>
                  <div className="text-xs opacity-90">Baignade Rives d'Paris — Neuilly-sur-Marne</div>
                </div>
                <div className="bg-white p-5 text-sm">
                  <div className="text-xs text-slate-500 mb-1">Objet : <strong>{subst(subject)}</strong></div>
                  <hr className="my-2 border-slate-100" />
                  {/* Aperçu de contenu rédigé par l'admin (lui-même) — usage légitime de dangerouslySetInnerHTML */}
                  <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: subst(body) }} />
                  {activeKey === 'confirmation' && (
                    <div className="text-center my-4">
                      <div className="inline-block w-32 h-32 bg-slate-100 border border-slate-200 rounded-xl flex items-center justify-center text-[10px] text-slate-400">
                        QR code<br />(généré auto)
                      </div>
                    </div>
                  )}
                </div>
                <div className="bg-slate-50 px-5 py-3 text-[11px] text-slate-500 text-center">
                  Annulation gratuite jusqu'à 24h avant le créneau · Commune de Neuilly-sur-Marne
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
