-- Toda tarea tiene prioridad: por defecto baja (1); ya no existe "sin prioridad" (0)
update public.todos set priority = 1 where priority = 0;
alter table public.todos alter column priority set default 1;
alter table public.todos drop constraint if exists todos_priority_check;
alter table public.todos add constraint todos_priority_check check (priority between 1 and 3);
