import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { addDays, format, parseISO, startOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Calendar, Clock, Users, AlertCircle, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { fetchUpcomingSlots } from '../lib/slots';
import { formatPrice, formatTimeRange } from '../lib/format';
import type { SlotAvailability } from '../types/database';

export function ReservationPage() {
  const navigate = useNavigate();
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [slots, setSlots] = useState<SlotAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [persons, setPersons] = useState(1);
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(false);

  useEffect(() => {
    setLoading(true);
    const from = format(weekStart, 'yyyy-MM-dd');
    const to = format(addDays(weekStart, 13), 'yyyy-MM-dd');
    fetchUpcomingSlots(from, to)
      .then(setSlots)
      .catch(() => setSlots([]))
      .finally(() => setLoading(false));
  }, [weekStart]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const slotsByDay = useMemo(() => {
    const map: Record<string, SlotAvailability[]> = {};
    slots.forEach((s) => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [slots]);

  function selectSlot(slot: SlotAvailability) {
    if (slot.status !== 'open' || slot.remaining < persons) return;
    navigate(`/reserver/${slot.id}?persons=${persons}`);
  }

  return (
    <div className="container-app py-10">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-display font-bold mb-2">Choisissez votre créneau</h1>
        <p className="text-slate-600 max-w-2xl">
          Créneaux de 2 heures, capacité limitée pour préserver la qualité du service. Sélectionnez le jour et l'horaire qui vous conviennent.
        </p>
      </header>

      {/* Filtres */}
      <div className="card p-4 mb-6 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-slate-600 mr-2">
          <Filter className="w-4 h-4" /> Filtres :
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-slate-500" />
          <span>Nombre de personnes :</span>
          <select className="input py-1.5 text-sm w-20" value={persons} onChange={(e) => setPersons(Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={showOnlyAvailable} onChange={(e) => setShowOnlyAvailable(e.target.checked)} className="rounded" />
          Masquer les créneaux complets
        </label>
        <div className="ml-auto flex items-center gap-2">
          <button
            className="btn-ghost text-sm"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Semaine précédente"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-medium px-2">
            {format(weekStart, 'd MMM', { locale: fr })} – {format(addDays(weekStart, 13), 'd MMM yyyy', { locale: fr })}
          </span>
          <button
            className="btn-ghost text-sm"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Semaine suivante"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grille des jours */}
      {loading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card p-5 h-64 shimmer" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {days.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const daySlots = slotsByDay[dateKey] ?? [];
            return (
              <div key={dateKey} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs uppercase text-slate-500 font-semibold tracking-wide">
                      {format(day, 'EEEE', { locale: fr })}
                    </div>
                    <div className="font-display font-bold text-lg">
                      {format(day, 'd MMM', { locale: fr })}
                    </div>
                  </div>
                  <Calendar className="w-4 h-4 text-slate-400" />
                </div>
                <div className="space-y-2">
                  {daySlots.length === 0 && (
                    <div className="text-xs text-slate-400 italic py-2">Aucun créneau</div>
                  )}
                  {daySlots
                    .filter((s) => !showOnlyAvailable || (s.status === 'open' && s.remaining >= persons))
                    .map((s) => (
                      <SlotButton key={s.id} slot={s} persons={persons} onSelect={selectSlot} />
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-slate-500 mt-8 text-center max-w-2xl mx-auto">
        Les créneaux sont mis à jour en temps réel. En cas de fermeture météo, vous recevrez une notification automatique avec une proposition de report ou de remboursement.
      </p>
    </div>
  );
}

function SlotButton({
  slot,
  persons,
  onSelect,
}: {
  slot: SlotAvailability;
  persons: number;
  onSelect: (s: SlotAvailability) => void;
}) {
  const isClosed = slot.status === 'closed' || slot.status === 'private';
  const isFull = slot.remaining === 0;
  const insufficient = !isClosed && !isFull && slot.remaining < persons;
  const disabled = isClosed || isFull || insufficient;

  return (
    <button
      type="button"
      onClick={() => onSelect(slot)}
      disabled={disabled}
      className={`w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition group ${
        disabled
          ? 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
          : 'border-brand-100 bg-white hover:border-brand-400 hover:bg-brand-50/50 hover:shadow-soft'
      }`}
      aria-label={`Créneau ${formatTimeRange(slot.start_time, slot.end_time)}`}
    >
      <div>
        <div className="font-semibold text-sm flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          {formatTimeRange(slot.start_time, slot.end_time)}
        </div>
        <div className="text-xs text-slate-500 mt-0.5">{formatPrice(slot.price_cents)}</div>
      </div>
      <div className="text-right">
        {isClosed ? (
          <span className="badge-muted">Fermé</span>
        ) : isFull ? (
          <span className="badge-danger">Complet</span>
        ) : insufficient ? (
          <span className="badge-warning">{slot.remaining} pl.</span>
        ) : (
          <span className="badge-success">{slot.remaining} pl.</span>
        )}
      </div>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="card p-10 text-center">
      <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <h2 className="font-display font-bold text-lg mb-1">Aucun créneau publié sur cette période</h2>
      <p className="text-sm text-slate-500 mb-5">Les créneaux d'été sont publiés en juin. Revenez bientôt !</p>
      <Link to="/" className="btn-secondary text-sm">Retour à l'accueil</Link>
    </div>
  );
}

// helper non utilisé directement mais utile : éviter un warning d'import
export const _parseISO = parseISO;
