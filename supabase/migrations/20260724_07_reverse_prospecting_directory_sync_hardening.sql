begin;

-- Preserve the existing directory-sync function as the internal base.
do $$
begin
  if to_regprocedure(
    'public.sync_reverse_prospecting_contact_directory_base(uuid,uuid)'
  ) is null then

    if to_regprocedure(
      'public.sync_reverse_prospecting_contact_directory(uuid,uuid)'
    ) is null then
      raise exception
        'The existing reverse-prospecting directory-sync function was not found.';
    end if;

    alter function
      public.sync_reverse_prospecting_contact_directory(
        uuid,
        uuid
      )
    rename to
      sync_reverse_prospecting_contact_directory_base;
  end if;
end;
$$;

-- Put the hardened wrapper at the original function name so the
-- existing application automatically uses it without a code change.
create or replace function
  public.sync_reverse_prospecting_contact_directory(
    p_batch_id uuid,
    p_requester_id uuid
  )
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  base_result jsonb;

  email_conflicts_reopened integer := 0;
  contact_statuses_refreshed integer := 0;
begin
  base_result :=
    public.sync_reverse_prospecting_contact_directory_base(
      p_batch_id,
      p_requester_id
    );

  -- The base function may resolve an email conflict merely because
  -- the Realtor match became linked. Reopen it unless that linked
  -- contact agrees with both the imported email and MLS user ID.
  update public.contact_enrichment_reviews
    as review_row
  set
    status =
      'pending',

    resolved_by =
      null,

    resolved_at =
      null,

    updated_at =
      now()
  from public.listing_realtor_matches
    as match_row
  left join public.contacts
    as contact_row
    on contact_row.id =
      match_row.contact_id
    and contact_row.org_id =
      match_row.org_id
  where review_row.realtor_match_id =
      match_row.id
    and match_row.batch_id =
      p_batch_id
    and review_row.issue_type =
      'email_conflict'
    and review_row.status =
      'resolved'
    and not (
      match_row.contact_id
        is not null

      and nullif(
        lower(
          btrim(
            coalesce(
              contact_row.email_normalized,
              ''
            )
          )
        ),
        ''
      ) is not null

      and nullif(
        lower(
          btrim(
            coalesce(
              match_row.agent_email_normalized,
              ''
            )
          )
        ),
        ''
      ) is not null

      and lower(
        btrim(
          contact_row.email_normalized
        )
      ) =
        lower(
          btrim(
            match_row.agent_email_normalized
          )
        )

      and nullif(
        btrim(
          coalesce(
            contact_row.mls_agent_id,
            ''
          )
        ),
        ''
      ) is not null

      and nullif(
        btrim(
          coalesce(
            match_row.external_agent_id,
            ''
          )
        ),
        ''
      ) is not null

      and btrim(
        contact_row.mls_agent_id
      ) =
        btrim(
          match_row.external_agent_id
        )
    );

  get diagnostics
    email_conflicts_reopened =
      row_count;

  -- Recalculate every linked contact from the actual live data.
  -- Missing brokerage, missing phone, or any pending review keeps
  -- the contact Directory Pending.
  update public.contacts
    as contact_row
  set contact_review_status =
    case
      when exists (
        select 1
        from public.contact_enrichment_reviews
          as review_row
        where review_row.contact_id =
            contact_row.id
          and review_row.status =
            'pending'
      )
      or nullif(
        btrim(
          coalesce(
            contact_row.company,
            ''
          )
        ),
        ''
      ) is null
      or nullif(
        btrim(
          coalesce(
            contact_row.phone,
            ''
          )
        ),
        ''
      ) is null
      then
        'needs_review'

      else
        'ready'
    end
  where exists (
    select 1
    from public.listing_realtor_matches
      as match_row
    where match_row.batch_id =
        p_batch_id
      and match_row.org_id =
        contact_row.org_id
      and match_row.contact_id =
        contact_row.id
      and match_row.is_active =
        true
  );

  get diagnostics
    contact_statuses_refreshed =
      row_count;

  return
    coalesce(
      base_result,
      '{}'::jsonb
    )
    ||
    jsonb_build_object(
      'email_conflicts_reopened',
        email_conflicts_reopened,

      'contact_statuses_refreshed',
        contact_statuses_refreshed,

      'directory_sync_hardened',
        true
    );
end;
$$;

-- Prevent application code from bypassing the hardened wrapper.
revoke all on function
  public.sync_reverse_prospecting_contact_directory_base(
    uuid,
    uuid
  )
from public, anon, authenticated, service_role;

revoke all on function
  public.sync_reverse_prospecting_contact_directory(
    uuid,
    uuid
  )
from public, anon, authenticated;

grant execute on function
  public.sync_reverse_prospecting_contact_directory(
    uuid,
    uuid
  )
to service_role;

comment on function
  public.sync_reverse_prospecting_contact_directory(
    uuid,
    uuid
  )
is
  'Runs the existing reverse-prospecting directory synchronization, reopens email conflicts unless the linked contact agrees with both email and MLS ID, and prevents incomplete contacts from becoming ready.';

commit;
