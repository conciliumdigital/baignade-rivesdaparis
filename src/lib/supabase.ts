import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Mode démo : si pas de config Supabase, on bascule en stub local pour permettre le dev offline.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : (null as unknown as ReturnType<typeof createClient>);

if (!isSupabaseConfigured && typeof window !== 'undefined') {
  // eslint-disable-next-line no-console
  console.warn(
    '[baignade] Supabase non configuré : mode démo activé. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY dans .env.local',
  );
}
