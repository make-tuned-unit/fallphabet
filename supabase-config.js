// Supabase Configuration for Fallphabet
// Replace these values with your actual Supabase project credentials

const SUPABASE_CONFIG = {
  url: 'https://bdyoplghimytzebroitg.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkeW9wbGdoaW15dHplYnJvaXRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwNzAxNzgsImV4cCI6MjA2NzY0NjE3OH0.tK4pVZ_4QAfbgErGjmxvdHpM-VHGR9Z8cV4xWXPfVEQ'
};

// Initialize Supabase client
const supabaseClient = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

// Export for use in other scripts
window.supabaseClient = supabaseClient; 