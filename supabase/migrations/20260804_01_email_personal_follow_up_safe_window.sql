begin;

do $safe_window_patch$
declare
  function_sql text;
  patched_sql text;
  old_call_count integer;
begin
  if to_regprocedure(
    'public.register_email_personal_follow_up(uuid,uuid,timestamptz)'
  ) is null then
    raise exception
      'Preflight failed: register_email_personal_follow_up was not found.';
  end if;

  if to_regprocedure(
    'public.email_safe_send_at(timestamptz,text,integer,integer)'
  ) is null then
    raise exception
      'Preflight failed: email_safe_send_at was not found.';
  end if;

  function_sql :=
    pg_get_functiondef(
      'public.register_email_personal_follow_up(uuid,uuid,timestamptz)'::regprocedure
    );

  old_call_count :=
    regexp_count(
      function_sql,
      'public\.email_next_local_10am_at\('
    );

  if old_call_count > 1 then
    raise exception
      'Preflight failed: multiple local-10-AM calls were found.';
  end if;

  patched_sql :=
    function_sql;

  if old_call_count = 1 then
    patched_sql :=
      regexp_replace(
        patched_sql,
        'public\.email_next_local_10am_at\(\s*requested_send_at,\s*resolved_time_zone\s*\)',
        'public.email_safe_send_at(requested_send_at, resolved_time_zone, 8, 19)'
      );
  end if;

  patched_sql :=
    replace(
      patched_sql,
      '''recipient_local_10am''',
      '''delay_then_safe_window'''
    );

  patched_sql :=
    regexp_replace(
      patched_sql,
      '''send_local_hour'',\s*10',
      '''safe_start_hour'', 8, ''safe_end_hour'', 19',
      'g'
    );

  if patched_sql ~
    'email_next_local_10am_at'
  then
    raise exception
      'Patch failed: old local-10-AM call remains.';
  end if;

  if patched_sql !~
    'email_safe_send_at'
  then
    raise exception
      'Patch failed: safe-window call is missing.';
  end if;

  if patched_sql <> function_sql then
    execute patched_sql;
  end if;
end;
$safe_window_patch$;


with target_enrollments as (
  select
    enrollment.id,

    public.email_safe_send_at(
      (
        enrollment.metadata
          ->> 'requested_send_at'
      )::timestamptz,

      coalesce(
        nullif(
          btrim(
            enrollment.metadata
              ->> 'time_zone'
          ),
          ''
        ),
        'UTC'
      ),

      8,
      19
    ) as corrected_send_at

  from public.listing_email_sequence_enrollments
    as enrollment

  join public.listing_email_sequences
    as sequence
    on sequence.id =
      enrollment.sequence_id

  where sequence.settings
      ->> 'kind' =
        'personal_follow_up'

    and enrollment.status in (
      'queued',
      'active',
      'paused'
    )

    and enrollment.last_sent_at
      is null

    and enrollment.metadata
      ->> 'requested_send_at'
      is not null

    and coalesce(
      enrollment.metadata
        ->> 'send_time_policy',
      ''
    ) <>
      'delay_then_safe_window'
)

update public.listing_email_sequence_enrollments
  as enrollment

set
  next_send_at =
    target.corrected_send_at,

  metadata =
    (
      enrollment.metadata
      - 'send_local_hour'
    )
    || jsonb_build_object(
      'send_time_policy',
      'delay_then_safe_window',

      'safe_start_hour',
      8,

      'safe_end_hour',
      19,

      'scheduled_at',
      target.corrected_send_at
    ),

  updated_at =
    now()

from target_enrollments
  as target

where enrollment.id =
  target.id;

commit;