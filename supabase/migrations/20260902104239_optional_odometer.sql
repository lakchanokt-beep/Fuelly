alter table public.fuel_records
  alter column current_odometer drop not null,
  alter column previous_odometer drop not null;
