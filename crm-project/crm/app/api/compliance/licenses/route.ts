import {
  NextResponse,
} from 'next/server';

import {
  RequestAuthError,
  requireAuthenticatedProfile,
  requestErrorStatus,
} from '../../../../lib/server/authenticatedProfile';

import {
  supabaseAdmin,
} from '../../../../lib/supabaseAdmin';

export const dynamic =
  'force-dynamic';

export const runtime =
  'nodejs';

class ComplianceLicenseError extends Error {
  status: number;
  missingFields: string[];

  constructor(
    message: string,
    status = 400,
    missingFields: string[] = []
  ) {
    super(message);
    this.name =
      'ComplianceLicenseError';
    this.status = status;
    this.missingFields =
      missingFields;
  }
}

function jsonError(
  error: unknown
) {
  const message =
    error instanceof Error
      ? error.message
      : 'The compliance-license request failed.';

  const status =
    error instanceof ComplianceLicenseError
      ? error.status
      : requestErrorStatus(
          error
        );

  const missingFields =
    error instanceof ComplianceLicenseError
      ? error.missingFields
      : [];

  return NextResponse.json(
    {
      ok: false,
      error: message,
      missing_fields:
        missingFields,
    },
    {
      status,
      headers: {
        'Cache-Control':
          'no-store',
      },
    }
  );
}

function textValue(
  value: unknown,
  maxLength = 2000
) {
  return String(
    value ?? ''
  )
    .trim()
    .slice(
      0,
      maxLength
    );
}

function nullableText(
  value: unknown,
  maxLength = 2000
) {
  const valueText =
    textValue(
      value,
      maxLength
    );

  return valueText || null;
}

function nullableDate(
  value: unknown
) {
  const valueText =
    textValue(
      value,
      10
    );

  if (!valueText) {
    return null;
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      valueText
    )
  ) {
    throw new ComplianceLicenseError(
      'Dates must use YYYY-MM-DD format.'
    );
  }

  return valueText;
}

function normalizedStatus(
  value: unknown
) {
  return textValue(
    value,
    100
  ).toLowerCase();
}

function isPastDate(
  value: string | null
) {
  if (!value) {
    return false;
  }

  const date = new Date(
    `${value}T23:59:59`
  );

  return (
    !Number.isNaN(
      date.getTime()
    ) &&
    date.getTime() <
      Date.now()
  );
}

function daysUntilDate(
  value: string | null
) {
  if (!value) {
    return null;
  }

  const date = new Date(
    `${value}T23:59:59`
  );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return Math.ceil(
    (
      date.getTime() -
      Date.now()
    ) /
      86400000
  );
}

function statusCanBeVerified(
  value: unknown
) {
  return [
    'active',
    'approved',
    'verified',
  ].includes(
    normalizedStatus(
      value
    )
  );
}

function validHttpUrl(
  value: string | null
) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(
      value
    );

    return [
      'http:',
      'https:',
    ].includes(
      url.protocol
    );
  }
  catch {
    return false;
  }
}

function requireId(
  value: unknown,
  label: string
) {
  const id = textValue(
    value,
    100
  );

  if (!id) {
    throw new ComplianceLicenseError(
      `${label} is required.`
    );
  }

  return id;
}

async function requirePlatformAdmin(
  request: Request
) {
  const profile =
    await requireAuthenticatedProfile(
      request
    );

  if (
    profile.role !==
    'platform_admin'
  ) {
    throw new RequestAuthError(
      'Platform-admin access is required.',
      403
    );
  }

  return profile;
}

function organizationMissingFields(
  license: Record<
    string,
    unknown
  >
) {
  const missingFields:
    string[] = [];

  if (
    !textValue(
      license.licensed_business_name
    )
  ) {
    missingFields.push(
      'Licensed business name'
    );
  }

  if (
    !textValue(
      license.brokerage_license_number
    )
  ) {
    missingFields.push(
      'Brokerage license number'
    );
  }

  if (
    !textValue(
      license.license_type
    )
  ) {
    missingFields.push(
      'License type'
    );
  }

  if (
    !textValue(
      license.responsible_broker_name
    )
  ) {
    missingFields.push(
      'Responsible broker'
    );
  }

  if (
    !textValue(
      license.responsible_broker_license_number
    )
  ) {
    missingFields.push(
      'Responsible broker license'
    );
  }

  if (
    !textValue(
      license.office_phone
    )
  ) {
    missingFields.push(
      'Office phone'
    );
  }

  if (
    !textValue(
      license.office_address
    )
  ) {
    missingFields.push(
      'Office address'
    );
  }

  if (
    !textValue(
      license.compliance_mailing_address
    )
  ) {
    missingFields.push(
      'Compliance mailing address'
    );
  }

  if (
    !textValue(
      license.issue_date
    )
  ) {
    missingFields.push(
      'Issue date'
    );
  }

  if (
    !textValue(
      license.expiration_date
    )
  ) {
    missingFields.push(
      'Expiration date'
    );
  }

  if (
    !textValue(
      license.regulator_source_url
    )
  ) {
    missingFields.push(
      'Regulator source'
    );
  }

  return missingFields;
}

function profileMissingFields(
  license: Record<
    string,
    unknown
  >
) {
  const missingFields:
    string[] = [];

  if (
    !textValue(
      license.license_type
    )
  ) {
    missingFields.push(
      'License type'
    );
  }

  if (
    !textValue(
      license.license_number
    )
  ) {
    missingFields.push(
      'License number'
    );
  }

  if (
    !textValue(
      license.issue_date
    )
  ) {
    missingFields.push(
      'Issue date'
    );
  }

  if (
    !textValue(
      license.expiration_date
    )
  ) {
    missingFields.push(
      'Expiration date'
    );
  }

  if (
    !textValue(
      license.supervising_broker_name
    )
  ) {
    missingFields.push(
      'Supervising broker'
    );
  }

  if (
    !textValue(
      license.supervising_broker_license_number
    )
  ) {
    missingFields.push(
      'Supervising broker license'
    );
  }

  if (
    !textValue(
      license.regulator_source_url
    )
  ) {
    missingFields.push(
      'Regulator source'
    );
  }

  if (
    !textValue(
      license.verification_source
    )
  ) {
    missingFields.push(
      'Verification source'
    );
  }

  if (
    license.is_primary !==
    true
  ) {
    missingFields.push(
      'Primary license designation'
    );
  }

  return missingFields;
}

function assertVerificationReady(
  kind:
    | 'organization'
    | 'profile',
  payload: Record<
    string,
    unknown
  >
) {
  const missingFields =
    kind ===
      'organization'
      ? organizationMissingFields(
          payload
        )
      : profileMissingFields(
          payload
        );

  if (
    missingFields.length >
    0
  ) {
    throw new ComplianceLicenseError(
      'Complete every required field before verification.',
      400,
      missingFields
    );
  }

  const expirationDate =
    nullableDate(
      payload.expiration_date
    );

  if (
    isPastDate(
      expirationDate
    )
  ) {
    throw new ComplianceLicenseError(
      'An expired license cannot be verified.',
      400,
      [
        'Expiration date',
      ]
    );
  }

  const issueDate =
    nullableDate(
      payload.issue_date
    );

  if (
    issueDate &&
    expirationDate &&
    issueDate >
      expirationDate
  ) {
    throw new ComplianceLicenseError(
      'The issue date must be on or before the expiration date.',
      400,
      [
        'Issue date',
        'Expiration date',
      ]
    );
  }

  const regulatorUrl =
    nullableText(
      payload.regulator_source_url,
      1000
    );

  if (
    !validHttpUrl(
      regulatorUrl
    )
  ) {
    throw new ComplianceLicenseError(
      'The regulator source must be a valid HTTP or HTTPS URL.',
      400,
      [
        'Regulator source',
      ]
    );
  }
}

async function loadLicenseData() {
  const [
    jurisdictionResult,
    organizationResult,
    profileResult,
    marketResult,
    organizationLicenseResult,
    profileLicenseResult,
  ] = await Promise.all([
    supabaseAdmin
      .from(
        'marketing_jurisdictions'
      )
      .select(`
        id,
        code,
        name,
        launch_status,
        marketing_enabled,
        current_rule_version
      `),

    supabaseAdmin
      .from(
        'organizations'
      )
      .select(`
        id,
        name,
        slug,
        city,
        state,
        market_name,
        brokerage_name,
        marketing_licensed_business_name,
        marketing_broker_license_number,
        marketing_license_state,
        marketing_physical_address
      `),

    supabaseAdmin
      .from(
        'profiles'
      )
      .select(`
        id,
        name,
        email,
        role,
        org_id,
        marketing_license_number,
        marketing_brokerage
      `),

    supabaseAdmin
      .from(
        'organization_markets'
      )
      .select(`
        id,
        organization_id,
        jurisdiction_id,
        market_name,
        market_status,
        marketing_enabled
      `),

    supabaseAdmin
      .from(
        'organization_real_estate_licenses'
      )
      .select(`
        id,
        organization_id,
        jurisdiction_id,
        licensed_business_name,
        dba_name,
        brokerage_license_number,
        license_type,
        license_status,
        responsible_broker_name,
        responsible_broker_license_number,
        office_phone,
        office_address,
        compliance_mailing_address,
        issue_date,
        expiration_date,
        regulator_source_url,
        verified_by,
        verified_at,
        notes,
        created_at
      `)
      .order(
        'created_at',
        {
          ascending: true,
        }
      ),

    supabaseAdmin
      .from(
        'profile_real_estate_licenses'
      )
      .select(`
        id,
        profile_id,
        organization_id,
        organization_license_id,
        jurisdiction_id,
        license_type,
        license_number,
        license_status,
        issue_date,
        expiration_date,
        supervising_broker_name,
        supervising_broker_license_number,
        is_primary,
        regulator_source_url,
        verification_source,
        verified_by,
        verified_at,
        notes,
        created_at
      `)
      .order(
        'created_at',
        {
          ascending: true,
        }
      ),
  ]);

  const queryResults = [
    jurisdictionResult,
    organizationResult,
    profileResult,
    marketResult,
    organizationLicenseResult,
    profileLicenseResult,
  ];

  const failedResult =
    queryResults.find(
      (result) =>
        result.error
    );

  if (
    failedResult?.error
  ) {
    throw failedResult.error;
  }

  const jurisdictionById =
    new Map<
      string,
      any
    >();

  for (
    const row of
      jurisdictionResult.data ||
      []
  ) {
    jurisdictionById.set(
      row.id,
      row
    );
  }

  const organizationById =
    new Map<
      string,
      any
    >();

  for (
    const row of
      organizationResult.data ||
      []
  ) {
    organizationById.set(
      row.id,
      row
    );
  }

  const profileById =
    new Map<
      string,
      any
    >();

  for (
    const row of
      profileResult.data ||
      []
  ) {
    profileById.set(
      row.id,
      row
    );
  }

  const marketByKey =
    new Map<
      string,
      any
    >();

  for (
    const row of
      marketResult.data ||
      []
  ) {
    marketByKey.set(
      `${row.organization_id}:${row.jurisdiction_id}`,
      row
    );
  }

  const organizationLicenses =
    (
      organizationLicenseResult.data ||
      []
    ).map(
      (license) => {
        const organization =
          organizationById.get(
            license.organization_id
          );

        const jurisdiction =
          jurisdictionById.get(
            license.jurisdiction_id
          );

        const market =
          marketByKey.get(
            `${license.organization_id}:${license.jurisdiction_id}`
          );

        const missingFields =
          organizationMissingFields(
            license
          );

        const expired =
          isPastDate(
            license.expiration_date
          );

        const verified =
          Boolean(
            license.verified_at &&
              license.verified_by &&
              statusCanBeVerified(
                license.license_status
              ) &&
              !expired &&
              missingFields.length ===
                0
          );

        const verifier =
          license.verified_by
            ? profileById.get(
                license.verified_by
              )
            : null;

        return {
          id: license.id,
          organizationId:
            license.organization_id,
          organizationName:
            organization?.name ||
            'Unknown organization',
          marketId:
            market?.id ||
            null,
          marketName:
            market?.market_name ||
            organization?.market_name ||
            null,
          marketStatus:
            market?.market_status ||
            null,
          marketMarketingEnabled:
            market?.marketing_enabled ===
            true,
          jurisdictionId:
            license.jurisdiction_id,
          jurisdictionCode:
            jurisdiction?.code ||
            'UNKNOWN',
          jurisdictionName:
            jurisdiction?.name ||
            'Unknown jurisdiction',
          jurisdictionLaunchStatus:
            jurisdiction?.launch_status ||
            null,
          jurisdictionMarketingEnabled:
            jurisdiction?.marketing_enabled ===
            true,
          currentRuleVersion:
            jurisdiction?.current_rule_version ||
            null,
          licensedBusinessName:
            license.licensed_business_name,
          dbaName:
            license.dba_name,
          brokerageLicenseNumber:
            license.brokerage_license_number,
          licenseType:
            license.license_type,
          licenseStatus:
            license.license_status,
          responsibleBrokerName:
            license.responsible_broker_name,
          responsibleBrokerLicenseNumber:
            license.responsible_broker_license_number,
          officePhone:
            license.office_phone,
          officeAddress:
            license.office_address,
          complianceMailingAddress:
            license.compliance_mailing_address,
          issueDate:
            license.issue_date,
          expirationDate:
            license.expiration_date,
          regulatorSourceUrl:
            license.regulator_source_url,
          verifiedBy:
            license.verified_by,
          verifiedByName:
            verifier?.name ||
            verifier?.email ||
            null,
          verifiedAt:
            license.verified_at,
          notes:
            license.notes,
          verified,
          expired,
          daysUntilExpiration:
            daysUntilDate(
              license.expiration_date
            ),
          missingFields,
          needsAttention:
            !verified ||
            expired ||
            missingFields.length >
              0,
        };
      }
    );

  const profileLicenses =
    (
      profileLicenseResult.data ||
      []
    ).map(
      (license) => {
        const profile =
          profileById.get(
            license.profile_id
          );

        const organization =
          organizationById.get(
            license.organization_id
          );

        const jurisdiction =
          jurisdictionById.get(
            license.jurisdiction_id
          );

        const missingFields =
          profileMissingFields(
            license
          );

        const expired =
          isPastDate(
            license.expiration_date
          );

        const verified =
          Boolean(
            license.verified_at &&
              license.verified_by &&
              statusCanBeVerified(
                license.license_status
              ) &&
              !expired &&
              missingFields.length ===
                0
          );

        const verifier =
          license.verified_by
            ? profileById.get(
                license.verified_by
              )
            : null;

        return {
          id: license.id,
          profileId:
            license.profile_id,
          profileName:
            profile?.name ||
            profile?.email ||
            'Unknown person',
          profileEmail:
            profile?.email ||
            null,
          profileRole:
            profile?.role ||
            null,
          organizationId:
            license.organization_id,
          organizationLicenseId:
            license.organization_license_id,
          organizationName:
            organization?.name ||
            'Unknown organization',
          jurisdictionId:
            license.jurisdiction_id,
          jurisdictionCode:
            jurisdiction?.code ||
            'UNKNOWN',
          jurisdictionName:
            jurisdiction?.name ||
            'Unknown jurisdiction',
          licenseType:
            license.license_type,
          licenseNumber:
            license.license_number,
          licenseStatus:
            license.license_status,
          issueDate:
            license.issue_date,
          expirationDate:
            license.expiration_date,
          isPrimary:
            license.is_primary ===
            true,
          supervisingBrokerName:
            license.supervising_broker_name,
          supervisingBrokerLicenseNumber:
            license.supervising_broker_license_number,
          regulatorSourceUrl:
            license.regulator_source_url,
          verificationSource:
            license.verification_source,
          verifiedBy:
            license.verified_by,
          verifiedByName:
            verifier?.name ||
            verifier?.email ||
            null,
          verifiedAt:
            license.verified_at,
          notes:
            license.notes,
          verified,
          expired,
          daysUntilExpiration:
            daysUntilDate(
              license.expiration_date
            ),
          missingFields,
          needsAttention:
            !verified ||
            expired ||
            missingFields.length >
              0,
        };
      }
    );

  const allLicenses = [
    ...organizationLicenses,
    ...profileLicenses,
  ];

  return {
    ok: true,
    summary: {
      organizationLicenseRecords:
        organizationLicenses.length,
      profileLicenseRecords:
        profileLicenses.length,
      verifiedOrganizationLicenses:
        organizationLicenses.filter(
          (license) =>
            license.verified
        ).length,
      verifiedProfileLicenses:
        profileLicenses.filter(
          (license) =>
            license.verified
        ).length,
      totalVerified:
        allLicenses.filter(
          (license) =>
            license.verified
        ).length,
      needsAttention:
        allLicenses.filter(
          (license) =>
            license.needsAttention
        ).length,
      expiringSoon:
        allLicenses.filter(
          (license) => {
            const days =
              license.daysUntilExpiration;

            return (
              days !== null &&
              days >= 0 &&
              days <= 60
            );
          }
        ).length,
    },
    organizationLicenses,
    profileLicenses,
  };
}

export async function GET(
  request: Request
) {
  try {
    await requirePlatformAdmin(
      request
    );

    return NextResponse.json(
      await loadLicenseData(),
      {
        headers: {
          'Cache-Control':
            'no-store',
        },
      }
    );
  }
  catch (error) {
    console.error(
      'Compliance license GET error:',
      error
    );

    return jsonError(
      error
    );
  }
}

export async function PATCH(
  request: Request
) {
  try {
    const profile =
      await requirePlatformAdmin(
        request
      );

    const body =
      await request
        .json()
        .catch(
          () => ({})
        );

    const action =
      textValue(
        body?.action,
        100
      );

    if (
      action ===
      'save_organization_license'
    ) {
      const licenseId =
        requireId(
          body?.license_id,
          'Organization license'
        );

      const verify =
        body?.verify ===
        true;

      const {
        data: existing,
        error: existingError,
      } = await supabaseAdmin
        .from(
          'organization_real_estate_licenses'
        )
        .select(`
          id,
          organization_id,
          jurisdiction_id,
          license_status
        `)
        .eq(
          'id',
          licenseId
        )
        .single();

      if (
        existingError ||
        !existing
      ) {
        throw new ComplianceLicenseError(
          existingError?.message ||
            'Organization license not found.',
          404
        );
      }

      const payload = {
        licensed_business_name:
          nullableText(
            body?.licensed_business_name,
            250
          ),
        dba_name:
          nullableText(
            body?.dba_name,
            250
          ),
        brokerage_license_number:
          nullableText(
            body?.brokerage_license_number,
            150
          ),
        license_type:
          nullableText(
            body?.license_type,
            120
          ),
        responsible_broker_name:
          nullableText(
            body?.responsible_broker_name,
            200
          ),
        responsible_broker_license_number:
          nullableText(
            body?.responsible_broker_license_number,
            150
          ),
        office_phone:
          nullableText(
            body?.office_phone,
            80
          ),
        office_address:
          nullableText(
            body?.office_address,
            500
          ),
        compliance_mailing_address:
          nullableText(
            body?.compliance_mailing_address,
            500
          ),
        issue_date:
          nullableDate(
            body?.issue_date
          ),
        expiration_date:
          nullableDate(
            body?.expiration_date
          ),
        regulator_source_url:
          nullableText(
            body?.regulator_source_url,
            1000
          ),
        notes:
          nullableText(
            body?.notes,
            4000
          ),
        license_status:
          verify
            ? 'active'
            : existing.license_status,
        verified_by:
          verify
            ? profile.id
            : null,
        verified_at:
          verify
            ? new Date()
                .toISOString()
            : null,
      };

      if (verify) {
        assertVerificationReady(
          'organization',
          payload
        );
      }

      const {
        error: updateError,
      } = await supabaseAdmin
        .from(
          'organization_real_estate_licenses'
        )
        .update(
          payload
        )
        .eq(
          'id',
          licenseId
        );

      if (updateError) {
        throw updateError;
      }

      const {
        error: mirrorError,
      } = await supabaseAdmin
        .from(
          'organizations'
        )
        .update({
          marketing_licensed_business_name:
            payload.licensed_business_name,
          marketing_broker_license_number:
            payload.brokerage_license_number,
          marketing_physical_address:
            payload.office_address,
        })
        .eq(
          'id',
          existing.organization_id
        );

      if (mirrorError) {
        throw mirrorError;
      }

      return NextResponse.json(
        {
          ...await loadLicenseData(),
          message:
            verify
              ? 'Organization license saved and verified.'
              : 'Organization license draft saved. Verification was cleared until it is reviewed again.',
        },
        {
          headers: {
            'Cache-Control':
              'no-store',
          },
        }
      );
    }

    if (
      action ===
      'save_profile_license'
    ) {
      const licenseId =
        requireId(
          body?.license_id,
          'Individual license'
        );

      const verify =
        body?.verify ===
        true;

      const {
        data: existing,
        error: existingError,
      } = await supabaseAdmin
        .from(
          'profile_real_estate_licenses'
        )
        .select(`
          id,
          profile_id,
          organization_id,
          jurisdiction_id,
          license_status
        `)
        .eq(
          'id',
          licenseId
        )
        .single();

      if (
        existingError ||
        !existing
      ) {
        throw new ComplianceLicenseError(
          existingError?.message ||
            'Individual license not found.',
          404
        );
      }

      const payload = {
        license_type:
          nullableText(
            body?.license_type,
            120
          ),
        license_number:
          nullableText(
            body?.license_number,
            150
          ),
        issue_date:
          nullableDate(
            body?.issue_date
          ),
        expiration_date:
          nullableDate(
            body?.expiration_date
          ),
        supervising_broker_name:
          nullableText(
            body?.supervising_broker_name,
            200
          ),
        supervising_broker_license_number:
          nullableText(
            body?.supervising_broker_license_number,
            150
          ),
        is_primary:
          body?.is_primary ===
          true,
        regulator_source_url:
          nullableText(
            body?.regulator_source_url,
            1000
          ),
        verification_source:
          nullableText(
            body?.verification_source,
            1000
          ),
        notes:
          nullableText(
            body?.notes,
            4000
          ),
        license_status:
          verify
            ? 'active'
            : existing.license_status,
        verified_by:
          verify
            ? profile.id
            : null,
        verified_at:
          verify
            ? new Date()
                .toISOString()
            : null,
      };

      if (verify) {
        assertVerificationReady(
          'profile',
          payload
        );
      }

      if (
        payload.is_primary
      ) {
        const {
          error: primaryResetError,
        } = await supabaseAdmin
          .from(
            'profile_real_estate_licenses'
          )
          .update({
            is_primary:
              false,
          })
          .eq(
            'profile_id',
            existing.profile_id
          )
          .eq(
            'organization_id',
            existing.organization_id
          )
          .eq(
            'jurisdiction_id',
            existing.jurisdiction_id
          )
          .neq(
            'id',
            licenseId
          );

        if (
          primaryResetError
        ) {
          throw primaryResetError;
        }
      }

      const {
        error: updateError,
      } = await supabaseAdmin
        .from(
          'profile_real_estate_licenses'
        )
        .update(
          payload
        )
        .eq(
          'id',
          licenseId
        );

      if (updateError) {
        throw updateError;
      }

      const {
        error: mirrorError,
      } = await supabaseAdmin
        .from(
          'profiles'
        )
        .update({
          marketing_license_number:
            payload.license_number,
        })
        .eq(
          'id',
          existing.profile_id
        );

      if (mirrorError) {
        throw mirrorError;
      }

      return NextResponse.json(
        {
          ...await loadLicenseData(),
          message:
            verify
              ? 'Individual license saved and verified.'
              : 'Individual license draft saved. Verification was cleared until it is reviewed again.',
        },
        {
          headers: {
            'Cache-Control':
              'no-store',
          },
        }
      );
    }

    if (
      action ===
      'activate_organization_market'
    ) {
      const marketId =
        requireId(
          body?.market_id,
          'Organization market'
        );

      const {
        data: market,
        error: marketError,
      } = await supabaseAdmin
        .from(
          'organization_markets'
        )
        .select(`
          id,
          organization_id,
          jurisdiction_id
        `)
        .eq(
          'id',
          marketId
        )
        .single();

      if (
        marketError ||
        !market
      ) {
        throw new ComplianceLicenseError(
          marketError?.message ||
            'Organization market not found.',
          404
        );
      }

      const {
        data: jurisdiction,
        error: jurisdictionError,
      } = await supabaseAdmin
        .from(
          'marketing_jurisdictions'
        )
        .select(`
          id,
          code,
          launch_status,
          marketing_enabled
        `)
        .eq(
          'id',
          market.jurisdiction_id
        )
        .single();

      if (
        jurisdictionError ||
        !jurisdiction
      ) {
        throw new ComplianceLicenseError(
          jurisdictionError?.message ||
            'Compliance jurisdiction not found.',
          404
        );
      }

      if (
        jurisdiction.marketing_enabled !==
        true
      ) {
        throw new ComplianceLicenseError(
          `${jurisdiction.code} marketing must have an approved and active rule package before this organization market can be activated.`,
          409
        );
      }

      const {
        error: marketUpdateError,
      } = await supabaseAdmin
        .from(
          'organization_markets'
        )
        .update({
          market_status:
            'active',
          marketing_enabled:
            true,
        })
        .eq(
          'id',
          marketId
        );

      if (
        marketUpdateError
      ) {
        throw marketUpdateError;
      }

      return NextResponse.json(
        {
          ...await loadLicenseData(),
          message:
            'Organization market activated for marketing.',
        },
        {
          headers: {
            'Cache-Control':
              'no-store',
          },
        }
      );
    }

    throw new ComplianceLicenseError(
      'Unsupported compliance-license action.'
    );
  }
  catch (error) {
    console.error(
      'Compliance license PATCH error:',
      error
    );

    return jsonError(
      error
    );
  }
}
