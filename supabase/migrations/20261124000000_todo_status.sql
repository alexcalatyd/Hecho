-- Estado de las tareas: sin empezar (por defecto) o en progreso.
-- Las completadas no tienen estado: al tacharlas vuelve a 'todo'.
alter table public.todos
  add column if not exists status text not null default 'todo' check (status in ('todo', 'doing'));
