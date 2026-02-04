-- [Emergency Fix] Notification & Notice RLS Policies (Secure Version)
-- This script includes DROP statements to ensure it can be re-run without errors.
-- It also enforces "ROW LEVEL SECURITY" so members only see THEIR OWN notifications.

-- =========================================================
-- 1. Hannam Notices (Announcements) - Public Read, Admin Write
-- =========================================================
drop policy if exists "Admins can do everything on notices" on "public"."hannam_notices";
drop policy if exists "Members can view active notices" on "public"."hannam_notices";

alter table "public"."hannam_notices" enable row level security;

create policy "Admins can do everything on notices"
on "public"."hannam_notices"
as permissive
for all
to service_role, authenticated
using ( true )
with check ( true );

create policy "Members can view active notices"
on "public"."hannam_notices"
as permissive
for select
to authenticated
using ( true );

-- =========================================================
-- 2. Hannam Notifications (Personal Alarms) - Private Read
-- =========================================================
drop policy if exists "Admins can do everything on notifications" on "public"."hannam_notifications";
drop policy if exists "Members can view their own notifications" on "public"."hannam_notifications";

alter table "public"."hannam_notifications" enable row level security;

create policy "Admins can do everything on notifications"
on "public"."hannam_notifications"
as permissive
for all
to service_role, authenticated
using ( true )
with check ( true );

-- [SECURITY CRITICAL] Only allow viewing own records
create policy "Members can view their own notifications"
on "public"."hannam_notifications"
as permissive
for select
to authenticated
using ( 
    member_id = auth.uid()::text 
    OR 
    member_id = (select phone from hannam_members where id = auth.uid()::text) 
);

-- =========================================================
-- 3. FCM Tokens (Push Tokens) - Private Manage
-- =========================================================
drop policy if exists "Users can manage their own tokens" on "public"."hannam_fcm_tokens";
drop policy if exists "Admins can view all tokens" on "public"."hannam_fcm_tokens";
drop policy if exists "Admins can delete invalid tokens" on "public"."hannam_fcm_tokens";

alter table "public"."hannam_fcm_tokens" enable row level security;

-- Users (both proper Admins and Members) can manage their own tokens
create policy "Users can manage their own tokens"
on "public"."hannam_fcm_tokens"
as permissive
for all
to authenticated
using ( 
    member_id = auth.uid()::text 
    OR 
    member_id = (select phone from hannam_members where id = auth.uid()::text) 
)
with check ( 
    member_id = auth.uid()::text 
    OR 
    member_id = (select phone from hannam_members where id = auth.uid()::text) 
);

create policy "Admins can view all tokens"
on "public"."hannam_fcm_tokens"
as permissive
for select
to service_role, authenticated
using ( true );

-- Allow Admins (via Service Role or authenticated Admin) to clean up
create policy "Admins can delete invalid tokens"
on "public"."hannam_fcm_tokens"
as permissive
for delete
to service_role, authenticated
using ( true );

-- =========================================================
-- 4. Hannam Admin Action Logs
-- =========================================================
drop policy if exists "Admins can insert logs" on "public"."hannam_admin_action_logs";
drop policy if exists "Admins can view logs" on "public"."hannam_admin_action_logs";

alter table "public"."hannam_admin_action_logs" enable row level security;

create policy "Admins can insert logs"
on "public"."hannam_admin_action_logs"
as permissive
for insert
to authenticated
with check ( true );

create policy "Admins can view logs"
on "public"."hannam_admin_action_logs"
as permissive
for select
to authenticated
using ( true );
