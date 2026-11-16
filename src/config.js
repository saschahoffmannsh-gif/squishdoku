// Backend connection for SquishDoku (same pattern as Squish Attack's game/config.js).
//
// Only public values live here:
//   supabaseUrl  https://<PROJECT_REF>.supabase.co
//   anonKey      the project's publishable key (public by design; RLS must guard any table)
// Secrets (service role key, DB password) never go into this repo.
//
// Current values: dedicated project ixueznoxvanavkmrftaf ("squishdoku", eu-central-1).
// No backend features yet - nothing in the game calls Supabase so far.
window.SD_CONFIG = {
  supabaseUrl: "https://ixueznoxvanavkmrftaf.supabase.co",
  anonKey: "sb_publishable_hWwxaBOfeujQMSWY4W8iVA_akbEsFXQ"
};
