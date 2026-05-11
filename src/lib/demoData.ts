// Données de démonstration utilisées quand Supabase n'est pas configuré.
// Permet de visualiser l'app en local sans backend.
import { addDays, format } from 'date-fns';
import type { SlotAvailability } from '../types/database';

function buildDemoSlots(): SlotAvailability[] {
  const slots: SlotAvailability[] = [];
  const today = new Date();
  const slotTimes = [
    { start: '10:00:00', end: '12:00:00' },
    { start: '12:00:00', end: '14:00:00' },
    { start: '14:00:00', end: '16:00:00' },
    { start: '16:00:00', end: '18:00:00' },
    { start: '18:00:00', end: '20:00:00' },
  ];

  for (let d = 0; d < 14; d++) {
    const date = format(addDays(today, d), 'yyyy-MM-dd');
    slotTimes.forEach((t, idx) => {
      const capacity = 50;
      const booked = Math.min(capacity, Math.floor(Math.random() * (capacity + 10)));
      const isClosed = d === 3 && idx === 0; // 1 créneau fermé pour démo
      slots.push({
        id: `demo-${date}-${idx}`,
        date,
        start_time: t.start,
        end_time: t.end,
        capacity,
        price_cents: 500,
        status: isClosed ? 'closed' : 'open',
        booked,
        remaining: Math.max(capacity - booked, 0),
      });
    });
  }
  return slots;
}

export const demoSlots = buildDemoSlots();
