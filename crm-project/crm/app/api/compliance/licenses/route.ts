import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function jsonError(
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

function normalizedStatus(
  value: string | null
) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isPastDate(
  value: string | null
) {
  if (!value) return false;

  const date = new Date(
    `${value}T23:59:59`
  );

  return (
    !Number.isNaN(date.getTime()) &&
    date.getTime() < Date.now()
  );
}

function daysUntilDate(
  value: string | null
) {
  if (!value) return null;

  const date = new Date(
    `${value}T23:59:59`
  );

  if (
    Number.isNaN(date.getTime())
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
  value: string | null
) {
  return [
    'active',
    'approved',
    'verified',
  ].includes(
    normalizedStatus(value)
  );
}

export async function GET(
  request: Request
) {
  try {
    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const anonKey =
      process.env.SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (
      !supabaseUrl ||
      !anonKey ||
      !serviceRoleKey
    ) {
      return jsonError(
        'Compliance API environment variables are missing.',
        500
      );
    }

    const authorization =
      request.headers.get(
        'authorization'
      ) || '';

    const accessToken =
      authorization.startsWith(
        'Bearer '
      )
        ? authorization
            .slice(7)
            .trim()
        : '';

    if (!accessToken) {
      return jsonError(
        'Not authenticated.',
        401
      );
    }

    const authClient =
      createClient(
        supabaseUrl,
        anonKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
          },
        }
      );

    const {
      data: userResult,
      error: userError,
    } =
      await authClient.auth.getUser(
        accessToken
      );

    if (
      userError ||
      !userResult.user
    ) {
      return jsonError(
        userError?.message ||
          'Your session is invalid.',
        401
      );
    }

    const admin =
      createClient(
        supabaseUrl,
        serviceRoleKey,
        {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        }
      );

    const {
      data: accessProfile,
      error: profileError,
    } = await admin
      .from('profiles')
      .select('id, role')
      .eq(
        'id',
        userResult.user.id
      )
      .single();

    if (
      profileError ||
      !accessProfile
    ) {
      return jsonError(
        profileError?.message ||
          'CRM profile not found.',
        403
      );
    }

    if (
      accessProfile.role !==
      'platform_admin'
    ) {
      return jsonError(
        'Platform-admin access is required.',
        403
      );
    }

    const [
      jurisdictionResult,
      organizationResult,
      profileResult,
      marketResult,
      organizationLicenseResult,
      profileLicenseResult,
    ] = await Promise.all([
      admin
        .from(
          'marketing_jurisdictions'
        )
        .select(`
          id,
          code,
          name
        `),

      admin
        .from('organizations')
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

      admin
        .from('profiles')
        .select(`
          id,
          name,
          email,
          role,
          org_id,
          marketing_license_number,
          marketing_brokerage
        `),

      admin
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

      admin
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
          notes
        `)
        .order(
          'created_at',
          {
            ascending: true,
          }
        ),

      admin
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
          notes
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
        (result) => result.error
      );

    if (failedResult?.error) {
      throw failedResult.error;
    }

    const jurisdictionById =
      new Map<string, any>();

    for (
      const row of
        jurisdictionResult.data || []
    ) {
      jurisdictionById.set(
        row.id,
        row
      );
    }

    const organizationById =
      new Map<string, any>();

    for (
      const row of
        organizationResult.data || []
    ) {
      organizationById.set(
        row.id,
        row
      );
    }

    const profileById =
      new Map<string, any>();

    for (
      const row of
        profileResult.data || []
    ) {
      profileById.set(
        row.id,
        row
      );
    }

    const marketByOrganizationAndJurisdiction =
      new Map<string, any>();

    for (
      const row of
        marketResult.data || []
    ) {
      marketByOrganizationAndJurisdiction.set(
        `${row.organization_id}:${row.jurisdiction_id}`,
        row
      );
    }

    const organizationLicenses =
      (
        organizationLicenseResult.data ||
        []
      ).map((license) => {
        const organization =
          organizationById.get(
            license.organization_id
          );

        const jurisdiction =
          jurisdictionById.get(
            license.jurisdiction_id
          );

        const market =
          marketByOrganizationAndJurisdiction.get(
            `${license.organization_id}:${license.jurisdiction_id}`
          );

        const missingFields: string[] =
          [];

        if (
          !license
            .licensed_business_name
        ) {
          missingFields.push(
            'Licensed business name'
          );
        }

        if (
          !license
            .brokerage_license_number
        ) {
          missingFields.push(
            'Brokerage license number'
          );
        }

        if (
          !license
            .responsible_broker_name
        ) {
          missingFields.push(
            'Responsible broker'
          );
        }

        if (
          !license
            .responsible_broker_license_number
        ) {
          missingFields.push(
            'Responsible broker license'
          );
        }

        if (!license.office_phone) {
          missingFields.push(
            'Office phone'
          );
        }

        if (!license.office_address) {
          missingFields.push(
            'Office address'
          );
        }

        if (
          !license
            .compliance_mailing_address
        ) {
          missingFields.push(
            'Compliance mailing address'
          );
        }

        if (
          !license.expiration_date
        ) {
          missingFields.push(
            'Expiration date'
          );
        }

        if (
          !license
            .regulator_source_url
        ) {
          missingFields.push(
            'Regulator source'
          );
        }

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
              !expired
          );

        return {
          id: license.id,

          organizationId:
            license.organization_id,

          organizationName:
            organization?.name ||
            'Unknown organization',

          marketName:
            market?.market_name ||
            organization?.market_name ||
            null,

          marketStatus:
            market?.market_status ||
            null,

          jurisdictionCode:
            jurisdiction?.code ||
            'UNKNOWN',

          jurisdictionName:
            jurisdiction?.name ||
            'Unknown jurisdiction',

          licensedBusinessName:
            license
              .licensed_business_name,

          dbaName:
            license.dba_name,

          brokerageLicenseNumber:
            license
              .brokerage_license_number,

          licenseType:
            license.license_type,

          licenseStatus:
            license.license_status,

          responsibleBrokerName:
            license
              .responsible_broker_name,

          responsibleBrokerLicenseNumber:
            license
              .responsible_broker_license_number,

          officePhone:
            license.office_phone,

          officeAddress:
            license.office_address,

          complianceMailingAddress:
            license
              .compliance_mailing_address,

          expirationDate:
            license.expiration_date,

          regulatorSourceUrl:
            license
              .regulator_source_url,

          verifiedAt:
            license.verified_at,

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
            missingFields.length > 0,
        };
      });

    const profileLicenses =
      (
        profileLicenseResult.data ||
        []
      ).map((license) => {
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

        const missingFields: string[] =
          [];

        if (!license.license_number) {
          missingFields.push(
            'License number'
          );
        }

        if (
          !license.expiration_date
        ) {
          missingFields.push(
            'Expiration date'
          );
        }

        if (
          !license
            .supervising_broker_name
        ) {
          missingFields.push(
            'Supervising broker'
          );
        }

        if (
          !license
            .supervising_broker_license_number
        ) {
          missingFields.push(
            'Supervising broker license'
          );
        }

        if (
          !license
            .regulator_source_url
        ) {
          missingFields.push(
            'Regulator source'
          );
        }

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
              !expired
          );

        return {
          id: license.id,

          profileId:
            license.profile_id,

          profileName:
            profile?.name ||
            profile?.email ||
            'Unknown person',

          profileEmail:
            profile?.email || null,

          profileRole:
            profile?.role || null,

          organizationId:
            license.organization_id,

          organizationName:
            organization?.name ||
            'Unknown organization',

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

          isPrimary:
            license.is_primary,

          supervisingBrokerName:
            license
              .supervising_broker_name,

          supervisingBrokerLicenseNumber:
            license
              .supervising_broker_license_number,

          expirationDate:
            license.expiration_date,

          regulatorSourceUrl:
            license
              .regulator_source_url,

          verificationSource:
            license
              .verification_source,

          verifiedAt:
            license.verified_at,

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
            missingFields.length > 0,
        };
      });

    const expiringSoonCount = [
      ...organizationLicenses,
      ...profileLicenses,
    ].filter((license) => {
      const days =
        license.daysUntilExpiration;

      return (
        days !== null &&
        days >= 0 &&
        days <= 60
      );
    }).length;

    const summary = {
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
        [
          ...organizationLicenses,
          ...profileLicenses,
        ].filter(
          (license) =>
            license.verified
        ).length,

      needsAttention:
        [
          ...organizationLicenses,
          ...profileLicenses,
        ].filter(
          (license) =>
            license.needsAttention
        ).length,

      expiringSoon:
        expiringSoonCount,
    };

    return NextResponse.json(
      {
        ok: true,
        summary,
        organizationLicenses,
        profileLicenses,
      },
      {
        headers: {
          'Cache-Control':
            'no-store',
        },
      }
    );
  } catch (error: any) {
    console.error(
      'Compliance license API error:',
      error
    );

    return jsonError(
      error?.message ||
        'Could not load license data.',
      500
    );
  }
}

