const SUPABASE_URL = 'https://tvalhthovifuxqhkdndc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_8i86uxtmvdX5crq3xlnNRQ_mHS0mWpS';

// Adicionamos window. antes para evitar conflito de nomes no JavaScript
export const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);