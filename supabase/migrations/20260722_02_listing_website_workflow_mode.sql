begin;

alter table public.listing_website_enrichment
  add column if not exists workflow_mode text
  not null
  default 'samantha_managed';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'listing_website_enrichment_workflow_mode_check'
  ) then
    alter table public.listing_website_enrichment
      add constraint listing_website_enrichment_workflow_mode_check
      check (
        workflow_mode in (
          'samantha_managed',
          'full_review'
        )
      );
  end if;
end
$$;

comment on column public.listing_website_enrichment.workflow_mode is
  'Controls whether the agent uses a concise Samantha-managed approval workflow or detailed full review.';

commit;
