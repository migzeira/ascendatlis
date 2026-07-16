
-- 1) constraint de formato
alter table public.profiles
  add constraint username_format
  check (username ~ '^[a-z0-9_]{3,20}$');

-- 2) palavras reservadas (rotas do app)
alter table public.profiles
  add constraint username_not_reserved
  check (username not in (
    'admin','api','settings','dashboard','connect','onboarding',
    'p','login','auth','privacidade','termos'
  ));

-- 3) reescreve handle_new_user com loop insert+exception (spec canônica)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  reserved   constant text[] := array[
    'admin','api','settings','dashboard','connect','onboarding',
    'p','login','auth','privacidade','termos'
  ];
  raw_base   text;
  base_name  text;
  candidate  text;
  suffix     int := 0;
  attempts   int := 0;
  max_tries  constant int := 30;
begin
  raw_base := coalesce(
    nullif(new.raw_user_meta_data->>'username', ''),
    nullif(new.raw_user_meta_data->>'preferred_username', ''),
    'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
  );
  -- normaliza para [a-z0-9_] (spec §12; sem "." nem "-")
  base_name := lower(regexp_replace(raw_base, '[^a-z0-9_]', '', 'g'));

  -- garante limites 3..18 (deixa margem para o suffix)
  if length(base_name) > 18 then
    base_name := substr(base_name, 1, 18);
  end if;
  if length(base_name) < 3 or base_name = any(reserved) then
    base_name := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  candidate := base_name;

  loop
    begin
      insert into public.profiles (id, username, display_name, avatar_url)
      values (
        new.id,
        candidate,
        nullif(new.raw_user_meta_data->>'full_name', ''),
        nullif(new.raw_user_meta_data->>'avatar_url', '')
      );
      exit; -- sucesso
    exception
      when unique_violation then
        attempts := attempts + 1;
        if attempts >= max_tries then
          -- fallback determinístico a partir do uuid; garante 12 hex → válido no [a-z0-9_]{3,20}
          candidate := 'u_' || substr(replace(new.id::text, '-', ''), 1, 12);
          insert into public.profiles (id, username, display_name, avatar_url)
          values (
            new.id,
            candidate,
            nullif(new.raw_user_meta_data->>'full_name', ''),
            nullif(new.raw_user_meta_data->>'avatar_url', '')
          )
          on conflict (id) do nothing;
          exit;
        end if;
        suffix := suffix + 1;
        candidate := base_name || suffix::text;
        -- se ultrapassar 20 chars com o suffix, encurta o base
        if length(candidate) > 20 then
          base_name := substr(base_name, 1, greatest(3, 20 - length(suffix::text)));
          candidate := base_name || suffix::text;
        end if;
      when check_violation then
        -- ex.: base_name virou reservado após truncamento — vai pro fallback já
        candidate := 'u_' || substr(replace(new.id::text, '-', ''), 1, 12);
        insert into public.profiles (id, username, display_name, avatar_url)
        values (
          new.id, candidate,
          nullif(new.raw_user_meta_data->>'full_name', ''),
          nullif(new.raw_user_meta_data->>'avatar_url', '')
        )
        on conflict (id) do nothing;
        exit;
    end;
  end loop;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
