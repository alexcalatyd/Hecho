-- Hecho · esquema inicial
-- Espacios (personal / compartido) con miembros, árbol de grupos y listas, tareas e invitaciones.

-- ---------------------------------------------------------------- tablas

create table public.profiles (
  id         uuid primary key references auth.users on delete cascade,
  email      text not null,
  name       text,
  color      text not null default '#0A84FF',
  created_at timestamptz not null default now()
);

create table public.spaces (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('personal', 'shared')),
  owner      uuid not null references auth.users on delete cascade default auth.uid(),
  created_at timestamptz not null default now()
);
create unique index spaces_one_personal on public.spaces (owner) where kind = 'personal';

create table public.space_members (
  space_id  uuid not null references public.spaces on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (space_id, user_id)
);
create index space_members_user on public.space_members (user_id);

create table public.nodes (
  id         uuid primary key,
  space_id   uuid not null references public.spaces on delete cascade,
  type       text not null check (type in ('group', 'list')),
  name       text not null,
  parent_id  uuid references public.nodes on delete cascade deferrable initially deferred,
  "order"    double precision,
  created_at bigint not null
);
create index nodes_space on public.nodes (space_id);

create table public.todos (
  id         uuid primary key,
  space_id   uuid not null references public.spaces on delete cascade,
  list_id    uuid not null references public.nodes on delete cascade deferrable initially deferred,
  text       text not null,
  done       boolean not null default false,
  priority   smallint not null default 0 check (priority between 0 and 3),
  created_at bigint not null,
  done_at    bigint,
  author     uuid references auth.users on delete set null default auth.uid()
);
create index todos_space on public.todos (space_id);
create index todos_list on public.todos (list_id);

create table public.invites (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references public.spaces on delete cascade,
  email      text not null check (email = lower(email)),
  invited_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  unique (space_id, email)
);

-- ---------------------------------------------------------------- helpers

create or replace function public.is_member(s uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.space_members m where m.space_id = s and m.user_id = auth.uid());
$$;

-- ---------------------------------------------------------------- RLS

alter table public.profiles      enable row level security;
alter table public.spaces        enable row level security;
alter table public.space_members enable row level security;
alter table public.nodes         enable row level security;
alter table public.todos         enable row level security;
alter table public.invites       enable row level security;

-- perfiles: el tuyo y los de quien comparte espacio contigo
create policy "ver perfiles" on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from public.space_members a join public.space_members b on a.space_id = b.space_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);
create policy "editar mi perfil" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy "ver mis espacios" on public.spaces for select using (public.is_member(id));

create policy "ver miembros" on public.space_members for select using (public.is_member(space_id));
create policy "salir de un espacio" on public.space_members for delete using (user_id = auth.uid());

create policy "nodos" on public.nodes for all using (public.is_member(space_id)) with check (public.is_member(space_id));
create policy "tareas" on public.todos for all using (public.is_member(space_id)) with check (public.is_member(space_id));

create policy "ver invitaciones" on public.invites for select using (public.is_member(space_id));
create policy "invitar" on public.invites for insert with check (public.is_member(space_id) and invited_by = auth.uid());
create policy "cancelar invitación" on public.invites for delete using (public.is_member(space_id));

-- ---------------------------------------------------------------- arranque de sesión
-- Crea perfil y espacios si faltan, acepta invitaciones pendientes y devuelve los ids.

create or replace function public.bootstrap()
returns json language plpgsql security definer set search_path = '' as $$
declare
  uid      uuid := auth.uid();
  mail     text := lower(auth.jwt() ->> 'email');
  personal uuid;
  shared   uuid;
  inv      record;
  own      uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  insert into public.profiles (id, email, name, color)
  values (
    uid, mail, split_part(mail, '@', 1),
    (array['#0A84FF','#FF9F0A','#30D158','#BF5AF2','#FF375F','#64D2FF','#FFD60A'])[1 + abs(hashtext(mail)) % 7]
  )
  on conflict (id) do update set email = excluded.email;

  -- espacio personal
  select id into personal from public.spaces where owner = uid and kind = 'personal';
  if personal is null then
    insert into public.spaces (kind, owner) values ('personal', uid) returning id into personal;
    insert into public.space_members (space_id, user_id) values (personal, uid);
  end if;

  -- invitaciones a mi correo
  for inv in select * from public.invites where email = mail loop
    if not exists (select 1 from public.space_members where space_id = inv.space_id and user_id = uid) then
      -- si tenía un espacio compartido propio en el que estaba solo, fusiona su contenido y lo borra
      for own in
        select s.id from public.spaces s
        where s.owner = uid and s.kind = 'shared' and s.id <> inv.space_id
          and (select count(*) from public.space_members m where m.space_id = s.id) = 1
      loop
        update public.nodes set space_id = inv.space_id where space_id = own;
        update public.todos set space_id = inv.space_id where space_id = own;
        delete from public.spaces where id = own;
      end loop;
      insert into public.space_members (space_id, user_id) values (inv.space_id, uid);
    end if;
    delete from public.invites where id = inv.id;
  end loop;

  -- espacio compartido: el que más miembros tenga; si no hay, uno nuevo
  select m.space_id into shared
  from public.space_members m join public.spaces s on s.id = m.space_id
  where m.user_id = uid and s.kind = 'shared'
  order by (select count(*) from public.space_members x where x.space_id = m.space_id) desc, m.joined_at
  limit 1;
  if shared is null then
    insert into public.spaces (kind, owner) values ('shared', uid) returning id into shared;
    insert into public.space_members (space_id, user_id) values (shared, uid);
  end if;

  return json_build_object('personal', personal, 'shared', shared);
end $$;

revoke execute on function public.bootstrap() from anon;

-- ---------------------------------------------------------------- tiempo real

alter table public.nodes replica identity full;
alter table public.todos replica identity full;
alter publication supabase_realtime add table public.nodes, public.todos, public.space_members, public.invites;
