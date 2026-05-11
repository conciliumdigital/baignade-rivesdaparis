import { format, parseISO, isValid } from 'date-fns';
import { fr } from 'date-fns/locale';

export function formatPrice(cents: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

export function formatDate(date: string | Date, pattern = 'EEEE d MMMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (!isValid(d)) return '';
  return format(d, pattern, { locale: fr });
}

export function formatTime(time: string): string {
  // 14:00:00 -> 14h00
  const [h, m] = time.split(':');
  return `${h}h${m}`;
}

export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function classNames(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}
