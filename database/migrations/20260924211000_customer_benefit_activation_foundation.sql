-- ============================================================
-- LIHEN CUSTOMER BENEFIT — ACTIVATION FOUNDATION
--
-- PHASE F2
--
-- Business rule frozen for LIHEN:
--   - validity = 20 LIHEN business days;
--   - Monday through Saturday can count;
--   - Sunday never counts;
--   - official national holidays in Colombia do not count;
--   - activation/send day DOES count when that date is a valid
--     LIHEN business day;
--   - if activation occurs on Sunday or an official holiday,
--     the first counted day is the next eligible LIHEN business day;
--   - timezone = America/Bogota.
--
-- Current scope:
--   GENERATED -> ACTIVE only.
--
-- Explicit non-goals:
--   - no redemption;
--   - no expiry transition;
--   - no automatic WhatsApp send;
--   - no Orders/Sales/Inventory/Finance mutation;
--   - no simultaneous-active-benefit uniqueness rule;
--   - no PROD apply.
-- ============================================================


-- ============================================================
-- 1. PRIVATE COLOMBIA HOLIDAY CALENDAR
--
-- The calendar is explicit and versioned instead of silently
-- assuming every weekday is valid.
--
-- Coverage is deliberately finite. Activation fails closed when
-- a date reaches a year that has not been reviewed/seeded.
-- ============================================================

create table if not exists
lihen_private.colombia_official_holidays (
  holiday_date date primary key,
  holiday_name text not null,
  source_reference text not null,
  created_at timestamptz not null default now(),

  constraint colombia_official_holidays_name_not_blank
    check (
      length(
        btrim(holiday_name)
      ) > 0
    ),

  constraint colombia_official_holidays_source_not_blank
    check (
      length(
        btrim(source_reference)
      ) > 0
    )
);


create table if not exists
lihen_private.colombia_holiday_calendar_coverage (
  calendar_year integer primary key,
  calendar_version text not null,
  source_reference text not null,
  reviewed_at date not null,

  constraint colombia_holiday_calendar_year_valid
    check (
      calendar_year between 2020 and 2100
    ),

  constraint colombia_holiday_calendar_version_not_blank
    check (
      length(
        btrim(calendar_version)
      ) > 0
    )
);


revoke all
on table
lihen_private.colombia_official_holidays,
lihen_private.colombia_holiday_calendar_coverage
from public, anon, authenticated, service_role;


-- ------------------------------------------------------------
-- Coverage V1
--
-- 2026 and 2027 are intentionally seeded now.
-- Future years require a reviewed migration before activation
-- can cross into them.
-- ------------------------------------------------------------

insert into
lihen_private.colombia_holiday_calendar_coverage(
  calendar_year,
  calendar_version,
  source_reference,
  reviewed_at
)
values
(
  2026,
  'CO-LIHEN-2026-V1',
  'Ley 51 de 1983 + Ley 2578 de 2026; reviewed for LIHEN business-day policy',
  date '2026-09-24'
),
(
  2027,
  'CO-LIHEN-2027-V1',
  'Ley 51 de 1983 + Ley 2578 de 2026; statutory holiday rules projected for 2027',
  date '2026-09-24'
)
on conflict (calendar_year)
do update
set
  calendar_version = excluded.calendar_version,
  source_reference = excluded.source_reference,
  reviewed_at = excluded.reviewed_at;


-- ------------------------------------------------------------
-- 2026 official national holidays used by LIHEN.
-- ------------------------------------------------------------

insert into
lihen_private.colombia_official_holidays(
  holiday_date,
  holiday_name,
  source_reference
)
values
(date '2026-01-01', 'Año Nuevo', 'Ley 51 de 1983'),
(date '2026-01-12', 'Reyes Magos', 'Ley 51 de 1983'),
(date '2026-03-23', 'San José', 'Ley 51 de 1983'),
(date '2026-04-02', 'Jueves Santo', 'Ley 51 de 1983'),
(date '2026-04-03', 'Viernes Santo', 'Ley 51 de 1983'),
(date '2026-05-01', 'Día del Trabajo', 'Ley 51 de 1983'),
(date '2026-05-18', 'Ascensión del Señor', 'Ley 51 de 1983'),
(date '2026-06-08', 'Corpus Christi', 'Ley 51 de 1983'),
(date '2026-06-15', 'Sagrado Corazón', 'Ley 51 de 1983'),
(date '2026-06-29', 'San Pedro y San Pablo', 'Ley 51 de 1983'),
(date '2026-07-09', 'Nuestra Señora del Rosario de Chiquinquirá', 'Ley 2578 de 2026'),
(date '2026-07-20', 'Independencia Nacional', 'Ley 51 de 1983'),
(date '2026-08-07', 'Batalla de Boyacá', 'Ley 51 de 1983'),
(date '2026-08-17', 'Asunción de la Virgen', 'Ley 51 de 1983'),
(date '2026-10-12', 'Día de la Raza', 'Ley 51 de 1983'),
(date '2026-11-02', 'Todos los Santos', 'Ley 51 de 1983'),
(date '2026-11-16', 'Independencia de Cartagena', 'Ley 51 de 1983'),
(date '2026-12-08', 'Inmaculada Concepción', 'Ley 51 de 1983'),
(date '2026-12-25', 'Navidad', 'Ley 51 de 1983'),

-- ------------------------------------------------------------
-- 2027 statutory national holidays used by LIHEN.
-- ------------------------------------------------------------

(date '2027-01-01', 'Año Nuevo', 'Ley 51 de 1983'),
(date '2027-01-11', 'Reyes Magos', 'Ley 51 de 1983'),
(date '2027-03-22', 'San José', 'Ley 51 de 1983'),
(date '2027-03-25', 'Jueves Santo', 'Ley 51 de 1983'),
(date '2027-03-26', 'Viernes Santo', 'Ley 51 de 1983'),
(date '2027-05-01', 'Día del Trabajo', 'Ley 51 de 1983'),
(date '2027-05-10', 'Ascensión del Señor', 'Ley 51 de 1983'),
(date '2027-05-31', 'Corpus Christi', 'Ley 51 de 1983'),
(date '2027-06-07', 'Sagrado Corazón', 'Ley 51 de 1983'),
(date '2027-07-05', 'San Pedro y San Pablo', 'Ley 51 de 1983'),
(date '2027-07-09', 'Nuestra Señora del Rosario de Chiquinquirá', 'Ley 2578 de 2026'),
(date '2027-07-20', 'Independencia Nacional', 'Ley 51 de 1983'),
(date '2027-08-07', 'Batalla de Boyacá', 'Ley 51 de 1983'),
(date '2027-08-16', 'Asunción de la Virgen', 'Ley 51 de 1983'),
(date '2027-10-18', 'Día de la Raza', 'Ley 51 de 1983'),
(date '2027-11-01', 'Todos los Santos', 'Ley 51 de 1983'),
(date '2027-11-15', 'Independencia de Cartagena', 'Ley 51 de 1983'),
(date '2027-12-08', 'Inmaculada Concepción', 'Ley 51 de 1983'),
(date '2027-12-25', 'Navidad', 'Ley 51 de 1983')
on conflict (holiday_date)
do update
set
  holiday_name = excluded.holiday_name,
  source_reference = excluded.source_reference;


-- ============================================================
-- 2. PRIVATE LIHEN BUSINESS-DAY FUNCTION
-- ============================================================

create or replace function
lihen_private.is_customer_benefit_business_day(
  p_date date
)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, lihen_private
as $function$
declare
  v_year integer;
begin
  if p_date is null then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_DATE_REQUIRED';
  end if;

  v_year :=
    extract(
      year
      from p_date
    )::integer;

  if not exists (
    select 1
    from
    lihen_private.colombia_holiday_calendar_coverage c
    where c.calendar_year = v_year
  ) then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_HOLIDAY_CALENDAR_YEAR_NOT_COVERED';
  end if;

  -- ISO day 7 = Sunday.
  if extract(
       isodow
       from p_date
     )::integer = 7 then
    return false;
  end if;

  if exists (
    select 1
    from lihen_private.colombia_official_holidays h
    where h.holiday_date = p_date
  ) then
    return false;
  end if;

  return true;
end;
$function$;


revoke all
on function
lihen_private.is_customer_benefit_business_day(date)
from public, anon, authenticated, service_role;


-- ============================================================
-- 3. PRIVATE 20-BUSINESS-DAY VALIDITY CALCULATOR
--
-- The activation/send calendar date is evaluated first.
-- If that date is a valid LIHEN business day, it is DAY 1.
--
-- valid_until is the final microsecond of the 20th eligible
-- calendar date in America/Bogota.
-- ============================================================

create or replace function
lihen_private.calculate_customer_benefit_valid_until(
  p_activation_at timestamptz,
  p_business_days integer default 20
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = pg_catalog, public, lihen_private
as $function$
declare
  v_date date;
  v_count integer := 0;
begin
  if p_activation_at is null then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_ACTIVATION_AT_REQUIRED';
  end if;

  if p_business_days is null
     or p_business_days <= 0
     or p_business_days > 366 then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_BUSINESS_DAYS_INVALID';
  end if;

  v_date :=
    (
      p_activation_at
      at time zone 'America/Bogota'
    )::date;

  loop

    if
      lihen_private.is_customer_benefit_business_day(
        v_date
      )
    then
      v_count := v_count + 1;

      if v_count = p_business_days then
        return (
          (
            v_date + 1
          )::timestamp
          at time zone 'America/Bogota'
        ) - interval '1 microsecond';
      end if;
    end if;

    v_date := v_date + 1;

  end loop;
end;
$function$;


revoke all
on function
lihen_private.calculate_customer_benefit_valid_until(
  timestamptz,
  integer
)
from public, anon, authenticated, service_role;


-- ============================================================
-- 4. CONTROLLED ACTIVATION RPC
--
-- GENERATED -> ACTIVE
--
-- Activation represents the moment the bonus is made available
-- for sending/sharing. UI wiring must call this at the actual
-- send/share step, not at draft generation.
-- ============================================================

create or replace function
public.activate_customer_benefit_controlled(
  p_operation_key text,
  p_benefit_id uuid
)
returns table(
  benefit_id uuid,
  customer_id uuid,
  benefit_code text,
  business_line text,
  benefit_type text,
  discount_percent numeric,
  status text,
  issued_at timestamptz,
  valid_from timestamptz,
  valid_until timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, lihen_private
as $function$
declare
  v_actor uuid := auth.uid();

  v_operation_key text;
  v_fingerprint text;

  v_existing
    lihen_private.customer_write_operations%rowtype;

  v_benefit public.customer_benefits%rowtype;
  v_activation_at timestamptz;
  v_valid_until timestamptz;
begin

  -- ----------------------------------------------------------
  -- Authentication / authorization
  -- ----------------------------------------------------------

  if v_actor is null then
    raise exception
      using
        errcode = '42501',
        message = 'LIHEN_AUTH_REQUIRED';
  end if;


  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.authorization_status = 'ACTIVE'
      and p.role_code in (
        'OWNER',
        'ADMIN'
      )
  ) then
    raise exception
      using
        errcode = '42501',
        message =
          'LIHEN_CUSTOMER_BENEFIT_ACTIVATE_FORBIDDEN';
  end if;


  -- ----------------------------------------------------------
  -- Input / idempotency
  -- ----------------------------------------------------------

  v_operation_key :=
    btrim(
      coalesce(
        p_operation_key,
        ''
      )
    );


  if v_operation_key = ''
     or p_benefit_id is null then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_ACTIVATE_FIELDS_REQUIRED';
  end if;


  v_fingerprint :=
    md5(
      concat_ws(
        '|',
        p_benefit_id::text,
        'ACTIVATE_CUSTOMER_BENEFIT',
        'CO_MON_SAT_EXCLUDE_SUNDAY_HOLIDAY',
        '20',
        'ACTIVATION_DAY_COUNTS_IF_ELIGIBLE',
        'America/Bogota'
      )
    );


  select *
  into v_existing
  from lihen_private.customer_write_operations o
  where o.operation_key = v_operation_key;


  if found then

    if v_existing.operation_type <>
         'ACTIVATE_CUSTOMER_BENEFIT'
       or v_existing.actor_id <> v_actor
       or v_existing.request_fingerprint
          is distinct from v_fingerprint then
      raise exception
        using
          errcode = '23505',
          message =
            'LIHEN_CUSTOMER_BENEFIT_OPERATION_CONFLICT';
    end if;


    return query
    select
      b.id,
      b.customer_id,
      b.benefit_code,
      b.business_line,
      b.benefit_type,
      b.discount_percent,
      b.status,
      b.issued_at,
      b.valid_from,
      b.valid_until
    from public.customer_benefits b
    where b.id = p_benefit_id;

    return;
  end if;


  perform pg_advisory_xact_lock(
    hashtextextended(
      p_benefit_id::text,
      0
    )
  );


  select *
  into v_existing
  from lihen_private.customer_write_operations o
  where o.operation_key = v_operation_key;


  if found then

    if v_existing.operation_type <>
         'ACTIVATE_CUSTOMER_BENEFIT'
       or v_existing.actor_id <> v_actor
       or v_existing.request_fingerprint
          is distinct from v_fingerprint then
      raise exception
        using
          errcode = '23505',
          message =
            'LIHEN_CUSTOMER_BENEFIT_OPERATION_CONFLICT';
    end if;


    return query
    select
      b.id,
      b.customer_id,
      b.benefit_code,
      b.business_line,
      b.benefit_type,
      b.discount_percent,
      b.status,
      b.issued_at,
      b.valid_from,
      b.valid_until
    from public.customer_benefits b
    where b.id = p_benefit_id;

    return;
  end if;


  -- ----------------------------------------------------------
  -- Lock / validate canonical benefit
  -- ----------------------------------------------------------

  select *
  into v_benefit
  from public.customer_benefits b
  where b.id = p_benefit_id
  for update;


  if not found then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_NOT_FOUND';
  end if;


  if v_benefit.status <> 'GENERATED' then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_NOT_GENERATED';
  end if;


  if not exists (
    select 1
    from public.customers c
    where c.id = v_benefit.customer_id
      and c.status = 'ACTIVE'
  ) then
    raise exception
      using
        errcode = '22023',
        message =
          'LIHEN_CUSTOMER_BENEFIT_CUSTOMER_INACTIVE';
  end if;


  -- ----------------------------------------------------------
  -- Activate
  -- ----------------------------------------------------------

  v_activation_at := clock_timestamp();

  v_valid_until :=
    lihen_private.calculate_customer_benefit_valid_until(
      v_activation_at,
      20
    );


  update public.customer_benefits b
  set
    status = 'ACTIVE',
    issued_at = v_activation_at,
    valid_from = v_activation_at,
    valid_until = v_valid_until,
    policy_snapshot =
      coalesce(
        b.policy_snapshot,
        '{}'::jsonb
      )
      ||
      jsonb_build_object(
        'activationBusinessDays',
        20,
        'activationDayCountsIfEligible',
        true,
        'businessWeek',
        'MONDAY_TO_SATURDAY',
        'sundayCounts',
        false,
        'colombiaOfficialHolidaysCount',
        false,
        'timezone',
        'America/Bogota',
        'holidayCalendarCoverage',
        jsonb_build_array(
          2026,
          2027
        )
      )
  where b.id = p_benefit_id
  returning *
  into v_benefit;


  insert into
  lihen_private.customer_write_operations(
    operation_key,
    operation_type,
    actor_id,
    customer_id,
    request_fingerprint,
    result_snapshot
  )
  values(
    v_operation_key,
    'ACTIVATE_CUSTOMER_BENEFIT',
    v_actor,
    v_benefit.customer_id,
    v_fingerprint,
    jsonb_build_object(
      'benefit_id',
      v_benefit.id,
      'benefit_code',
      v_benefit.benefit_code,
      'status',
      v_benefit.status,
      'issued_at',
      v_benefit.issued_at,
      'valid_from',
      v_benefit.valid_from,
      'valid_until',
      v_benefit.valid_until,
      'business_days',
      20,
      'activation_day_counts_if_eligible',
      true,
      'timezone',
      'America/Bogota'
    )
  );


  return query
  select
    v_benefit.id,
    v_benefit.customer_id,
    v_benefit.benefit_code,
    v_benefit.business_line,
    v_benefit.benefit_type,
    v_benefit.discount_percent,
    v_benefit.status,
    v_benefit.issued_at,
    v_benefit.valid_from,
    v_benefit.valid_until;

end;
$function$;


revoke all
on function
public.activate_customer_benefit_controlled(
  text,
  uuid
)
from public, anon, authenticated, service_role;


grant execute
on function
public.activate_customer_benefit_controlled(
  text,
  uuid
)
to authenticated;


comment on function
public.activate_customer_benefit_controlled(
  text,
  uuid
)
is
  'Controlled LIHEN Customer Benefit F2 activation. GENERATED -> ACTIVE. The activation/send day counts as day 1 when it is Monday-Saturday and not an official Colombia holiday. Sunday and official holidays never count. Validity is 20 LIHEN business days in America/Bogota.';


-- ============================================================
-- EXPLICIT NON-GOALS
-- ============================================================

-- NO:
-- - automatic WhatsApp send;
-- - automatic discount application;
-- - redemption;
-- - expiry transition;
-- - RETURN_AFTER_EXPIRED issuance;
-- - PURCHASE_THRESHOLD issuance;
-- - Orders mutation;
-- - Sales mutation;
-- - Inventory mutation;
-- - Finance mutation;
-- - PROD apply.
