-- Drop existing table if it has wrong schema
drop table if exists payment_settings cascade;

-- Create payment_settings table with UUID primary key
create table payment_settings (
  id uuid primary key default gen_random_uuid(),
  stripe_enabled boolean default true not null,
  interac_enabled boolean default true not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table payment_settings enable row level security;

-- Create policies - anyone can read, authenticated users can write
create policy "Allow public to read payment settings" on payment_settings
  for select using (true);

create policy "Allow authenticated to update payment settings" on payment_settings
  for update using (auth.role() = 'authenticated');

-- Insert default settings
insert into payment_settings (stripe_enabled, interac_enabled)
values (true, true)
on conflict do nothing;
