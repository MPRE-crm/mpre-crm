begin;

-- ============================================================
-- SAMANTHA CONTACT-ENRICHMENT REVIEW ACTIONS
-- ============================================================

create or replace function
  public.apply_contact_enrichment_review_action(
    p_review_id uuid,
    p_requester_id uuid,
    p_action text
  )
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  review_row record;
  requester_row record;

  normalized_action text;
  applied_value boolean := false;
  affected_rows integer := 0;

  next_review_status text;
  next_contact_status text;
begin
  normalized_action :=
    lower(
      btrim(
        coalesce(
          p_action,
          ''
        )
      )
    );

  if normalized_action not in (
    'approve',
    'reject',
    'ignore',
    'resolve'
  ) then
    raise exception
      'Review action is invalid.';
  end if;

  select
    review_item.id,
    review_item.org_id,
    review_item.owner_user_id,
    review_item.contact_id,
    review_item.realtor_match_id,
    review_item.issue_type,
    review_item.field_name,
    review_item.current_value,
    review_item.proposed_value,
    review_item.status
  into review_row
  from public.contact_enrichment_reviews
    as review_item
  where review_item.id =
    p_review_id
  for update;

  if not found then
    raise exception
      'Contact enrichment review was not found.';
  end if;

  select
    profile.id,
    profile.org_id,
    profile.role
  into requester_row
  from public.profiles
    as profile
  where profile.id =
    p_requester_id;

  if not found then
    raise exception
      'Requester profile was not found.';
  end if;

  if not (
    requester_row.role =
      'platform_admin'
    or (
      requester_row.org_id =
        review_row.org_id
      and requester_row.role in (
        'admin',
        'org_admin'
      )
    )
    or (
      requester_row.org_id =
        review_row.org_id
      and requester_row.role =
        'agent'
      and review_row.owner_user_id =
        requester_row.id
    )
  ) then
    raise exception
      'Requester cannot manage this contact enrichment review.';
  end if;

  if review_row.status <>
    'pending'
  then
    raise exception
      'This contact enrichment review is no longer pending.';
  end if;

  if normalized_action =
    'approve'
  then
    if review_row.contact_id
      is null
    then
      raise exception
        'This review cannot be approved automatically because it is not linked to a CRM contact.';
    end if;

    if nullif(
      btrim(
        coalesce(
          review_row.proposed_value,
          ''
        )
      ),
      ''
    ) is null
    then
      raise exception
        'This review does not contain a proposed value to approve.';
    end if;

    if review_row.field_name =
      'company'
    then
      update public.contacts
        as contact_row
      set
        company =
          review_row.proposed_value,

        last_enriched_at =
          now(),

        last_enrichment_source =
          'samantha_review_approved'
      where contact_row.id =
          review_row.contact_id
        and contact_row.org_id =
          review_row.org_id
        and contact_row.company
          is not distinct from
            review_row.current_value;

    elsif review_row.field_name =
      'phone'
    then
      update public.contacts
        as contact_row
      set
        phone =
          review_row.proposed_value,

        last_enriched_at =
          now(),

        last_enrichment_source =
          'samantha_review_approved'
      where contact_row.id =
          review_row.contact_id
        and contact_row.org_id =
          review_row.org_id
        and contact_row.phone
          is not distinct from
            review_row.current_value;

    elsif review_row.field_name =
      'mls_agent_id'
    then
      if exists (
        select 1
        from public.contacts
          as other_contact
        where other_contact.org_id =
            review_row.org_id
          and other_contact.id <>
            review_row.contact_id
          and other_contact.mls_agent_id =
            btrim(
              review_row.proposed_value
            )
      ) then
        raise exception
          'The proposed MLS user ID is already assigned to another CRM contact.';
      end if;

      update public.contacts
        as contact_row
      set
        mls_agent_id =
          review_row.proposed_value,

        last_enriched_at =
          now(),

        last_enrichment_source =
          'samantha_review_approved'
      where contact_row.id =
          review_row.contact_id
        and contact_row.org_id =
          review_row.org_id
        and contact_row.mls_agent_id
          is not distinct from
            review_row.current_value;

    elsif review_row.field_name =
      'mls_office_id'
    then
      update public.contacts
        as contact_row
      set
        mls_office_id =
          review_row.proposed_value,

        last_enriched_at =
          now(),

        last_enrichment_source =
          'samantha_review_approved'
      where contact_row.id =
          review_row.contact_id
        and contact_row.org_id =
          review_row.org_id
        and contact_row.mls_office_id
          is not distinct from
            review_row.current_value;

    elsif review_row.field_name =
      'license_number'
    then
      update public.contacts
        as contact_row
      set
        license_number =
          review_row.proposed_value,

        last_enriched_at =
          now(),

        last_enrichment_source =
          'samantha_review_approved'
      where contact_row.id =
          review_row.contact_id
        and contact_row.org_id =
          review_row.org_id
        and contact_row.license_number
          is not distinct from
            review_row.current_value;

    else
      raise exception
        'This review field cannot be approved automatically.';
    end if;

    get diagnostics
      affected_rows =
        row_count;

    if affected_rows <> 1 then
      raise exception
        'The CRM contact changed after this review was created. Refresh the review queue before approving it.';
    end if;

    applied_value :=
      true;

    next_review_status :=
      'approved';

  elsif normalized_action =
    'reject'
  then
    next_review_status :=
      'rejected';

  elsif normalized_action =
    'ignore'
  then
    next_review_status :=
      'ignored';

  else
    next_review_status :=
      'resolved';
  end if;

  update public.contact_enrichment_reviews
    as review_item
  set
    status =
      next_review_status,

    resolved_by =
      p_requester_id,

    resolved_at =
      now(),

    updated_at =
      now()
  where review_item.id =
    review_row.id;

  if review_row.contact_id
    is not null
  then
    if exists (
      select 1
      from public.contact_enrichment_reviews
        as remaining_review
      where remaining_review.contact_id =
          review_row.contact_id
        and remaining_review.status =
          'pending'
    ) then
      next_contact_status :=
        'needs_review';
    else
      next_contact_status :=
        'ready';
    end if;

    update public.contacts
      as contact_row
    set contact_review_status =
      next_contact_status
    where contact_row.id =
        review_row.contact_id
      and contact_row.org_id =
        review_row.org_id;
  end if;

  return jsonb_build_object(
    'review_id',
    review_row.id,

    'action',
    normalized_action,

    'status',
    next_review_status,

    'contact_id',
    review_row.contact_id,

    'contact_review_status',
    next_contact_status,

    'applied_value',
    applied_value
  );
end;
$$;

revoke all on function
  public.apply_contact_enrichment_review_action(
    uuid,
    uuid,
    text
  )
from public, anon, authenticated;

grant execute on function
  public.apply_contact_enrichment_review_action(
    uuid,
    uuid,
    text
  )
to service_role;

comment on function
  public.apply_contact_enrichment_review_action(
    uuid,
    uuid,
    text
  )
is
  'Atomically approves, rejects, ignores, or resolves a Samantha contact-enrichment review, applies only supported proposed values, rejects stale overwrites, and refreshes the contact review status.';

commit;