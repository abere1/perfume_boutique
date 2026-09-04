create table if not exists public.perfumes (
  id text primary key,
  name text not null,
  brand text not null,
  gender text not null default 'unisex',
  category text not null default 'Eau de Parfum',
  size_ml integer not null default 0,
  price numeric not null default 0,
  stock text not null default 'in_stock',
  featured boolean not null default false,
  top_notes text not null default '',
  heart_notes text not null default '',
  base_notes text not null default '',
  description text not null default '',
  image text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.inquiries (
  id text primary key,
  name text not null,
  contact text not null,
  message text not null default '',
  perfume_id text,
  perfume_name text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.admin (
  username text primary key,
  password_hash text not null
);

create table if not exists public.sessions (
  sid text primary key,
  data jsonb not null,
  expires_at timestamptz not null
);

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = true;

alter table public.perfumes enable row level security;
alter table public.inquiries enable row level security;
alter table public.admin enable row level security;
