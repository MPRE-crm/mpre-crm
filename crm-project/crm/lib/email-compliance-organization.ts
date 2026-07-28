import 'server-only';

import {
  supabaseAdmin,
} from './supabaseAdmin';

type EmailComplianceTokenColumn =
  | 'preferences_token'
  | 'unsubscribe_token';

type LoadOrganizationDisplayArgs = {
  token: string;
  tokenColumn: EmailComplianceTokenColumn;
};

function cleanOrganizationLabel(
  value: unknown
): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const cleaned =
    value.trim();

  return cleaned || null;
}

export async function loadEmailComplianceOrganizationDisplay({
  token,
  tokenColumn,
}: LoadOrganizationDisplayArgs): Promise<string> {
  const {
    data: recipient,
    error: recipientError,
  } =
    await supabaseAdmin
      .from('email_campaign_recipients')
      .select('campaign_id')
      .eq(tokenColumn, token)
      .maybeSingle();

  if (
    recipientError ||
    !recipient?.campaign_id
  ) {
    return 'MPRE';
  }

  const {
    data: campaign,
    error: campaignError,
  } =
    await supabaseAdmin
      .from('email_campaigns')
      .select('org_id')
      .eq(
        'id',
        recipient.campaign_id
      )
      .maybeSingle();

  if (
    campaignError ||
    !campaign?.org_id
  ) {
    return 'MPRE';
  }

  const {
    data: organization,
    error: organizationError,
  } =
    await supabaseAdmin
      .from('organizations')
      .select('org_display, name')
      .eq(
        'id',
        campaign.org_id
      )
      .maybeSingle();

  if (
    organizationError ||
    !organization
  ) {
    return 'MPRE';
  }

  return (
    cleanOrganizationLabel(
      organization.org_display
    ) ||
    cleanOrganizationLabel(
      organization.name
    ) ||
    'MPRE'
  );
}
