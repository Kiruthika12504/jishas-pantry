-- =====================================================================
-- Jisha's Pantry — database setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to run again: it only creates what is missing.
--
-- Security model (enforced by the database, not the website):
--   * Anyone can READ the menu.
--   * Only admins can add, change or delete dishes and dish photos.
--   * Customers can read and change ONLY their own profile.
--   * Admins are added by hand with supabase/make-admin.sql — never from the website.
-- =====================================================================

-- ---------- Tables ----------
create table if not exists public.dishes (
  id          text primary key check (id ~ '^[a-z0-9-]{2,60}$'),
  name        text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 300),
  price       integer not null check (price between 1 and 100000),
  category    text not null check (char_length(category) between 2 and 40),
  veg         boolean not null default true,
  spice       smallint not null default 0 check (spice between 0 and 3),
  tags        text[] not null default '{}' check (cardinality(tags) <= 5),
  available   boolean not null default true,
  emoji       text not null default '🍽️' check (char_length(emoji) <= 8),
  image_url   text check (image_url is null or image_url ~ '^https://'),
  sort_order  integer not null default 100,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.admins (
  user_id  uuid primary key references auth.users (id) on delete cascade,
  added_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  full_name  text check (char_length(full_name) <= 60),
  phone      text check (phone ~ '^[6-9][0-9]{9}$'),
  address    text check (char_length(address) <= 200),
  pincode    text check (pincode ~ '^[0-9]{6}$'),
  landmark   text check (char_length(landmark) <= 60),
  updated_at timestamptz not null default now()
);

-- ---------- Helpers ----------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at = now(); return new; end $$;

drop trigger if exists dishes_touch on public.dishes;
create trigger dishes_touch before update on public.dishes
  for each row execute function public.touch_updated_at();
drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Lets a signed-in customer delete their own account and everything linked to it
-- (right to erasure under the DPDP Act, 2023).
create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  delete from auth.users where id = auth.uid();
end $$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- Row-level security ----------
alter table public.dishes   enable row level security;
alter table public.admins   enable row level security;  -- no policies: invisible to the website
alter table public.profiles enable row level security;

drop policy if exists "Anyone can read the menu" on public.dishes;
create policy "Anyone can read the menu" on public.dishes
  for select to anon, authenticated using (true);

drop policy if exists "Admins add dishes" on public.dishes;
create policy "Admins add dishes" on public.dishes
  for insert to authenticated with check ((select public.is_admin()));

drop policy if exists "Admins change dishes" on public.dishes;
create policy "Admins change dishes" on public.dishes
  for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

drop policy if exists "Admins delete dishes" on public.dishes;
create policy "Admins delete dishes" on public.dishes
  for delete to authenticated using ((select public.is_admin()));

drop policy if exists "Customers read own profile" on public.profiles;
create policy "Customers read own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists "Customers create own profile" on public.profiles;
create policy "Customers create own profile" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists "Customers change own profile" on public.profiles;
create policy "Customers change own profile" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------- Dish photos ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('dish-photos', 'dish-photos', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins upload dish photos" on storage.objects;
create policy "Admins upload dish photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'dish-photos' and (select public.is_admin()));

drop policy if exists "Admins replace dish photos" on storage.objects;
create policy "Admins replace dish photos" on storage.objects
  for update to authenticated using (bucket_id = 'dish-photos' and (select public.is_admin()));

drop policy if exists "Admins delete dish photos" on storage.objects;
create policy "Admins delete dish photos" on storage.objects
  for delete to authenticated using (bucket_id = 'dish-photos' and (select public.is_admin()));

-- ---------- Starting menu (sample dishes; edit them later in the admin page) ----------
insert into public.dishes (id, name, description, price, category, veg, spice, tags, emoji, sort_order) values
  ('chicken-biryani', 'Chicken Dum Biryani', 'Seeraga samba rice slow-cooked with tender chicken, whole spices and mint. Served with raita and brinjal curry.', 249, 'Biryani', false, 2, '{Bestseller}', '🍗', 10),
  ('veg-biryani', 'Veg Dum Biryani', 'Fragrant rice layered with seasonal vegetables, fried onions and ghee. Served with raita.', 199, 'Biryani', true, 1, '{}', '🍚', 20),
  ('butter-chicken', 'Butter Chicken', 'Tandoor-smoked chicken in a silky tomato, butter and cream gravy.', 259, 'Curries', false, 1, '{"Must try"}', '🍛', 30),
  ('paneer-butter-masala', 'Paneer Butter Masala', 'Soft paneer cubes simmered in a rich, mildly sweet makhani gravy.', 219, 'Curries', true, 1, '{Bestseller}', '🧀', 40),
  ('masala-dosa', 'Ghee Masala Dosa', 'Crisp golden dosa with spiced potato filling, coconut chutney and sambar.', 109, 'Tiffin', true, 1, '{}', '🥞', 50),
  ('kothu-parotta', 'Egg Kothu Parotta', 'Shredded parotta tossed on the tawa with egg, onions and salna.', 149, 'Tiffin', false, 2, '{"Chef''s special"}', '🥘', 60),
  ('chicken-65', 'Chicken 65', 'Crispy, fiery fried chicken with curry leaves and green chillies.', 189, 'Starters', false, 3, '{Bestseller}', '🌶️', 70),
  ('gobi-manchurian', 'Gobi Manchurian', 'Crunchy cauliflower florets tossed in a tangy Indo-Chinese sauce.', 149, 'Starters', true, 2, '{}', '🥦', 80),
  ('curd-rice', 'Temple Curd Rice', 'Creamy curd rice tempered with mustard, ginger and pomegranate. Served with pickle.', 89, 'Rice & Meals', true, 0, '{"Light meal"}', '🥣', 90),
  ('gulab-jamun', 'Gulab Jamun (2 pcs)', 'Warm khoya dumplings soaked in cardamom sugar syrup.', 69, 'Desserts', true, 0, '{}', '🍯', 100)
on conflict (id) do nothing;
