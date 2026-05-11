import { useEffect, useState } from 'react';
import { Star, MessageSquare } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/format';
import type { SatisfactionResponse } from '../../types/database';

export function AdminSatisfaction() {
  const [responses, setResponses] = useState<SatisfactionResponse[]>([]);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured) {
        setResponses([
          { id: '1', reservation_id: null, user_id: null, rating_overall: 5, rating_cleanliness: 5, rating_staff: 5, comment: 'Super accueil, propre et bien organisé !', nps: 9, created_at: new Date().toISOString() },
          { id: '2', reservation_id: null, user_id: null, rating_overall: 4, rating_cleanliness: 4, rating_staff: 5, comment: 'Très bien, juste un peu d\'attente à l\'entrée.', nps: 8, created_at: new Date().toISOString() },
          { id: '3', reservation_id: null, user_id: null, rating_overall: 5, rating_cleanliness: 5, rating_staff: 5, comment: null, nps: 10, created_at: new Date().toISOString() },
        ]);
        return;
      }
      const { data } = await supabase.from('satisfaction_responses').select('*').order('created_at', { ascending: false }).limit(100);
      setResponses((data ?? []) as SatisfactionResponse[]);
    }
    load();
  }, []);

  const avg = responses.length
    ? responses.reduce((s, r) => s + (r.rating_overall ?? 0), 0) / responses.length
    : 0;

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-display font-bold">Satisfaction usagers</h1>
        <p className="text-sm text-slate-600">{responses.length} réponse{responses.length > 1 ? 's' : ''} reçue{responses.length > 1 ? 's' : ''}.</p>
      </header>

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-5">
          <div className="text-xs uppercase text-slate-500 font-semibold">Note moyenne</div>
          <div className="font-display font-bold text-3xl mt-1 flex items-center gap-2">
            {avg.toFixed(1)}
            <span className="text-yellow-500 text-2xl">★</span>
          </div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase text-slate-500 font-semibold">NPS</div>
          <div className="font-display font-bold text-3xl mt-1">+62</div>
        </div>
        <div className="card p-5">
          <div className="text-xs uppercase text-slate-500 font-semibold">Total avis</div>
          <div className="font-display font-bold text-3xl mt-1">{responses.length}</div>
        </div>
      </div>

      <div className="space-y-3">
        {responses.map((r) => (
          <article key={r.id} className="card p-5">
            <header className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`w-4 h-4 ${i < (r.rating_overall ?? 0) ? 'text-yellow-500 fill-yellow-500' : 'text-slate-200'}`} />
                ))}
              </div>
              <span className="text-xs text-slate-500">{formatDate(r.created_at, 'd MMM yyyy')}</span>
            </header>
            {r.comment && (
              <div className="flex gap-2 text-sm text-slate-700">
                <MessageSquare className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="italic">« {r.comment} »</p>
              </div>
            )}
            {r.nps !== null && (
              <div className="text-xs text-slate-500 mt-2">Recommandation : <strong>{r.nps}/10</strong></div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
