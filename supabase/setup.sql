-- Familien-Wunschliste: Einrichtung der Datenbank in Supabase.
-- Einmal komplett im "SQL Editor" von Supabase ausführen. Mehrfaches Ausführen schadet nicht.
--
-- Sicherheitsprinzip: Die Tabellen sind von außen komplett gesperrt. Die App darf nur die
-- Funktionen am Ende aufrufen, und jede davon prüft zuerst den Familiencode.

-- ---------------------------------------------------------------------------
-- Tabellen
-- ---------------------------------------------------------------------------

create table if not exists public.wl_families (
  id   uuid primary key default gen_random_uuid(),
  code text not null unique check (char_length(code) >= 8),
  name text not null check (char_length(name) between 1 and 40)
);

create table if not exists public.wl_members (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references public.wl_families (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 30),
  created_at timestamptz not null default now()
);

create unique index if not exists wl_members_family_name
  on public.wl_members (family_id, lower(name));

create table if not exists public.wl_wishes (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.wl_members (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 120),
  url        text check (url is null or (char_length(url) <= 2000 and url ~* '^https?://')),
  price      numeric(10, 2) check (price is null or price >= 0),
  priority   smallint not null default 2 check (priority between 1 and 3),
  done       boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists wl_wishes_member on public.wl_wishes (member_id);

-- Row Level Security ohne Regeln = niemand kommt von außen direkt an die Tabellen.
alter table public.wl_families enable row level security;
alter table public.wl_members  enable row level security;
alter table public.wl_wishes   enable row level security;

revoke all on public.wl_families, public.wl_members, public.wl_wishes from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Funktionen
-- ---------------------------------------------------------------------------

-- Interne Hilfe: liefert die Familie zum Code oder bricht mit FALSCHER_CODE ab.
create or replace function public.wl_family_id(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from wl_families where code = p_code;
  if v_id is null then
    raise exception 'FALSCHER_CODE';
  end if;
  return v_id;
end;
$$;

-- Alles laden: Familienname, Mitglieder, Wünsche.
create or replace function public.wl_load(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fam uuid := wl_family_id(p_code);
begin
  return json_build_object(
    'family', (select name from wl_families where id = v_fam),
    'members', coalesce((
      select json_agg(json_build_object('id', m.id, 'name', m.name) order by m.created_at)
      from wl_members m
      where m.family_id = v_fam
    ), '[]'::json),
    'wishes', coalesce((
      select json_agg(json_build_object(
        'id', w.id, 'member_id', w.member_id, 'title', w.title, 'url', w.url,
        'price', w.price, 'priority', w.priority, 'done', w.done, 'created_at', w.created_at
      ) order by w.created_at)
      from wl_wishes w
      join wl_members m on m.id = w.member_id
      where m.family_id = v_fam
    ), '[]'::json)
  );
end;
$$;

-- Person anlegen. Gibt es den Namen schon, kommt die vorhandene Person zurück.
create or replace function public.wl_add_member(p_code text, p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fam  uuid := wl_family_id(p_code);
  v_name text := btrim(p_name);
  v_id   uuid;
begin
  select id into v_id from wl_members where family_id = v_fam and lower(name) = lower(v_name);
  if v_id is not null then
    return v_id;
  end if;
  if (select count(*) from wl_members where family_id = v_fam) >= 40 then
    raise exception 'Es sind schon 40 Personen eingetragen.';
  end if;
  insert into wl_members (family_id, name) values (v_fam, v_name) returning id into v_id;
  return v_id;
end;
$$;

-- Wunsch anlegen (p_id leer) oder ändern (p_id gesetzt).
create or replace function public.wl_save_wish(
  p_code text, p_id uuid, p_member uuid, p_title text, p_url text, p_price numeric, p_priority int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fam uuid := wl_family_id(p_code);
  v_id  uuid;
begin
  if p_id is null then
    if not exists (select 1 from wl_members where id = p_member and family_id = v_fam) then
      raise exception 'Diese Person gibt es nicht mehr.';
    end if;
    if (select count(*) from wl_wishes where member_id = p_member) >= 200 then
      raise exception 'Mehr als 200 Wünsche pro Person gehen nicht.';
    end if;
    insert into wl_wishes (member_id, title, url, price, priority)
    values (p_member, btrim(p_title), nullif(btrim(p_url), ''), p_price, p_priority)
    returning id into v_id;
  else
    update wl_wishes w
    set title = btrim(p_title), url = nullif(btrim(p_url), ''), price = p_price, priority = p_priority
    from wl_members m
    where w.id = p_id and m.id = w.member_id and m.family_id = v_fam
    returning w.id into v_id;
    if v_id is null then
      raise exception 'Diesen Wunsch gibt es nicht mehr.';
    end if;
  end if;
  return v_id;
end;
$$;

-- Wunsch als erfüllt markieren oder die Markierung zurücknehmen.
create or replace function public.wl_set_done(p_code text, p_id uuid, p_done boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fam uuid := wl_family_id(p_code);
begin
  update wl_wishes w
  set done = p_done
  from wl_members m
  where w.id = p_id and m.id = w.member_id and m.family_id = v_fam;
end;
$$;

-- Wunsch löschen.
create or replace function public.wl_delete_wish(p_code text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fam uuid := wl_family_id(p_code);
begin
  delete from wl_wishes w
  using wl_members m
  where w.id = p_id and m.id = w.member_id and m.family_id = v_fam;
end;
$$;

-- Die App (Rolle "anon") darf genau diese fünf Funktionen aufrufen, sonst nichts.
revoke execute on function public.wl_family_id(text) from public, anon, authenticated;
revoke execute on function
  public.wl_load(text),
  public.wl_add_member(text, text),
  public.wl_save_wish(text, uuid, uuid, text, text, numeric, int),
  public.wl_set_done(text, uuid, boolean),
  public.wl_delete_wish(text, uuid)
from public;
grant execute on function
  public.wl_load(text),
  public.wl_add_member(text, text),
  public.wl_save_wish(text, uuid, uuid, text, text, numeric, int),
  public.wl_set_done(text, uuid, boolean),
  public.wl_delete_wish(text, uuid)
to anon;

-- PostgREST (die Schnittstelle von Supabase) soll die neuen Funktionen sofort kennen.
notify pgrst, 'reload schema';
