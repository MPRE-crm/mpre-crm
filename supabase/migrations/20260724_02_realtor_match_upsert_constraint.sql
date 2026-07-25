begin;

-- The first foundation migration created a partial unique index
-- for active Realtor matches. PostgREST/Supabase bulk upsert
-- cannot reliably infer that partial index through onConflict.
--
-- Keep one reusable match record for each listing, Realtor email
-- and source. A later import can update and reactivate that row.

do $$
begin
  if exists (
    select 1
    from public.listing_realtor_matches
    group by
      listing_id,
      agent_email_normalized,
      match_source
    having count(*) > 1
  ) then
    raise exception
      'Duplicate Realtor-match rows must be resolved before creating the upsert constraint.';
  end if;
end;
$$;

drop index if exists
  public.listing_realtor_matches_active_unique;

create unique index
  listing_realtor_matches_source_unique
on public.listing_realtor_matches (
  listing_id,
  agent_email_normalized,
  match_source
);

comment on index
  public.listing_realtor_matches_source_unique
is
  'Supports provider-neutral Realtor-match upserts by listing, normalized agent email and match source.';

commit;