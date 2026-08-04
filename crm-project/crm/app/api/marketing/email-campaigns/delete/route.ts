import { NextResponse } from 'next/server';

import {
  RequestAuthError,
  requireAuthenticatedProfile,
  requestErrorStatus,
} from '../../../../../lib/server/authenticatedProfile';

import {
  supabaseAdmin,
} from '../../../../../lib/supabaseAdmin';

export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';

type JsonRecord =
  Record<string, unknown>;

class CampaignDeleteError extends Error {
  status: number;
  code: string;

  constructor(
    message: string,
    status = 400,
    code = 'campaign_delete_error'
  ) {
    super(message);

    this.name =
      'CampaignDeleteError';

    this.status =
      status;

    this.code =
      code;
  }
}

function clean(
  value: unknown
): string {
  return typeof value === 'string'
    ? value.trim()
    : '';
}

function responseStatus(
  error: unknown
): number {
  if (
    error instanceof CampaignDeleteError
  ) {
    return error.status;
  }

  return requestErrorStatus(error);
}

function responseCode(
  error: unknown
): string {
  if (
    error instanceof CampaignDeleteError
  ) {
    return error.code;
  }

  if (
    error instanceof RequestAuthError
  ) {
    return 'authentication_error';
  }

  return 'unexpected_error';
}

export async function POST(
  request: Request
) {
  try {
    const profile =
      await requireAuthenticatedProfile(
        request
      );

    const body =
      await request
        .json()
        .catch(() => null) as
          | JsonRecord
          | null;

    const campaignId =
      clean(body?.campaign_id);

    if (!campaignId) {
      throw new CampaignDeleteError(
        'campaign_id is required.',
        400,
        'campaign_id_required'
      );
    }

    const {
      data: campaign,
      error: campaignError,
    } =
      await supabaseAdmin
        .from('email_campaigns')
        .select(`
          id,
          org_id,
          owner_user_id,
          status
        `)
        .eq('id', campaignId)
        .maybeSingle();

    if (
      campaignError ||
      !campaign
    ) {
      throw new CampaignDeleteError(
        campaignError?.message ||
          'Campaign was not found.',
        404,
        'campaign_not_found'
      );
    }

    const sameOrganization =
      profile.org_id ===
      campaign.org_id;

    const isAdministrator =
      profile.role ===
        'platform_admin' ||
      profile.role ===
        'admin' ||
      profile.role ===
        'org_admin';

    const ownsCampaign =
      campaign.owner_user_id ===
      profile.id;

    const canManage =
      profile.role ===
        'platform_admin' ||
      (
        sameOrganization &&
        (
          isAdministrator ||
          ownsCampaign
        )
      );

    if (!canManage) {
      throw new CampaignDeleteError(
        'You do not have access to this campaign.',
        403,
        'campaign_access_denied'
      );
    }

    if (
      campaign.status !== 'draft'
    ) {
      throw new CampaignDeleteError(
        'Only draft campaigns can be deleted. Campaigns with sending or delivery history must be retained.',
        409,
        'campaign_not_draft'
      );
    }

    const {
      data: recipients,
      error: recipientsError,
    } =
      await supabaseAdmin
        .from(
          'email_campaign_recipients'
        )
        .select(`
          id,
          status,
          send_attempts,
          sent_at,
          resend_email_id,
          scheduled_at,
          sequence_enrollment_id
        `)
        .eq(
          'campaign_id',
          campaign.id
        );

    if (recipientsError) {
      throw new CampaignDeleteError(
        recipientsError.message,
        500,
        'campaign_recipient_check_failed'
      );
    }

    const recipientRows =
      recipients || [];

    const hasProtectedActivity =
      recipientRows.some(
        (recipient) =>
          recipient.status !==
            'queued' ||
          Number(
            recipient.send_attempts || 0
          ) > 0 ||
          Boolean(recipient.sent_at) ||
          Boolean(
            recipient.resend_email_id
          ) ||
          Boolean(
            recipient.scheduled_at
          ) ||
          Boolean(
            recipient.sequence_enrollment_id
          )
      );

    if (hasProtectedActivity) {
      throw new CampaignDeleteError(
        'This draft has delivery, scheduling or Personal Follow-Up activity and cannot be deleted.',
        409,
        'campaign_activity_exists'
      );
    }

    const {
      data: deletedCampaign,
      error: deleteError,
    } =
      await supabaseAdmin
        .from('email_campaigns')
        .delete()
        .eq('id', campaign.id)
        .eq('status', 'draft')
        .select('id')
        .maybeSingle();

    if (
      deleteError ||
      !deletedCampaign
    ) {
      throw new CampaignDeleteError(
        deleteError?.message ||
          'The campaign changed before it could be deleted.',
        409,
        'campaign_delete_conflict'
      );
    }

    return NextResponse.json({
      ok: true,
      action: 'deleted',
      campaign_id:
        campaign.id,
      deleted_recipient_count:
        recipientRows.length,
    });
  }
  catch (error: unknown) {
    console.error(
      'campaign draft deletion error',
      error
    );

    return NextResponse.json(
      {
        ok: false,

        code:
          responseCode(error),

        error:
          error instanceof Error
            ? error.message
            : 'Campaign draft deletion failed.',
      },
      {
        status:
          responseStatus(error),
      }
    );
  }
}