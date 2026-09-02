-- Required by the daily fuel-price snapshot job configured in Supabase.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
