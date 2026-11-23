-- Invitaciones por código en vez de por correo (no dependemos de enviar emails).
-- Un código por espacio, de un solo uso, caduca a los 7 días.

drop table if exists public.invites;

create table public.invite_codes (
  code       text primary key,
  space_id   uuid not null references public.spaces on delete cascade,
  created_by uuid references auth.users on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days'
);
create index invite_codes_space on public.invite_codes (space_id);

alter table public.invite_codes enable row level security;
create policy "ver códigos" on public.invite_codes for select using (public.is_member(space_id));
create policy "anular código" on public.invite_codes for delete using (public.is_member(space_id));

-- Genera (o renueva) el código de un espacio compartido del que soy miembro
create or replace function public.create_invite(s uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- sin 0/O/1/I para que no se confundan
  bytes    bytea := extensions.gen_random_bytes(8);
  c        text := '';
begin
  if not public.is_member(s) then raise exception 'not_member'; end if;
  if (select kind from public.spaces where id = s) <> 'shared' then raise exception 'not_shared'; end if;
  for i in 0..7 loop
    c := c || substr(alphabet, 1 + get_byte(bytes, i) % 32, 1);
  end loop;
  delete from public.invite_codes where space_id = s;
  insert into public.invite_codes (code, space_id) values (c, s);
  return c;
end $$;

-- Entra en un espacio con un código. Si tenía un compartido propio en el que estaba solo, fusiona su contenido.
create or replace function public.join_space(c text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid  uuid := auth.uid();
  inv  public.invite_codes;
  own  uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into inv from public.invite_codes
  where code = upper(regexp_replace(c, '[^A-Za-z0-9]', '', 'g')) and expires_at > now();
  if not found then raise exception 'invalid_code'; end if;

  if not exists (select 1 from public.space_members where space_id = inv.space_id and user_id = uid) then
    for own in
      select s.id from public.spaces s
      join public.space_members m on m.space_id = s.id and m.user_id = uid
      where s.kind = 'shared' and s.id <> inv.space_id
        and (select count(*) from public.space_members x where x.space_id = s.id) = 1
    loop
      update public.nodes set space_id = inv.space_id where space_id = own;
      update public.todos set space_id = inv.space_id where space_id = own;
      delete from public.spaces where id = own;
    end loop;
    insert into public.space_members (space_id, user_id) values (inv.space_id, uid);
  end if;

  delete from public.invite_codes where code = inv.code;
  return inv.space_id;
end $$;

revoke execute on function public.create_invite(uuid) from anon;
revoke execute on function public.join_space(text) from anon;

-- bootstrap sin invitaciones por correo
create or replace function public.bootstrap()
returns json language plpgsql security definer set search_path = '' as $$
declare
  uid      uuid := auth.uid();
  mail     text := lower(auth.jwt() ->> 'email');
  personal uuid;
  shared   uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  insert into public.profiles (id, email, name, color)
  values (
    uid, mail, split_part(mail, '@', 1),
    (array['#0A84FF','#FF9F0A','#30D158','#BF5AF2','#FF375F','#64D2FF','#FFD60A'])[1 + abs(hashtext(mail)) % 7]
  )
  on conflict (id) do update set email = excluded.email;

  select id into personal from public.spaces where owner = uid and kind = 'personal';
  if personal is null then
    insert into public.spaces (kind, owner) values ('personal', uid) returning id into personal;
    insert into public.space_members (space_id, user_id) values (personal, uid);
  end if;

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
