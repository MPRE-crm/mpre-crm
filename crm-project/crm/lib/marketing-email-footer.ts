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

function formatPhoneDisplay(
  value?: string | null
) {
  const original =
    String(value || '').trim();

  const digits =
    original.replace(/\D/g, '');

  const nationalDigits =
    digits.length === 11 &&
    digits.startsWith('1')
      ? digits.slice(1)
      : digits;

  if (nationalDigits.length !== 10) {
    return original;
  }

  return `(${nationalDigits.slice(
    0,
    3
  )}) ${nationalDigits.slice(
    3,
    6
  )}-${nationalDigits.slice(6)}`;
}

function socialLinks(
  profile:
    MarketingIdentityForEmail
) {
  const links: Array<{
    label: string;
    url: string | null;
    iconUrl: string;
  }> = [
    {
      label: 'Facebook',
      url:
        profile
          .marketing_facebook_url,
      iconUrl:
        'https://img.icons8.com/ios-filled/96/ffffff/facebook-new.png',
    },
    {
      label: 'Instagram',
      url:
        profile
          .marketing_instagram_url,
      iconUrl:
        'https://img.icons8.com/ios-filled/96/ffffff/instagram-new--v1.png',
    },
    {
      label: 'LinkedIn',
      url:
        profile
          .marketing_linkedin_url,
      iconUrl:
        'https://img.icons8.com/ios-filled/96/ffffff/linkedin.png',
    },
    {
      label: 'YouTube',
      url:
        profile
          .marketing_youtube_url,
      iconUrl:
        'https://img.icons8.com/ios-filled/96/ffffff/youtube-play.png',
    },
    {
      label: 'TikTok',
      url:
        profile
          .marketing_tiktok_url,
      iconUrl:
        'https://img.icons8.com/ios-filled/96/ffffff/tiktok--v1.png',
    },
    {
      label: 'X',
      url:
        profile
          .marketing_x_url,
      iconUrl:
        'https://img.icons8.com/ios-filled/96/ffffff/twitterx--v2.png',
    },
  ].filter(
    (item) =>
      Boolean(
        item.url?.trim()
      )
  );

  if (links.length === 0) {
    return '';
  }

  return `
    <table
      role="presentation"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="margin-top:10px;"
    >
      <tr>
        ${links
          .map(
            (item) => {
              const url =
                item.url?.trim() ||
                '';

              return `
                <td
                  style="padding-right:8px;"
                >
                  <a
                    href="${escapeHtml(
                      webUrl(
                        url
                      )
                    )}"
                    title="${escapeHtml(
                      item.label
                    )}"
                    style="display:block;width:30px;height:30px;text-decoration:none;"
                  >
                    <img
                      src="${escapeHtml(
                        item.iconUrl
                      )}"
                      alt="${escapeHtml(
                        item.label
                      )}"
                      width="16"
                      height="16"
                      style="display:block;width:16px;height:16px;margin:7px;border:0;"
                    />
                  </a>
                </td>
              `;
            }
          )
          .join('')}
      </tr>
    </table>
  `;
}

export function buildMarketingFooterHtml(
  profile:
    MarketingIdentityForEmail
) {
  const displayName =
    profile
      .marketing_from_name
      ?.trim() ||
    'Real Estate Professional';

  const titleLine = [
    profile
      .marketing_title
      ?.trim(),
    profile
      .marketing_brokerage
      ?.trim(),
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
  ]
    .filter(Boolean)
    .join(' • ');

  const phone =
    profile
      .marketing_phone
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

  const headshot =
    profile
      .marketing_headshot_url
      ?.trim() ||
    '';

  const logo =
    profile
      .marketing_logo_url
      ?.trim() ||
    '';

  const agentLicense =
    profile
      .marketing_license_number
      ?.trim() ||
    '';

  const address =
    profile
      .marketing_physical_address
      ?.trim() ||
    profile
      .marketing_office_address
      ?.trim() ||
    '';

  const business =
    profile
      .marketing_licensed_business_name
      ?.trim() ||
    profile
      .marketing_brokerage
      ?.trim() ||
    'Licensed Real Estate Brokerage';

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

  const advertisement =
    profile
      .marketing_advertisement_label
      ?.trim() ||
    'Advertisement';

  const propertyDisclaimer =
    profile
      .marketing_standard_disclaimer
      ?.trim() ||
    DEFAULT_PROPERTY_DISCLAIMER;

  const personalDisclaimer =
    profile
      .marketing_disclaimer
      ?.trim() ||
    '';

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
        style="padding:0;background:#11100e;"
      >
        <table
          role="presentation"
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
        >
          <tr>
            <td
              style="padding:24px 28px 20px;"
            >
              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
              >
                <tr>
                  ${
                    headshot
                      ? `
                        <td
                          width="74"
                          valign="top"
                          style="padding-right:14px;"
                        >
                          <img
                            src="${escapeHtml(
                              headshot
                            )}"
                            alt="${escapeHtml(
                              displayName
                            )}"
                            width="62"
                            height="62"
                            style="display:block;width:62px;height:62px;border-radius:999px;object-fit:cover;border:1px solid #5a4c34;"
                          />
                        </td>
                      `
                      : ''
                  }

                  <td
                    valign="top"
                    style="font-family:Arial,sans-serif;"
                  >
                    <div
                      style="font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.1;color:#ffffff;"
                    >
                      ${escapeHtml(
                        displayName
                      )}
                    </div>

                    ${
                      titleLine
                        ? `
                          <div
                            style="margin-top:5px;font-size:11px;line-height:1.4;color:#c9a964;font-weight:bold;"
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
                            style="margin-top:3px;font-size:9px;line-height:1.4;color:#9d9488;"
                          >
                            ${escapeHtml(
                              credentials
                            )}
                          </div>
                        `
                        : ''
                    }

                    <div
                      style="margin-top:8px;font-size:10px;line-height:1.6;color:#ddd4c7;"
                    >
                      ${
                        phone
                          ? `
                            <a
                              href="tel:${escapeHtml(
                                phone.replace(
                                  /[^\d+]/g,
                                  ''
                                )
                              )}"
                              style="color:#ddd4c7;text-decoration:none;"
                            >
                              ${escapeHtml(
                                formatPhoneDisplay(
                                  phone
                                )
                              )}
                            </a>
                          `
                          : ''
                      }

                      ${
                        phone &&
                        email
                          ? '&nbsp;&nbsp;•&nbsp;&nbsp;'
                          : ''
                      }

                      ${
                        email
                          ? `
                            <a
                              href="mailto:${escapeHtml(
                                email
                              )}"
                              style="color:#ddd4c7;text-decoration:none;"
                            >
                              ${escapeHtml(
                                email
                              )}
                            </a>
                          `
                          : ''
                      }

                      ${
                        website &&
                        (
                          phone ||
                          email
                        )
                          ? '&nbsp;&nbsp;•&nbsp;&nbsp;'
                          : ''
                      }

                      ${
                        website
                          ? `
                            <a
                              href="${escapeHtml(
                                webUrl(
                                  website
                                )
                              )}"
                              style="color:#c9a964;text-decoration:none;"
                            >
                              Website
                            </a>
                          `
                          : ''
                      }
                    </div>

                    ${socialLinks(
                      profile
                    )}
                  </td>

                  ${
                    logo
                      ? `
                        <td
                          width="132"
                          valign="top"
                          align="right"
                          style="padding-left:16px;"
                        >
                          <div
                            style="display:inline-block;background:transparent;padding-top:4px;"
                          >
                            <img
                              src="${escapeHtml(
                                logo
                              )}"
                              alt="${escapeHtml(
                                business
                              )}"
                              width="112"
                              style="display:block;max-width:112px;max-height:46px;width:auto;height:auto;border:0;"
                            />
                          </div>
                        </td>
                      `
                      : ''
                  }
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td
              style="padding:10px 24px 12px;border-top:1px solid #302b23;font-family:Arial,sans-serif;"
            >
              <table
                role="presentation"
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
              >
                <tr>
                  <td
                    valign="top"
                    style="padding-right:12px;"
                  >
                    <div
                      style="font-size:7px;line-height:1.45;color:#9d9488;"
                    >
                      <span
                        style="display:inline-block;margin-right:5px;padding:2px 5px;border:1px solid #695938;border-radius:999px;font-weight:bold;letter-spacing:0.9px;text-transform:uppercase;color:#d0b06e;"
                      >
                        ${escapeHtml(
                          advertisement
                        )}
                      </span>

                      <strong
                        style="color:#c5bbae;"
                      >
                        ${escapeHtml(
                          business
                        )}
                      </strong>

                      ${
                        brokerLicense
                          ? ` • Brokerage License: ${escapeHtml(
                              brokerLicense
                            )}`
                          : ''
                      }

                      ${
                        agentLicense
                          ? ` • Agent License: ${escapeHtml(
                              agentLicense
                            )}`
                          : ''
                      }
                    </div>

                    ${
                      address
                        ? `
                          <div
                            style="margin-top:3px;font-size:7px;line-height:1.35;color:#7f776d;"
                          >
                            ${escapeHtml(
                              address
                            )}
                          </div>
                        `
                        : ''
                    }

                    <div
                      style="margin-top:5px;font-size:7px;line-height:1.45;color:#766f65;"
                    >
                      ${escapeHtml(
                        propertyDisclaimer
                      )}

                      ${
                        personalDisclaimer &&
                        personalDisclaimer !==
                          propertyDisclaimer
                          ? ` ${escapeHtml(
                              personalDisclaimer
                            )}`
                          : ''
                      }

                      easyrealtor.homes is a technology platform and is not the real-estate brokerage representing this property.
                    </div>

                    ${
                      mlsAttribution ||
                      privacyUrl
                        ? `
                          <div
                            style="margin-top:4px;font-size:7px;line-height:1.35;color:#746c61;"
                          >
                            ${
                              mlsAttribution
                                ? escapeHtml(
                                    mlsAttribution
                                  )
                                : ''
                            }

                            ${
                              mlsAttribution &&
                              privacyUrl
                                ? ' • '
                                : ''
                            }

                            ${
                              privacyUrl
                                ? `
                                  <a
                                    href="${escapeHtml(
                                      webUrl(
                                        privacyUrl
                                      )
                                    )}"
                                    style="color:#a98b51;text-decoration:none;"
                                  >
                                    Privacy Policy
                                  </a>
                                `
                                : ''
                            }
                          </div>
                        `
                        : ''
                    }
                  </td>

                  <td
                    width="45"
                    valign="middle"
                    align="right"
                  >
                    <img
                      src="${EQUAL_HOUSING_LOGO_URL}"
                      alt="Equal Housing Opportunity"
                      width="28"
                      style="display:block;width:28px;height:auto;margin-left:auto;border:0;"
                    />

                    <div
                      style="margin-top:2px;font-size:5px;line-height:1.1;text-align:center;color:#898075;"
                    >
                      Equal Housing
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

export function buildMarketingContactText(
  profile:
    MarketingIdentityForEmail
) {
  const displayName =
    profile
      .marketing_from_name
      ?.trim() ||
    'Real Estate Professional';

  const titleLine = [
    profile
      .marketing_title
      ?.trim(),
    profile
      .marketing_brokerage
      ?.trim(),
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
  ]
    .filter(Boolean)
    .join(' • ');

  const phone =
    profile
      .marketing_phone
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

  const agentLicense =
    profile
      .marketing_license_number
      ?.trim() ||
    '';

  const address =
    profile
      .marketing_physical_address
      ?.trim() ||
    profile
      .marketing_office_address
      ?.trim() ||
    '';

  const business =
    profile
      .marketing_licensed_business_name
      ?.trim() ||
    profile
      .marketing_brokerage
      ?.trim() ||
    '';

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

  return [
    displayName,
    titleLine,
    credentials,
    phone,
    email,
    website,
    agentLicense
      ? `Agent License: ${agentLicense}`
      : '',
    address,
    business,
    brokerLicense
      ? `Brokerage License: ${brokerLicense}`
      : '',
    profile
      .marketing_standard_disclaimer
      ?.trim() ||
      DEFAULT_PROPERTY_DISCLAIMER,
    profile
      .marketing_privacy_policy_url
      ?.trim()
      ? `Privacy: ${profile.marketing_privacy_policy_url.trim()}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}
