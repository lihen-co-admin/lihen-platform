-- CONVERSATION-01 — Durable Conversation Persistence Foundation
--
-- Durable persistence only.
-- This migration does NOT authorize messaging, external API access,
-- inbound provider processing, automated replies, or external execution.

create table public.conversations (
  id uuid primary key,
  channel text not null,
  external_thread_ref text null,
  customer_id uuid null
    references public.customers(id)
    on delete restrict,
  order_id uuid null
    references public.orders(id)
    on delete restrict,
  status text not null,
  started_at timestamptz not null,
  last_activity_at timestamptz not null,

  constraint conversations_channel_check
    check (channel in (
      'WHATSAPP',
      'INSTAGRAM',
      'FACEBOOK',
      'TIKTOK',
      'WEB',
      'OTHER'
    )),

  constraint conversations_status_check
    check (status in (
      'OPEN',
      'WAITING_CUSTOMER',
      'WAITING_LIHEN',
      'RESOLVED',
      'CLOSED'
    )),

  constraint conversations_external_thread_ref_not_blank
    check (
      external_thread_ref is null
      or length(btrim(external_thread_ref)) > 0
    ),

  constraint conversations_activity_order_check
    check (last_activity_at >= started_at)
);

create table public.conversation_products (
  conversation_id uuid not null
    references public.conversations(id)
    on delete cascade,
  product_id uuid not null
    references public.products(id)
    on delete restrict,

  primary key (conversation_id, product_id)
);

create table public.conversation_messages (
  id uuid primary key,
  conversation_id uuid not null
    references public.conversations(id)
    on delete restrict,
  direction text not null,
  sender_role text not null,
  body text not null,
  occurred_at timestamptz not null,

  constraint conversation_messages_direction_check
    check (direction in (
      'INBOUND',
      'OUTBOUND'
    )),

  constraint conversation_messages_sender_role_check
    check (sender_role in (
      'CUSTOMER',
      'LIHEN',
      'SYSTEM'
    )),

  constraint conversation_messages_body_not_blank
    check (length(btrim(body)) > 0)
);

create index conversations_channel_idx
  on public.conversations(channel);

create index conversations_customer_idx
  on public.conversations(customer_id)
  where customer_id is not null;

create index conversations_order_idx
  on public.conversations(order_id)
  where order_id is not null;

create index conversations_status_idx
  on public.conversations(status);

create index conversations_last_activity_idx
  on public.conversations(last_activity_at);

create index conversation_products_product_idx
  on public.conversation_products(product_id);

create index conversation_messages_conversation_occurred_idx
  on public.conversation_messages(conversation_id, occurred_at);

alter table public.conversations
  enable row level security;

alter table public.conversation_products
  enable row level security;

alter table public.conversation_messages
  enable row level security;

comment on table public.conversations is
  'Durable LIHEN Conversation domain state. Persistence does not authorize messaging or external execution.';

comment on table public.conversation_products is
  'Durable relation between conversations and referenced products.';

comment on table public.conversation_messages is
  'Durable Conversation message history. OUTBOUND persistence does not mean sent and does not authorize external messaging.';
