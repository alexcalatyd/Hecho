-- Del perfil solo se puede cambiar el nombre: ni el correo (podías poner el de otra persona) ni el color.
-- bootstrap() sigue escribiendo el correo real desde el token, porque es security definer.
revoke update on public.profiles from anon, authenticated;
grant update (name) on public.profiles to authenticated;
