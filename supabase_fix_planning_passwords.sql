set role postgres;

create table if not exists public.planning_state (
    id text primary key,
    label text not null
);

create unique index if not exists planning_state_id_key
    on public.planning_state (id);

insert into public.planning_state (id, label)
select 'planning_gardes_state_v080', 'Planning gardes v0.80'
where not exists (
    select 1
    from public.planning_state
    where id = 'planning_gardes_state_v080'
);

-- After ensuring the planning state exists, rerun any inserts into planning_passwords
-- that reference 'planning_gardes_state_v080'.

reset role;
