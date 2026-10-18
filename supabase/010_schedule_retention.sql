-- Migración 010: programa las tareas diarias de cierre y retención.
-- ANTES: en Supabase > Database > Extensions, activa "pg_cron".
-- Luego pega esto en el SQL Editor > Run. Corre todos los días a las 09:00 UTC (03:00 en Colima).

create extension if not exists pg_cron;

select cron.unschedule(jobid) from cron.job where jobname in ('close_finished_events', 'anonymize_old_guests');

select cron.schedule('close_finished_events', '0 9 * * *', $$ select public.close_finished_events(); $$);
select cron.schedule('anonymize_old_guests',  '10 9 * * *', $$ select public.anonymize_old_guests(); $$);

-- Para ver que quedaron programadas:   select jobname, schedule from cron.job;
-- Para ver ejecuciones recientes:      select * from cron.job_run_details order by start_time desc limit 10;
-- Para probar a mano:                  select public.close_finished_events();  select public.anonymize_old_guests();
