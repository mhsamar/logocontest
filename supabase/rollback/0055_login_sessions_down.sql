-- Undo 0055: removes the login records and their functions. Nobody is signed out by this.
drop function if exists public.end_stale_sessions();
drop function if exists public.session_heartbeat(uuid, int, boolean);
drop function if exists public.session_touch(uuid, text, text, text, text, text, text, text);
drop function if exists public.setting_bool(text, boolean);
drop function if exists public.setting_int(text, int);
drop function if exists public.end_sessions(uuid[], text);
drop table if exists public.user_sessions;

notify pgrst, 'reload schema';
