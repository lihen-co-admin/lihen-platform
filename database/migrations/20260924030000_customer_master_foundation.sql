-- ============================================================
-- LIHEN CUSTOMER MASTER — PHASE 1 FOUNDATION
-- LOCAL MIGRATION FILE ONLY
--
-- IMPORTANT:
-- This migration is intentionally NOT applied by this task.
--
-- Scope:
--   - canonical Customer Master
--   - controlled create/update operations
--   - OWNER/ADMIN read access
--   - no direct client writes
--   - no Orders/Sales integration yet
--   - no Customer Benefits integration yet
-- ============================================================


-- ============================================================
-- 1. HUMAN CUSTOMER CODE
-- ============================================================

create sequence if not exists
  lihen_private.customer_code_seq
  as bigint
  start with 1
  increment by 1
  minvalue 1
  no maxvalue
  cache 1;


create or replace function
lihen_private.next_customer_code()
returns text
language sql
volatile
security definer
set search_path = pg_catalog, public, lihen_private
as $$
  select
    'CLI-' ||
    lpad(
      nextval(
        'lihen_private.customer_code_seq'
      )::text,
      6,
      '0'
    );
$$;


revoke all
on function lihen_private.next_customer_code()
from public, anon, authenticated;


-- ============================================================
-- 2. PHONE NORMALIZATION
--
-- Accepted:
--   3001234567
--   57 300 123 4567
--   +57 300 123 4567
--   explicit international numbers beginning with +
--
-- A Colombian mobile without country code receives 57.
-- Invalid/ambiguous values return null.
-- ============================================================

create or replace function
lihen_private.normalize_customer_phone(
  p_phone text
)
returns text
language plpgsql
immutable
set search_path = pg_catalog
as $$
declare
  v_raw text;
  v_digits text;
begin
  v_raw := btrim(coalesce(p_phone, ''));

  if v_raw = '' then
    return null;
  end if;

  v_digits :=
    regexp_replace(
      v_raw,
      '[^0-9]',
      '',
      'g'
    );

  -- Colombian mobile without country prefix.
  if v_digits ~ '^3[0-9]{9}$' then
    return '57' || v_digits;
  end if;

  -- Colombian mobile with country prefix.
  if v_digits ~ '^573[0-9]{9}$' then
    return v_digits;
  end if;

  -- Explicit international number.
  if left(v_raw, 1) = '+'
     and v_digits ~ '^[1-9][0-9]{7,14}$' then
    return v_digits;
  end if;

  return null;
end;
$$;


revoke all
on function
lihen_private.normalize_customer_phone(text)
from public, anon, authenticated;


-- ============================================================
-- 3. CUSTOMER MASTER
-- ============================================================

create table if not exists public.customers (
  id uuid
    primary key
    default gen_random_uuid(),

  customer_code text
    not null
    unique
    default lihen_private.next_customer_code(),

  full_name text
    not null,

  phone text
    not null,

  phone_normalized text
    not null,

  whatsapp_phone text
    null,

  address text
    null,

  city text
    null,

  neighborhood text
    null,

  email text
    null,

  notes text
    null,

  preferred_line text
    not null
    default 'UNKNOWN',

  status text
    not null
    default 'ACTIVE',

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint customers_customer_code_not_blank
    check (
      length(btrim(customer_code)) > 0
    ),

  constraint customers_full_name_not_blank
    check (
      length(btrim(full_name)) > 0
    ),

  constraint customers_phone_not_blank
    check (
      length(btrim(phone)) > 0
    ),

  constraint customers_phone_normalized_not_blank
    check (
      length(btrim(phone_normalized)) > 0
    ),

  constraint customers_preferred_line_valid
    check (
      preferred_line in (
        'BEAUTY_CARE',
        'STYLE',
        'MIXED',
        'UNKNOWN'
      )
    ),

  constraint customers_status_valid
    check (
      status in (
        'ACTIVE',
        'INACTIVE'
      )
    )
);


comment on table public.customers is
  'Canonical LIHEN Customer Master. Commercial transactions will reference this identity in later phases while preserving transaction snapshots.';


create index if not exists
  customers_full_name_search_idx
on public.customers (
  lower(full_name)
);


create index if not exists
  customers_phone_normalized_idx
on public.customers (
  phone_normalized
);


create index if not exists
  customers_status_idx
on public.customers (
  status
);


create index if not exists
  customers_created_at_idx
on public.customers (
  created_at desc
);


-- ============================================================
-- 4. PRIVATE CONTROLLED WRITE LEDGER
-- ============================================================

create table if not exists
lihen_private.customer_write_operations (
  operation_key text
    primary key,

  operation_type text
    not null,

  actor_id uuid
    not null,

  customer_id uuid
    not null,

  request_fingerprint text
    not null,

  result_snapshot jsonb
    null,

  created_at timestamptz
    not null
    default now(),

  constraint customer_write_operations_key_not_blank
    check (
      length(btrim(operation_key)) > 0
    ),

  constraint customer_write_operations_type_valid
    check (
      operation_type in (
        'CREATE_CUSTOMER',
        'UPDATE_CUSTOMER'
      )
    )
);


revoke all
on lihen_private.customer_write_operations
from public, anon, authenticated;


-- ============================================================
-- 5. RLS — READ ONLY THROUGH TABLE
-- ============================================================

alter table public.customers
  enable row level security;


revoke all
on public.customers
from anon, authenticated;


grant select
on public.customers
to authenticated;


drop policy if exists
  customers_owner_admin_read
on public.customers;


create policy
  customers_owner_admin_read
on public.customers
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.authorization_status = 'ACTIVE'
      and p.role_code in (
        'OWNER',
        'ADMIN'
      )
  )
);


-- ============================================================
-- 6. CREATE CUSTOMER CONTROLLED
-- ============================================================

create or replace function
public.create_customer_controlled(
  p_operation_key text,
  p_customer_id uuid,
  p_full_name text,
  p_phone text,
  p_whatsapp_phone text default null,
  p_address text default null,
  p_city text default null,
  p_neighborhood text default null,
  p_email text default null,
  p_notes text default null,
  p_preferred_line text default 'UNKNOWN',
  p_allow_shared_phone boolean default false
)
returns table(
  customer_id uuid,
  customer_code text,
  full_name text,
  phone text,
  phone_normalized text,
  status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, lihen_private
as $$
declare
  v_actor uuid := auth.uid();

  v_operation_key text;
  v_full_name text;
  v_phone text;
  v_phone_normalized text;
  v_whatsapp_phone text;
  v_preferred_line text;

  v_fingerprint text;

  v_existing
    lihen_private.customer_write_operations%rowtype;

  v_customer public.customers%rowtype;
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
        message = 'LIHEN_CUSTOMER_CREATE_FORBIDDEN';
  end if;


  -- ----------------------------------------------------------
  -- Normalize input
  -- ----------------------------------------------------------

  v_operation_key :=
    btrim(
      coalesce(
        p_operation_key,
        ''
      )
    );

  v_full_name :=
    btrim(
      coalesce(
        p_full_name,
        ''
      )
    );

  v_phone :=
    btrim(
      coalesce(
        p_phone,
        ''
      )
    );

  v_phone_normalized :=
    lihen_private.normalize_customer_phone(
      v_phone
    );

  v_whatsapp_phone :=
    nullif(
      btrim(
        coalesce(
          p_whatsapp_phone,
          ''
        )
      ),
      ''
    );

  v_preferred_line :=
    upper(
      btrim(
        coalesce(
          p_preferred_line,
          'UNKNOWN'
        )
      )
    );


  -- ----------------------------------------------------------
  -- Required values
  -- ----------------------------------------------------------

  if v_operation_key = ''
     or p_customer_id is null
     or v_full_name = ''
     or v_phone = '' then
    raise exception
      using
        errcode = '22023',
        message = 'LIHEN_CUSTOMER_FIELDS_REQUIRED';
  end if;


  if v_phone_normalized is null then
    raise exception
      using
        errcode = '22023',
        message = 'LIHEN_CUSTOMER_PHONE_INVALID';
  end if;


  if v_whatsapp_phone is not null
     and
     lihen_private.normalize_customer_phone(
       v_whatsapp_phone
     ) is null then
    raise exception
      using
        errcode = '22023',
        message = 'LIHEN_CUSTOMER_WHATSAPP_INVALID';
  end if;


  if v_preferred_line not in (
    'BEAUTY_CARE',
    'STYLE',
    'MIXED',
    'UNKNOWN'
  ) then
    raise exception
      using
        errcode = '22023',
        message = 'LIHEN_CUSTOMER_PREFERRED_LINE_INVALID';
  end if;


  -- ----------------------------------------------------------
  -- Idempotency fingerprint
  -- ----------------------------------------------------------

  v_fingerprint :=
    md5(
      concat_ws(
        '|',
        p_customer_id::text,
        v_full_name,
        v_phone_normalized,
        coalesce(
          lihen_private.normalize_customer_phone(
            v_whatsapp_phone
          ),
          ''
        ),
        coalesce(
          btrim(p_address),
          ''
        ),
        coalesce(
          btrim(p_city),
          ''
        ),
        coalesce(
          btrim(p_neighborhood),
          ''
        ),
        coalesce(
          lower(btrim(p_email)),
          ''
        ),
        coalesce(
          btrim(p_notes),
          ''
        ),
        v_preferred_line,
        coalesce(
          p_allow_shared_phone,
          false
        )::text
      )
    );


  select *
  into v_existing
  from lihen_private.customer_write_operations o
  where o.operation_key = v_operation_key;


  if found then

    if v_existing.operation_type <> 'CREATE_CUSTOMER'
       or v_existing.actor_id <> v_actor
       or v_existing.request_fingerprint
          is distinct from v_fingerprint then
      raise exception
        using
          errcode = '23505',
          message = 'LIHEN_CUSTOMER_OPERATION_CONFLICT';
    end if;


    return query
    select
      c.id,
      c.customer_code,
      c.full_name,
      c.phone,
      c.phone_normalized,
      c.status
    from public.customers c
    where c.id = v_existing.customer_id;

    return;
  end if;


  -- ----------------------------------------------------------
  -- Serialize duplicate detection by normalized phone.
  --
  -- This avoids concurrent accidental duplicates without
  -- introducing a permanent UNIQUE constraint that would make
  -- future human-reviewed shared-number cases impossible.
  -- ----------------------------------------------------------

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_phone_normalized,
      0
    )
  );


  if not coalesce(
       p_allow_shared_phone,
       false
     )
     and exists (
       select 1
       from public.customers c
       where c.phone_normalized =
         v_phone_normalized
     ) then
    raise exception
      using
        errcode = '23505',
        message =
          'LIHEN_CUSTOMER_PHONE_ALREADY_EXISTS';
  end if;


  -- ----------------------------------------------------------
  -- Create
  -- ----------------------------------------------------------

  insert into public.customers(
    id,
    full_name,
    phone,
    phone_normalized,
    whatsapp_phone,
    address,
    city,
    neighborhood,
    email,
    notes,
    preferred_line,
    status
  )
  values(
    p_customer_id,
    v_full_name,
    v_phone,
    v_phone_normalized,
    case
      when v_whatsapp_phone is null
        then null
      else
        lihen_private.normalize_customer_phone(
          v_whatsapp_phone
        )
    end,
    nullif(
      btrim(
        coalesce(
          p_address,
          ''
        )
      ),
      ''
    ),
    nullif(
      btrim(
        coalesce(
          p_city,
          ''
        )
      ),
      ''
    ),
    nullif(
      btrim(
        coalesce(
          p_neighborhood,
          ''
        )
      ),
      ''
    ),
    nullif(
      lower(
        btrim(
          coalesce(
            p_email,
            ''
          )
        )
      ),
      ''
    ),
    nullif(
      btrim(
        coalesce(
          p_notes,
          ''
        )
      ),
      ''
    ),
    v_preferred_line,
    'ACTIVE'
  )
  returning *
  into v_customer;


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
    'CREATE_CUSTOMER',
    v_actor,
    v_customer.id,
    v_fingerprint,
    jsonb_build_object(
      'id',
      v_customer.id,
      'customer_code',
      v_customer.customer_code,
      'full_name',
      v_customer.full_name,
      'phone_normalized',
      v_customer.phone_normalized,
      'shared_phone_override',
      coalesce(
        p_allow_shared_phone,
        false
      ),
      'status',
      v_customer.status
    )
  );


  return query
  select
    v_customer.id,
    v_customer.customer_code,
    v_customer.full_name,
    v_customer.phone,
    v_customer.phone_normalized,
    v_customer.status;

end;
$$;


revoke all
on function
public.create_customer_controlled(
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
)
from public, anon;


grant execute
on function
public.create_customer_controlled(
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
)
to authenticated, service_role;


-- ============================================================
-- 7. UPDATE CUSTOMER CONTROLLED
-- ============================================================

create or replace function
public.update_customer_controlled(
  p_operation_key text,
  p_customer_id uuid,
  p_full_name text,
  p_phone text,
  p_whatsapp_phone text,
  p_address text,
  p_city text,
  p_neighborhood text,
  p_email text,
  p_notes text,
  p_preferred_line text,
  p_status text,
  p_allow_shared_phone boolean default false
)
returns table(
  customer_id uuid,
  customer_code text,
  full_name text,
  phone text,
  phone_normalized text,
  status text
)
language plpgsql
security definer
set search_path = pg_catalog, public, lihen_private
as $$
declare
  v_actor uuid := auth.uid();

  v_operation_key text;
  v_full_name text;
  v_phone text;
  v_phone_normalized text;
  v_whatsapp_phone text;
  v_preferred_line text;
  v_status text;

  v_fingerprint text;

  v_existing
    lihen_private.customer_write_operations%rowtype;

  v_customer public.customers%rowtype;
begin

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
        message = 'LIHEN_CUSTOMER_UPDATE_FORBIDDEN';
  end if;


  v_operation_key :=
    btrim(
      coalesce(
        p_operation_key,
        ''
      )
    );

  v_full_name :=
    btrim(
      coalesce(
        p_full_name,
        ''
      )
    );

  v_phone :=
    btrim(
      coalesce(
        p_phone,
        ''
      )
    );

  v_phone_normalized :=
    lihen_private.normalize_customer_phone(
      v_phone
    );

  v_whatsapp_phone :=
    nullif(
      btrim(
        coalesce(
          p_whatsapp_phone,
          ''
        )
      ),
      ''
    );

  v_preferred_line :=
    upper(
      btrim(
        coalesce(
          p_preferred_line,
          ''
        )
      )
    );

  v_status :=
    upper(
      btrim(
        coalesce(
          p_status,
          ''
        )
      )
    );


  if v_operation_key = ''
     or p_customer_id is null
     or v_full_name = ''
     or v_phone = '' then
    raise exception
      using
        errcode = '22023',
        message = 'LIHEN_CUSTOMER_FIELDS_REQUIRED';
  end if;


  if v_phone_normalized is null then
    raise exception
      using
        errcode = '22023',
        message = 'LIHEN_CUSTOMER_PHONE_INVALID';
  end if;


  if v_whatsapp_phone is not null
     and
     lihen_private.normalize_customer_phone(
       v_whatsapp_phone
     ) is null then
    raise exception
      using
        errcode = '22023',
        message = 'LIHEN_CUSTOMER_WHATSAPP_INVALID';
  end if;


  if v_preferred_line not in (
    'BEAUTY_CARE',
    'STYLE',
    'MIXED',
    'UNKNOWN'
  ) then
    raise exception
      using
        errcode = '22023',
        message = 'LIHEN_CUSTOMER_PREFERRED_LINE_INVALID';
  end if;


  if v_status not in (
    'ACTIVE',
    'INACTIVE'
  ) then
    raise exception
      using
        errcode = '22023',
        message = 'LIHEN_CUSTOMER_STATUS_INVALID';
  end if;


  if not exists (
    select 1
    from public.customers c
    where c.id = p_customer_id
  ) then
    raise exception
      using
        errcode = 'P0002',
        message = 'LIHEN_CUSTOMER_NOT_FOUND';
  end if;


  v_fingerprint :=
    md5(
      concat_ws(
        '|',
        p_customer_id::text,
        v_full_name,
        v_phone_normalized,
        coalesce(
          lihen_private.normalize_customer_phone(
            v_whatsapp_phone
          ),
          ''
        ),
        coalesce(
          btrim(p_address),
          ''
        ),
        coalesce(
          btrim(p_city),
          ''
        ),
        coalesce(
          btrim(p_neighborhood),
          ''
        ),
        coalesce(
          lower(btrim(p_email)),
          ''
        ),
        coalesce(
          btrim(p_notes),
          ''
        ),
        v_preferred_line,
        v_status,
        coalesce(
          p_allow_shared_phone,
          false
        )::text
      )
    );


  select *
  into v_existing
  from lihen_private.customer_write_operations o
  where o.operation_key = v_operation_key;


  if found then

    if v_existing.operation_type <> 'UPDATE_CUSTOMER'
       or v_existing.actor_id <> v_actor
       or v_existing.customer_id <> p_customer_id
       or v_existing.request_fingerprint
          is distinct from v_fingerprint then
      raise exception
        using
          errcode = '23505',
          message = 'LIHEN_CUSTOMER_OPERATION_CONFLICT';
    end if;


    return query
    select
      c.id,
      c.customer_code,
      c.full_name,
      c.phone,
      c.phone_normalized,
      c.status
    from public.customers c
    where c.id = p_customer_id;

    return;
  end if;


  perform pg_advisory_xact_lock(
    hashtextextended(
      v_phone_normalized,
      0
    )
  );


  if not coalesce(
       p_allow_shared_phone,
       false
     )
     and exists (
       select 1
       from public.customers c
       where c.phone_normalized =
         v_phone_normalized
         and c.id <> p_customer_id
     ) then
    raise exception
      using
        errcode = '23505',
        message =
          'LIHEN_CUSTOMER_PHONE_ALREADY_EXISTS';
  end if;


  update public.customers c
  set
    full_name = v_full_name,

    phone = v_phone,

    phone_normalized =
      v_phone_normalized,

    whatsapp_phone =
      case
        when v_whatsapp_phone is null
          then null
        else
          lihen_private.normalize_customer_phone(
            v_whatsapp_phone
          )
      end,

    address =
      nullif(
        btrim(
          coalesce(
            p_address,
            ''
          )
        ),
        ''
      ),

    city =
      nullif(
        btrim(
          coalesce(
            p_city,
            ''
          )
        ),
        ''
      ),

    neighborhood =
      nullif(
        btrim(
          coalesce(
            p_neighborhood,
            ''
          )
        ),
        ''
      ),

    email =
      nullif(
        lower(
          btrim(
            coalesce(
              p_email,
              ''
            )
          )
        ),
        ''
      ),

    notes =
      nullif(
        btrim(
          coalesce(
            p_notes,
            ''
          )
        ),
        ''
      ),

    preferred_line =
      v_preferred_line,

    status =
      v_status,

    updated_at =
      now()

  where c.id =
    p_customer_id

  returning *
  into v_customer;


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
    'UPDATE_CUSTOMER',
    v_actor,
    v_customer.id,
    v_fingerprint,
    jsonb_build_object(
      'id',
      v_customer.id,
      'customer_code',
      v_customer.customer_code,
      'full_name',
      v_customer.full_name,
      'phone_normalized',
      v_customer.phone_normalized,
      'preferred_line',
      v_customer.preferred_line,
      'shared_phone_override',
      coalesce(
        p_allow_shared_phone,
        false
      ),
      'status',
      v_customer.status
    )
  );


  return query
  select
    v_customer.id,
    v_customer.customer_code,
    v_customer.full_name,
    v_customer.phone,
    v_customer.phone_normalized,
    v_customer.status;

end;
$$;


revoke all
on function
public.update_customer_controlled(
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
)
from public, anon;


grant execute
on function
public.update_customer_controlled(
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
)
to authenticated, service_role;


-- ============================================================
-- 8. EXPLICIT CONTRACT
-- ============================================================

comment on function
public.create_customer_controlled(
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
)
is
  'Controlled Customer Master creation. OWNER/ADMIN only. Idempotent by operation_key. Duplicate normalized phone is blocked by default and only allowed through an explicit audited shared-phone override. No Orders, Sales, Inventory or Finance mutation.';


comment on function
public.update_customer_controlled(
  text,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  boolean
)
is
  'Controlled Customer Master update. OWNER/ADMIN only. Customer identity code is immutable. Duplicate normalized phone is blocked by default and only allowed through an explicit audited shared-phone override. No hard delete and no commercial mutation.';


comment on table
lihen_private.customer_write_operations
is
  'Private idempotency/audit ledger for Customer Master controlled writes. Audit timeline integration is intentionally deferred until the existing operational audit mapping is extended safely.';
