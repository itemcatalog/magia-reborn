-- =====================================================================
-- Libera o login da administradora.
-- ANTES: crie o usuário em Authentication → Users → Add user (marque "Auto Confirm User").
-- DEPOIS: troque o e-mail abaixo pelo MESMO e-mail do usuário e clique em Run.
-- =====================================================================
insert into public.admins (user_id)
select id from auth.users where email = 'COLOQUE_AQUI_O_EMAIL_DA_ADMINISTRADORA'
on conflict do nothing;

-- Deve mostrar 1. Se mostrar 0, o e-mail não confere com o usuário criado.
select count(*) as administradoras_liberadas from public.admins;
