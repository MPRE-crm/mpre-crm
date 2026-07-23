begin;

alter table public.listing_media_ai_analysis
  add column if not exists label_source text not null
    default 'samantha'
    check (
      label_source in (
        'samantha',
        'user'
      )
    ),

  add column if not exists label_locked boolean not null
    default false,

  add column if not exists label_locked_by uuid
    references auth.users(id)
    on delete set null,

  add column if not exists label_locked_at timestamptz;

alter table public.listing_media_ai_analysis
  drop constraint if exists
    listing_media_ai_analysis_label_lock_check;

alter table public.listing_media_ai_analysis
  add constraint
    listing_media_ai_analysis_label_lock_check
  check (
    label_locked = false
    or label_source = 'user'
  );

create index if not exists
  listing_media_ai_analysis_label_idx
on public.listing_media_ai_analysis (
  listing_id,
  label_locked,
  primary_category
);

comment on column
  public.listing_media_ai_analysis.label_source
is
  'Whether the current photograph classification was assigned by Samantha or corrected by a CRM user.';

comment on column
  public.listing_media_ai_analysis.label_locked
is
  'Prevents Samantha from overwriting a classification that a CRM user has reviewed or corrected.';

comment on column
  public.listing_media_ai_analysis.label_locked_by
is
  'CRM user who locked the photograph classification.';

comment on column
  public.listing_media_ai_analysis.label_locked_at
is
  'Time the photograph classification was locked by a CRM user.';

commit;