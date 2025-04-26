import { createClient } from '@supabase/supabase-js';

// Environment variables should be prefixed with VITE_ for Vite projects
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing environment variable: VITE_SUPABASE_URL");
}
if (!supabaseAnonKey) {
  throw new Error("Missing environment variable: VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Add this log
console.log("Supabase client created:", supabase && typeof supabase.rpc === 'function');

// Example type definition for the database schema (optional but recommended)
// You can generate this automatically using the Supabase CLI:
// npx supabase gen types typescript --project-id <your-project-id> --schema public > src/types/supabase.ts
// Then import it: import { Database } from '../types/supabase';
// And use it like: export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey); 