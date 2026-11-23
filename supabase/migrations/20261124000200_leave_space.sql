-- Salir de una compartida; si te quedas tú solo dentro, se elimina con todo su contenido.
-- No se puede dejar la última compartida que tengas.
create or replace function public.leave_space(s uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not public.is_member(s) then raise exception 'not_member'; end if;
  if (select kind from public.spaces where id = s) <> 'shared' then raise exception 'not_shared'; end if;
  if (select count(*) from public.space_members m join public.spaces x on x.id = m.space_id
      where m.user_id = uid and x.kind = 'shared') <= 1 then
    raise exception 'last_space';
  end if;
  delete from public.space_members where space_id = s and user_id = uid;
  if not exists (select 1 from public.space_members where space_id = s) then
    delete from public.spaces where id = s;
  end if;
end $$;

revoke execute on function public.leave_space(uuid) from anon;
