import { supabase, isSupabaseConfigured } from './supabase';
import { demoSlots } from './demoData';
import type { SlotAvailability } from '../types/database';

export async function fetchUpcomingSlots(fromDate: string, toDate: string): Promise<SlotAvailability[]> {
  if (!isSupabaseConfigured) {
    return demoSlots.filter((s) => s.date >= fromDate && s.date <= toDate);
  }
  const { data, error } = await supabase
    .from('slot_availability')
    .select('*')
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true });
  if (error) throw error;
  return (data ?? []) as SlotAvailability[];
}

export async function fetchSlotById(id: string): Promise<SlotAvailability | null> {
  if (!isSupabaseConfigured) {
    return demoSlots.find((s) => s.id === id) ?? null;
  }
  const { data, error } = await supabase.from('slot_availability').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as SlotAvailability | null) ?? null;
}
