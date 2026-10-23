-- =====================================================================
-- Make someone an admin (can add, edit and remove dishes).
-- 1. They sign up on the website first (account.html) and confirm their email.
-- 2. Paste this into Supabase → SQL Editor, replace the email THERE (not in this
--    file — this file is published with the website), then Run.
-- =====================================================================
insert into public.admins (user_id)
select id from auth.users where email = lower('REPLACE-WITH-ADMIN-EMAIL@example.com')
on conflict do nothing;

-- Check who is an admin:
select u.email, a.added_at
from public.admins a join auth.users u on u.id = a.user_id
order by a.added_at;

-- To remove an admin, run:
-- delete from public.admins where user_id = (select id from auth.users where email = lower('their-email@example.com'));
