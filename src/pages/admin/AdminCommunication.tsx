import { useState } from 'react';
import { Send, Eye, Mail, Users, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

const TEMPLATES = [
  { id: 'reminder_j1', name: 'Rappel J-1', subject: 'Demain : votre baignade à Neuilly-sur-Marne' },
  { id: 'reminder_h1', name: 'Rappel H-1', subject: 'Votre créneau commence dans 1 heure' },
  { id: 'closure', name: 'Fermeture météo', subject: 'Information importante : créneau modifié' },
  { id: 'satisfaction', name: 'Satisfaction', subject: 'Donnez-nous votre avis sur votre baignade' },
];

export function AdminCommunication() {
  const [segment, setSegment] = useState('all');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [previewMode, setPreviewMode] = useState(false);

  function handleTest() {
    // Mode démonstration tant que l'API d'envoi n'est pas branchée :
    // pas de vrai envoi pour éviter de gâcher la quota Brevo en QA.
    toast('Mode démonstration : aucun courriel n\'a été envoyé.', { icon: 'ℹ️' });
  }

  function handleSend() {
    if (!subject.trim() || !body.trim()) { toast.error('Le sujet et le message sont requis.'); return; }
    if (!confirm('Confirmer l\'envoi de cette campagne ?')) return;
    toast('Mode démonstration : aucun envoi réel. La campagne sera mise en file dès l\'activation du connecteur.', { icon: 'ℹ️', duration: 6000 });
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-display font-bold">Communication</h1>
        <p className="text-sm text-slate-600">Envoyez des emails ciblés aux usagers de la zone de baignade.</p>
      </header>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <section className="card p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4 text-brand-600" /> Destinataires</h2>
            <select className="input" value={segment} onChange={e => setSegment(e.target.value)}>
              <option value="all">Tous les inscrits</option>
              <option value="upcoming">Réservations à venir</option>
              <option value="today">Réservations du jour</option>
              <option value="residents">Habitants de Neuilly-sur-Marne</option>
              <option value="past_visitors">Anciens visiteurs (post-visite)</option>
              <option value="custom">Segment personnalisé…</option>
            </select>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold flex items-center gap-2"><Mail className="w-4 h-4 text-brand-600" /> Message</h2>
              <button onClick={() => setPreviewMode(!previewMode)} className="btn-ghost text-xs"><Eye className="w-4 h-4" /> {previewMode ? 'Édition' : 'Aperçu'}</button>
            </div>
            <input type="text" className="input mb-3" placeholder="Sujet…" value={subject} onChange={e => setSubject(e.target.value)} />
            {previewMode ? (
              <div className="bg-slate-50 rounded-xl p-5 prose prose-sm max-w-none border border-slate-100 min-h-[280px]">
                <h3 className="text-base font-bold mb-2">{subject || '(sans sujet)'}</h3>
                <div className="whitespace-pre-wrap text-sm">{body || '(aucun contenu)'}</div>
              </div>
            ) : (
              <textarea
                className="input min-h-[280px] font-mono text-sm"
                placeholder="Bonjour {{prenom}},&#10;&#10;Merci de votre confiance pour votre baignade le {{date_creneau}}…"
                value={body}
                onChange={e => setBody(e.target.value)}
              />
            )}
            <p className="text-xs text-slate-500 mt-2">Variables disponibles : <code>{'{{prenom}}'}</code>, <code>{'{{nom}}'}</code>, <code>{'{{date_creneau}}'}</code>, <code>{'{{horaire}}'}</code>, <code>{'{{reference}}'}</code></p>
          </section>

          <div className="flex gap-2 justify-end">
            <button onClick={handleTest} className="btn-secondary"><Mail className="w-4 h-4" /> Test à moi</button>
            <button onClick={handleSend} className="btn-primary"><Send className="w-4 h-4" /> Envoyer</button>
          </div>
        </div>

        <aside className="space-y-3">
          <h2 className="font-semibold text-sm text-slate-600 uppercase tracking-wide">Templates</h2>
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => { setSubject(t.subject); }}
              className="card p-4 w-full text-left hover:border-brand-300 transition"
            >
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-brand-600" />
                <span className="font-semibold text-sm">{t.name}</span>
              </div>
              <p className="text-xs text-slate-500">{t.subject}</p>
            </button>
          ))}
        </aside>
      </div>
    </div>
  );
}
