-- Varias compartidas: puedes tener un espacio compartido distinto con cada persona.
-- Solo se puede crear uno nuevo si el último que creaste ya tiene a alguien dentro.

create or replace function public.create_shared_space()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid  uuid := auth.uid();
  last uuid;
  s    uuid;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select id into last from public.spaces
  where owner = uid and kind = 'shared'
  order by created_at desc limit 1;
  if last is not null and (select count(*) from public.space_members where space_id = last) <= 1 then
    raise exception 'last_alone';
  end if;
  insert into public.spaces (kind, owner) values ('shared', uid) returning id into s;
  insert into public.space_members (space_id, user_id) values (s, uid);
  return s;
end $$;

revoke execute on function public.create_shared_space() from anon;

-- Unirse ya no fusiona tus otras compartidas: solo borra las que estén vacías y sin nadie más
create or replace function public.join_space(c text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid  uuid := auth.uid();
  inv  public.invite_codes;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into inv from public.invite_codes
  where code = upper(regexp_replace(c, '[^A-Za-z0-9]', '', 'g')) and expires_at > now();
  if not found then raise exception 'invalid_code'; end if;

  if not exists (select 1 from public.space_members where space_id = inv.space_id and user_id = uid) then
    delete from public.spaces s
    where s.owner = uid and s.kind = 'shared' and s.id <> inv.space_id
      and (select count(*) from public.space_members x where x.space_id = s.id) = 1
      and not exists (select 1 from public.nodes n where n.space_id = s.id);
    insert into public.space_members (space_id, user_id) values (inv.space_id, uid);
  end if;

  delete from public.invite_codes where code = inv.code;
  return inv.space_id;
end $$;

revoke execute on function public.join_space(text) from anon;
