create table public.fuel_price_history (
  price_date date not null,
  station_id text not null,
  station_name text not null,
  fuel_id text not null,
  fuel_label text not null,
  price numeric(8, 2) not null check (price > 0),
  effective_at text not null default '',
  source text not null,
  source_url text not null,
  fetched_at timestamptz not null default now(),
  primary key (price_date, station_id, fuel_id)
);

alter table public.fuel_price_history enable row level security;

revoke all on table public.fuel_price_history from anon;
grant select on table public.fuel_price_history to authenticated;
grant all on table public.fuel_price_history to service_role;

create policy "authenticated users can read fuel price history"
on public.fuel_price_history
for select
to authenticated
using (true);
