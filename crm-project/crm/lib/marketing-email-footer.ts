export type MarketingIdentityForEmail = {
  marketing_from_name: string | null;
  marketing_from_email: string | null;
  marketing_reply_to_email: string | null;
  marketing_physical_address: string | null;

  marketing_phone: string | null;
  marketing_title: string | null;
  marketing_brokerage: string | null;
  marketing_website_url: string | null;
  marketing_license_number: string | null;
  marketing_headshot_url: string | null;
  marketing_signature_text: string | null;
  marketing_signature_image_url: string | null;

  marketing_logo_url: string | null;
  marketing_office_phone: string | null;
  marketing_office_address: string | null;
  marketing_appointment_url: string | null;
  marketing_designations: string[] | null;
  marketing_certifications: string[] | null;
  marketing_service_areas: string[] | null;
  marketing_languages: string[] | null;
  marketing_disclaimer: string | null;

  marketing_facebook_url: string | null;
  marketing_instagram_url: string | null;
  marketing_linkedin_url: string | null;
  marketing_youtube_url: string | null;
  marketing_tiktok_url: string | null;
  marketing_x_url: string | null;

  marketing_licensed_business_name: string | null;
  marketing_broker_license_number: string | null;
  marketing_license_state: string | null;
  marketing_privacy_policy_url: string | null;
  marketing_mls_attribution: string | null;
  marketing_standard_disclaimer: string | null;
  marketing_advertisement_label: string | null;
};

const PLATFORM_URL =
  'https://easyrealtor.homes';

const PLATFORM_LOGO_URL =
  `${PLATFORM_URL}/easyrealtor-logo.png`;

const EQUAL_HOUSING_LOGO_URL =
  `${PLATFORM_URL}/equal-housing-opportunity-logo.png`;

const DEFAULT_PROPERTY_DISCLAIMER =
  'Information is deemed reliable but not guaranteed. Property information, price, availability, features and measurements are subject to change. Buyers should independently verify all information.';

function escapeHtml(
  value: unknown
) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function webUrl(
  value?: string | null
) {
  const trimmed =
    String(value || '').trim();

  if (!trimmed) {
    return '';
  }

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

function phoneHref(
  value?: string | null
) {
  const trimmed =
    String(value || '').trim();

  if (!trimmed) {
    return '';
  }

  return `tel:${trimmed.replace(
    /[^\d+]/g,
    ''
  )}`;
}

function socialLinks(
  profile:
    MarketingIdentityForEmail
) {
  const links = [
    {
      label: 'Facebook',
      url:
        profile
          .marketing_facebook_url,
    },
    {
      label: 'Instagram',
      url:
        profile
          .marketing_instagram_url,
    },
    {
      label: 'LinkedIn',
      url:
        profile
          .marketing_linkedin_url,
    },
    {
      label: 'YouTube',
      url:
        profile
          .marketing_youtube_url,
    },
    {
      label: 'TikTok',
      url:
        profile
          .marketing_tiktok_url,
    },
    {
      label: 'X',
      url:
        profile
          .marketing_x_url,
    },
  ].filter(
    (
      item
    ): item is {
      label: string;
      url: string;
    } =>
      Boolean(
        item.url?.trim()
      )
  );

  if (
    links.length === 0
  ) {
    return '';
  }

  return `
    <div
      style="margin-top:13px;font-size:12px;line-height:1.8;"
    >
      ${links
        .map(
          (item) => `
            <a
              href="${escapeHtml(
                webUrl(item.url)
              )}"
              style="color:#2563eb;text-decoration:none;margin-right:10px;"
            >
              ${escapeHtml(
                item.label
              )}
            </a>
          `
        )
        .join('')}
    </div>
  `;
}

export function buildMarketingFooterHtml(
  profile:
    MarketingIdentityForEmail
) {
  const displayName =
    profile.marketing_from_name ||
    'Real Estate Professional';

  const titleLine = [
    profile.marketing_title,
    profile.marketing_brokerage,
  ]
    .filter(Boolean)
    .join(' | ');

  const credentials = [
    ...(
      profile
        .marketing_designations ||
      []
    ),

    ...(
      profile
        .marketing_certifications ||
      []
    ),
  ].join(' • ');

  const phone =
    profile
      .marketing_phone
      ?.trim() ||
    '';

  const officePhone =
    profile
      .marketing_office_phone
      ?.trim() ||
    '';

  const email =
    profile
      .marketing_reply_to_email
      ?.trim() ||
    profile
      .marketing_from_email
      ?.trim() ||
    '';

  const website =
    profile
      .marketing_website_url
      ?.trim() ||
    '';

  const signature =
    profile
      .marketing_signature_text
      ?.trim() ||
    '';

  const license =
    profile
      .marketing_license_number
      ?.trim() ||
    '';

  const officeAddress =
    profile
      .marketing_office_address
      ?.trim() ||
    '';

  const appointmentUrl =
    profile
      .marketing_appointment_url
      ?.trim() ||
    '';

  const serviceAreas =
    (
      profile
        .marketing_service_areas ||
      []
    ).join(', ');

  const languages =
    (
      profile
        .marketing_languages ||
      []
    ).join(', ');

  const personalDisclaimer =
    profile
      .marketing_disclaimer
      ?.trim() ||
    '';

  const licensedBusinessName =
    profile
      .marketing_licensed_business_name
      ?.trim() ||
    'Broker licensed business name required';

  const brokerLicense = [
    profile
      .marketing_broker_license_number
      ?.trim(),

    profile
      .marketing_license_state
      ?.trim(),
  ]
    .filter(Boolean)
    .join(' | ');

  const propertyDisclaimer =
    profile
      .marketing_standard_disclaimer
      ?.trim() ||
    DEFAULT_PROPERTY_DISCLAIMER;

  const advertisementLabel =
    profile
      .marketing_advertisement_label
      ?.trim() ||
    'Advertisement';

  const privacyUrl =
    profile
      .marketing_privacy_policy_url
      ?.trim() ||
    '';

  const mlsAttribution =
    profile
      .marketing_mls_attribution
      ?.trim() ||
    '';

  return `
    <tr>
      <td
        style="padding:28px 30px;background:#0f172a;font-family:Arial,sans-serif;"
      >
        ${
          profile
            .marketing_logo_url
            ? `
              <div
                style="margin-bottom:18px;text-align:center;"
              >
                <img
                  src="${escapeHtml(
                    profile
                      .marketing_logo_url
                  )}"
                  alt="Brokerage or team logo"
                  style="display:inline-block;max-width:210px;max-height:75px;width:auto;height:auto;"
                />
              </div>
            `
            : ''
        }

        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="background:#ffffff;border-radius:16px;"
        >
          <tr>
            ${
              profile
                .marketing_headshot_url
                ? `
                  <td
                    width="130"
                    valign="top"
                    style="padding:24px 0 24px 24px;"
                  >
                    <img
                      src="${escapeHtml(
                        profile
                          .marketing_headshot_url
                      )}"
                      alt="${escapeHtml(
                        displayName
                      )}"
                      width="96"
                      height="96"
                      style="display:block;width:96px;height:96px;border-radius:50%;object-fit:cover;border:3px solid #e2e8f0;"
                    />
                  </td>
                `
                : ''
            }

            <td
              valign="top"
              style="padding:24px;color:#334155;"
            >
              <div
                style="font-size:21px;font-weight:bold;color:#0f172a;"
              >
                ${escapeHtml(
                  displayName
                )}
              </div>

              ${
                titleLine
                  ? `
                    <div
                      style="margin-top:4px;font-size:13px;font-weight:bold;color:#ea580c;"
                    >
                      ${escapeHtml(
                        titleLine
                      )}
                    </div>
                  `
                  : ''
              }

              ${
                credentials
                  ? `
                    <div
                      style="margin-top:8px;font-size:12px;font-weight:bold;line-height:1.6;color:#475569;"
                    >
                      ${escapeHtml(
                        credentials
                      )}
                    </div>
                  `
                  : ''
              }

              ${
                signature
                  ? `
                    <div
                      style="margin-top:12px;font-size:14px;line-height:1.6;color:#475569;"
                    >
                      ${escapeHtml(
                        signature
                      ).replace(
                        /\n/g,
                        '<br />'
                      )}
                    </div>
                  `
                  : ''
              }

              ${
                profile
                  .marketing_signature_image_url
                  ? `
                    <div
                      style="margin-top:14px;"
                    >
                      <img
                        src="${escapeHtml(
                          profile
                            .marketing_signature_image_url
                        )}"
                        alt="Email signature"
                        style="display:block;max-width:240px;max-height:90px;width:auto;height:auto;"
                      />
                    </div>
                  `
                  : ''
              }

              <div
                style="margin-top:14px;font-size:13px;line-height:1.9;"
              >
                ${
                  phone
                    ? `
                      <div>
                        <strong>
                          Mobile:
                        </strong>

                        <a
                          href="${escapeHtml(
                            phoneHref(phone)
                          )}"
                          style="color:#2563eb;text-decoration:none;"
                        >
                          ${escapeHtml(
                            phone
                          )}
                        </a>
                      </div>
                    `
                    : ''
                }

                ${
                  officePhone
                    ? `
                      <div>
                        <strong>
                          Office:
                        </strong>

                        <a
                          href="${escapeHtml(
                            phoneHref(
                              officePhone
                            )
                          )}"
                          style="color:#2563eb;text-decoration:none;"
                        >
                          ${escapeHtml(
                            officePhone
                          )}
                        </a>
                      </div>
                    `
                    : ''
                }

                ${
                  email
                    ? `
                      <div>
                        <strong>
                          Email:
                        </strong>

                        <a
                          href="mailto:${escapeHtml(
                            email
                          )}"
                          style="color:#2563eb;text-decoration:none;"
                        >
                          ${escapeHtml(
                            email
                          )}
                        </a>
                      </div>
                    `
                    : ''
                }

                ${
                  website
                    ? `
                      <div>
                        <strong>
                          Website:
                        </strong>

                        <a
                          href="${escapeHtml(
                            webUrl(website)
                          )}"
                          style="color:#2563eb;text-decoration:none;"
                        >
                          ${escapeHtml(
                            website
                          )}
                        </a>
                      </div>
                    `
                    : ''
                }

                ${
                  license
                    ? `
                      <div>
                        <strong>
                          Agent License:
                        </strong>

                        ${escapeHtml(
                          license
                        )}
                      </div>
                    `
                    : ''
                }

                ${
                  officeAddress
                    ? `
                      <div>
                        <strong>
                          Office:
                        </strong>

                        ${escapeHtml(
                          officeAddress
                        )}
                      </div>
                    `
                    : ''
                }
              </div>

              ${
                appointmentUrl
                  ? `
                    <table
                      role="presentation"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      style="margin-top:15px;"
                    >
                      <tr>
                        <td
                          bgcolor="#2563eb"
                          style="border-radius:9px;"
                        >
                          <a
                            href="${escapeHtml(
                              webUrl(
                                appointmentUrl
                              )
                            )}"
                            style="display:inline-block;padding:10px 16px;color:#ffffff;text-decoration:none;font-size:13px;font-weight:bold;"
                          >
                            Schedule an Appointment
                          </a>
                        </td>
                      </tr>
                    </table>
                  `
                  : ''
              }

              ${
                serviceAreas
                  ? `
                    <div
                      style="margin-top:14px;font-size:11px;line-height:1.5;color:#64748b;"
                    >
                      <strong>
                        Service Areas:
                      </strong>

                      ${escapeHtml(
                        serviceAreas
                      )}
                    </div>
                  `
                  : ''
              }

              ${
                languages
                  ? `
                    <div
                      style="margin-top:5px;font-size:11px;line-height:1.5;color:#64748b;"
                    >
                      <strong>
                        Languages:
                      </strong>

                      ${escapeHtml(
                        languages
                      )}
                    </div>
                  `
                  : ''
              }

              ${socialLinks(profile)}
            </td>
          </tr>
        </table>

        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="margin-top:18px;background:#ffffff;border-radius:14px;"
        >
          <tr>
            <td
              style="padding:20px;text-align:center;font-family:Arial,sans-serif;color:#334155;"
            >
              <div
                style="display:inline-block;border-radius:999px;background:#fef3c7;padding:6px 11px;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:#92400e;"
              >
                ${escapeHtml(
                  advertisementLabel
                )}
              </div>

              <div
                style="margin-top:12px;font-size:15px;font-weight:bold;color:#0f172a;"
              >
                ${escapeHtml(
                  licensedBusinessName
                )}
              </div>

              ${
                brokerLicense
                  ? `
                    <div
                      style="margin-top:4px;font-size:11px;color:#64748b;"
                    >
                      Brokerage License:
                      ${escapeHtml(
                        brokerLicense
                      )}
                    </div>
                  `
                  : ''
              }

              <div
                style="margin-top:16px;"
              >
                <img
                  src="${EQUAL_HOUSING_LOGO_URL}"
                  alt="Equal Housing Opportunity"
                  width="72"
                  style="display:inline-block;width:72px;height:auto;"
                />
              </div>

              <div
                style="margin-top:5px;font-size:11px;font-weight:bold;color:#334155;"
              >
                Equal Housing Opportunity
              </div>

              <div
                style="margin-top:15px;font-size:10px;line-height:1.6;color:#64748b;"
              >
                ${escapeHtml(
                  propertyDisclaimer
                )}
              </div>

              ${
                mlsAttribution
                  ? `
                    <div
                      style="margin-top:10px;font-size:10px;line-height:1.6;color:#64748b;"
                    >
                      ${escapeHtml(
                        mlsAttribution
                      ).replace(
                        /\n/g,
                        '<br />'
                      )}
                    </div>
                  `
                  : ''
              }

              ${
                personalDisclaimer
                  ? `
                    <div
                      style="margin-top:10px;font-size:10px;line-height:1.6;color:#64748b;"
                    >
                      ${escapeHtml(
                        personalDisclaimer
                      ).replace(
                        /\n/g,
                        '<br />'
                      )}
                    </div>
                  `
                  : ''
              }
            </td>
          </tr>
        </table>

        <div
          style="margin-top:18px;text-align:center;font-size:11px;line-height:1.6;color:#cbd5e1;"
        >
          ${escapeHtml(
            profile
              .marketing_physical_address ||
              'Valid physical postal address required'
          )}
        </div>

        <div
          style="margin-top:9px;text-align:center;font-size:11px;line-height:1.8;"
        >
          ${
            privacyUrl
              ? `
                <a
                  href="${escapeHtml(
                    webUrl(
                      privacyUrl
                    )
                  )}"
                  style="color:#cbd5e1;margin-right:12px;"
                >
                  Privacy Policy
                </a>
              `
              : ''
          }

          <a
            href="{{preferences_url}}"
            style="color:#cbd5e1;margin-right:12px;"
          >
            Email Preferences
          </a>

          <a
            href="{{unsubscribe_url}}"
            style="color:#cbd5e1;"
          >
            Unsubscribe
          </a>
        </div>

        <div
          style="margin-top:20px;text-align:center;"
        >
          <img
            src="${PLATFORM_LOGO_URL}"
            alt="easyrealtor.homes"
            style="display:inline-block;max-width:115px;max-height:34px;width:auto;height:auto;"
          />
        </div>

        <div
          style="margin-top:7px;text-align:center;font-size:10px;color:#94a3b8;"
        >
          Email technology powered by easyrealtor.homes
        </div>

        <div
          style="margin-top:5px;text-align:center;font-size:9px;line-height:1.5;color:#64748b;"
        >
          easyrealtor.homes is a technology platform and is not
          the real-estate brokerage representing this property.
        </div>
      </td>
    </tr>
  `;
}

export function buildMarketingContactText(
  profile:
    MarketingIdentityForEmail
) {
  const credentials = [
    ...(
      profile
        .marketing_designations ||
      []
    ),

    ...(
      profile
        .marketing_certifications ||
      []
    ),
  ].join(', ');

  return [
    profile
      .marketing_advertisement_label ||
      'Advertisement',

    profile
      .marketing_licensed_business_name,

    profile
      .marketing_broker_license_number
      ? `Brokerage License: ${profile.marketing_broker_license_number}`
      : '',

    profile
      .marketing_license_state
      ? `License State: ${profile.marketing_license_state}`
      : '',

    'Equal Housing Opportunity',
    '',
    profile.marketing_signature_text,
    profile.marketing_from_name,

    [
      profile.marketing_title,
      profile.marketing_brokerage,
    ]
      .filter(Boolean)
      .join(' | '),

    credentials,

    profile.marketing_phone
      ? `Mobile: ${profile.marketing_phone}`
      : '',

    profile.marketing_office_phone
      ? `Office: ${profile.marketing_office_phone}`
      : '',

    profile.marketing_reply_to_email ||
      profile.marketing_from_email,

    profile.marketing_website_url,

    profile.marketing_appointment_url
      ? `Appointments: ${profile.marketing_appointment_url}`
      : '',

    profile.marketing_license_number
      ? `Agent License: ${profile.marketing_license_number}`
      : '',

    profile.marketing_office_address
      ? `Office: ${profile.marketing_office_address}`
      : '',

    (
      profile
        .marketing_service_areas ||
      []
    ).length
      ? `Service Areas: ${
          (
            profile
              .marketing_service_areas ||
            []
          ).join(', ')
        }`
      : '',

    (
      profile
        .marketing_languages ||
      []
    ).length
      ? `Languages: ${
          (
            profile
              .marketing_languages ||
            []
          ).join(', ')
        }`
      : '',

    '',
    profile
      .marketing_standard_disclaimer ||
      DEFAULT_PROPERTY_DISCLAIMER,

    profile
      .marketing_mls_attribution,

    profile
      .marketing_disclaimer,

    '',
    profile.marketing_physical_address,

    profile
      .marketing_privacy_policy_url
      ? `Privacy Policy: ${profile.marketing_privacy_policy_url}`
      : '',

    'Email Preferences: {{preferences_url}}',
    'Unsubscribe: {{unsubscribe_url}}',
    '',
    'Email technology powered by easyrealtor.homes',
    'easyrealtor.homes is a technology platform and is not the real-estate brokerage representing this property.',
  ]
    .filter(
      (line) =>
        line !== null &&
        line !== undefined &&
        line !== ''
    )
    .join('\n');
}
