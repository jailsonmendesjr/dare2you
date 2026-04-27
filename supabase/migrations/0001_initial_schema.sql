-- 1. Enums
create type admin_role as enum ('admin', 'coach');
create type record_status as enum ('active', 'inactive');
create type daily_workout_status as enum ('draft', 'published', 'archived');
create type workout_type as enum ('for_time');
create type session_status as enum ('waiting', 'live', 'finished', 'cancelled');
create type participant_status as enum ('joined', 'in_progress', 'finished', 'dnf', 'invalidated');
create type gender_category as enum ('male', 'female');
create type performance_category as enum ('rx', 'scaled');
create type result_type as enum ('finished', 'dnf');
create type result_source as enum ('participant_click', 'coach_manual_adjustment', 'system_timeout');

-- 2. Tables

create table boxes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table admin_users (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references boxes(id),
  auth_user_id uuid not null unique,
  name text not null,
  email text not null unique,
  role admin_role not null,
  status record_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table daily_workouts (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references boxes(id),
  title text not null,
  description text,
  workout_type workout_type not null default 'for_time',
  time_cap_seconds integer not null check (time_cap_seconds > 0),
  finish_button_initial_lock_enabled boolean not null default false,
  finish_button_initial_lock_seconds integer not null check (finish_button_initial_lock_seconds in (0,5)),
  event_date date not null,
  status daily_workout_status not null default 'draft',
  created_by uuid not null references admin_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((finish_button_initial_lock_enabled = false and finish_button_initial_lock_seconds = 0) or 
         (finish_button_initial_lock_enabled = true and finish_button_initial_lock_seconds = 5))
);

create table class_sessions (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references boxes(id),
  daily_workout_id uuid not null references daily_workouts(id),
  name text not null,
  scheduled_start_at timestamptz,
  actual_start_at timestamptz,
  actual_end_at timestamptz,
  status session_status not null default 'waiting',
  join_code text not null unique,
  join_qr_payload text,
  created_by uuid not null references admin_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table session_participants (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references boxes(id),
  class_session_id uuid not null references class_sessions(id),
  display_name text not null check (char_length(trim(display_name)) > 0),
  gender_category gender_category not null,
  performance_category performance_category not null,
  status participant_status not null default 'joined',
  joined_at timestamptz not null default now(),
  device_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table session_results (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references boxes(id),
  class_session_id uuid not null references class_sessions(id),
  session_participant_id uuid not null references session_participants(id) unique,
  result_type result_type not null,
  finished_at timestamptz,
  elapsed_ms bigint,
  source result_source not null,
  is_manual_override boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((result_type = 'finished' and finished_at is not null and elapsed_ms is not null and elapsed_ms > 0) or 
         (result_type = 'dnf'))
);

create table result_adjustments (
  id uuid primary key default gen_random_uuid(),
  box_id uuid not null references boxes(id),
  class_session_id uuid not null references class_sessions(id),
  session_result_id uuid not null references session_results(id),
  adjusted_by uuid not null references admin_users(id),
  previous_result_snapshot jsonb not null,
  new_result_snapshot jsonb not null,
  reason text not null check (char_length(trim(reason)) > 0),
  created_at timestamptz not null default now()
);

-- 3. Indexes
create index idx_daily_workouts_box_date on daily_workouts(box_id, event_date);
create index idx_class_sessions_workout on class_sessions(daily_workout_id);
create index idx_class_sessions_code on class_sessions(join_code);
create index idx_session_participants_session on session_participants(class_session_id);
create index idx_session_results_participant on session_results(session_participant_id);
create index idx_session_results_session_type on session_results(class_session_id, result_type);
create index idx_session_results_session_time on session_results(class_session_id, elapsed_ms);

-- Optional/Secondary Indexes
create index idx_session_participants_categories on session_participants(class_session_id, performance_category, gender_category);
create index idx_result_adjustments_result on result_adjustments(session_result_id);

-- 4. updated_at triggers
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_boxes_updated_at before update on boxes for each row execute function update_updated_at_column();
create trigger update_admin_users_updated_at before update on admin_users for each row execute function update_updated_at_column();
create trigger update_daily_workouts_updated_at before update on daily_workouts for each row execute function update_updated_at_column();
create trigger update_class_sessions_updated_at before update on class_sessions for each row execute function update_updated_at_column();
create trigger update_session_participants_updated_at before update on session_participants for each row execute function update_updated_at_column();
create trigger update_session_results_updated_at before update on session_results for each row execute function update_updated_at_column();
