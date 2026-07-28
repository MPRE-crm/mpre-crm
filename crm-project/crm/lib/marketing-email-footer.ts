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

  brokerage_logo_url?:
    | string
    | null;

  brokerage_office_address?:
    | string
    | null;

  brokerage_compliance_mailing_address?:
    | string
    | null;

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

export type MarketingSocialSurface =
  | 'light'
  | 'dark';

function socialLinks(
  profile:
    MarketingIdentityForEmail,
  surface:
    MarketingSocialSurface =
      'dark'
) {
  const links: Array<{
    label: string;
    url: string | null;
    lightIconUrl: string;
    darkIconUrl: string;
  }> = [
    {
      label: 'Facebook',
      url:
        profile
          .marketing_facebook_url,
      lightIconUrl:
        'https://img.icons8.com/color/96/facebook-new.png',
      darkIconUrl:
        'https://img.icons8.com/ios-filled/96/ffffff/facebook-new.png',
    },
    {
      label: 'Instagram',
      url:
        profile
          .marketing_instagram_url,
      lightIconUrl:
        'https://img.icons8.com/color/96/instagram-new--v1.png',
      darkIconUrl:
        'https://img.icons8.com/ios-filled/96/ffffff/instagram-new--v1.png',
    },
    {
      label: 'LinkedIn',
      url:
        profile
          .marketing_linkedin_url,
      lightIconUrl:
        'https://img.icons8.com/color/96/linkedin.png',
      darkIconUrl:
        'https://img.icons8.com/ios-filled/96/ffffff/linkedin.png',
    },
    {
      label: 'YouTube',
      url:
        profile
          .marketing_youtube_url,
      lightIconUrl:
        'https://img.icons8.com/color/96/youtube-play.png',
      darkIconUrl:
        'https://img.icons8.com/ios-filled/96/ffffff/youtube-play.png',
    },
    {
      label: 'TikTok',
      url:
        profile
          .marketing_tiktok_url,
      lightIconUrl:
        'https://img.icons8.com/color/96/tiktok--v1.png',
      darkIconUrl:
        'https://img.icons8.com/ios-filled/96/ffffff/tiktok--v1.png',
    },
    {
      label: 'X',
      url:
        profile
          .marketing_x_url,
      lightIconUrl:
        'https://img.icons8.com/ios-filled/96/000000/twitterx--v2.png',
      darkIconUrl:
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

              const iconUrl =
                surface === 'light'
                  ? item.lightIconUrl
                  : item.darkIconUrl;

              return `
                <td
                  style="padding-right:10px;"
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
                        iconUrl
                      )}"
                      alt="${escapeHtml(
                        item.label
                      )}"
                      width="26"
                      height="26"
                      style="display:block;width:26px;height:26px;margin:2px;border:0;"
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

export function buildMarketingSocialLinksHtml(
  profile:
    MarketingIdentityForEmail,
  surface:
    MarketingSocialSurface =
      'light'
) {
  return socialLinks(
    profile,
    surface
  );
}

export type MarketingComplianceLinks = {
  preferences_url?:
    | string
    | null;

  unsubscribe_url?:
    | string
    | null;
};

export function buildMarketingBrandLogosHtml(
  profile:
    MarketingIdentityForEmail
) {
  const displayName =
    profile
      .marketing_from_name
      ?.trim() ||
    'Real Estate Professional';

  const businessName =
    profile
      .marketing_licensed_business_name
      ?.trim() ||
    profile
      .marketing_brokerage
      ?.trim() ||
    'Real Estate Brokerage';

  const teamLogoUrl =
    'https://easyrealtor.homes/MPREcrm.png';

  const brokerageLogoUrl =
    profile
      .brokerage_logo_url
      ?.trim() ||
    profile
      .marketing_logo_url
      ?.trim() ||
    'https://easyrealtor.homes/HomesofIdahocrm.png';

  const logoItems = [
    {
      url:
        teamLogoUrl,
      alt:
        `${displayName} team logo`,
    },
    {
      url:
        brokerageLogoUrl,
      alt:
        `${businessName} brokerage logo`,
    },
  ]
    .filter(
      (item) =>
        Boolean(
          item.url
        )
    )
    .filter(
      (
        item,
        index,
        items
      ) =>
        items.findIndex(
          (candidate) =>
            candidate.url ===
            item.url
        ) === index
    );

  if (
    logoItems.length === 0
  ) {
    return '';
  }

  return `
    <table
      role="presentation"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="margin:18px 0 14px;"
    >
      <tr>
        ${logoItems
          .map(
            (item) => `
              <td
                valign="middle"
                style="padding:0 24px 8px 0;"
              >
                <img
                  src="${escapeHtml(
                    item.url
                  )}"
                  alt="${escapeHtml(
                    item.alt
                  )}"
                  style="display:block;max-width:175px;max-height:64px;width:auto;height:auto;border:0;"
                />
              </td>
            `
          )
          .join('')}
      </tr>
    </table>
  `;
}

export function buildMarketingComplianceFooterHtml(
  profile:
    MarketingIdentityForEmail,
  links:
    MarketingComplianceLinks = {}
) {
  const business =
    profile
      .marketing_licensed_business_name
      ?.trim() ||
    profile
      .marketing_brokerage
      ?.trim() ||
    'Licensed Real Estate Brokerage';

  const address =
    profile
      .marketing_physical_address
      ?.trim() ||
    profile
      .brokerage_compliance_mailing_address
      ?.trim() ||
    profile
      .brokerage_office_address
      ?.trim() ||
    profile
      .marketing_office_address
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

  const advertisement =
    profile
      .marketing_advertisement_label
      ?.trim() ||
    'Advertisement';

  const standardDisclaimer =
    profile
      .marketing_standard_disclaimer
      ?.trim() ||
    DEFAULT_PROPERTY_DISCLAIMER;

  const personalDisclaimer =
    profile
      .marketing_disclaimer
      ?.trim() ||
    '';

  const mlsAttribution =
    profile
      .marketing_mls_attribution
      ?.trim() ||
    '';

  const privacyUrl =
    profile
      .marketing_privacy_policy_url
      ?.trim() ||
    '';

  const preferencesUrl =
    links
      .preferences_url
      ?.trim() ||
    '';

  const unsubscribeUrl =
    links
      .unsubscribe_url
      ?.trim() ||
    '';

  const footerLinks = [
    preferencesUrl
      ? `
        <a
          href="${escapeHtml(
            preferencesUrl
          )}"
          style="color:#475569;text-decoration:underline;"
        >Email preferences</a>
      `
      : '',
    unsubscribeUrl
      ? `
        <a
          href="${escapeHtml(
            unsubscribeUrl
          )}"
          style="color:#475569;text-decoration:underline;"
        >Unsubscribe</a>
      `
      : '',
    privacyUrl
      ? `
        <a
          href="${escapeHtml(
            webUrl(
              privacyUrl
            )
          )}"
          style="color:#475569;text-decoration:underline;"
        >Privacy Policy</a>
      `
      : '',
  ].filter(Boolean);

  const brandLogos =
    buildMarketingBrandLogosHtml(
      profile
    );

  return `
    <div
      style="margin-top:28px;padding-top:18px;border-top:1px solid #dbe3ec;font-family:Arial,Helvetica,sans-serif;color:#64748b;"
    >
      ${brandLogos}

      <div
        style="font-size:10px;line-height:1.55;color:#475569;"
      >
        <strong>${escapeHtml(
          advertisement
        )}</strong>

        &middot;

        ${escapeHtml(
          business
        )}

        ${
          address
            ? `
              &middot;
              ${escapeHtml(
                address
              )}
            `
            : ''
        }
      </div>

      ${
        brokerLicense
          ? `
            <div
              style="margin-top:4px;font-size:9px;line-height:1.5;color:#64748b;"
            >
              Brokerage license:
              ${escapeHtml(
                brokerLicense
              )}
            </div>
          `
          : ''
      }

      <div
        style="margin-top:8px;font-size:8px;line-height:1.55;color:#7c8798;"
      >
        ${escapeHtml(
          standardDisclaimer
        )}

        ${
          personalDisclaimer &&
          personalDisclaimer !==
            standardDisclaimer
            ? `
              ${escapeHtml(
                personalDisclaimer
              )}
            `
            : ''
        }

        easyrealtor.homes is a technology platform and is not the real-estate brokerage representing this property.
      </div>

      ${
        mlsAttribution
          ? `
            <div
              style="margin-top:5px;font-size:8px;line-height:1.5;color:#7c8798;"
            >
              ${escapeHtml(
                mlsAttribution
              )}
            </div>
          `
          : ''
      }

      ${
        footerLinks.length
          ? `
            <div
              style="margin-top:8px;font-size:9px;line-height:1.5;color:#64748b;"
            >
              ${footerLinks.join(
                ' &middot; '
              )}
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
        style="margin-top:14px;"
      >
        <tr>
          <td
            valign="middle"
          >
            <img
              src="${PLATFORM_LOGO_URL}"
              alt="easyRealtor"
              width="105"
              style="display:block;width:105px;height:auto;border:0;"
            />
          </td>

          <td
            valign="middle"
            align="right"
          >
            <img
              src="${EQUAL_HOUSING_LOGO_URL}"
              alt="Equal Housing Opportunity"
              width="28"
              style="display:block;width:28px;height:auto;margin-left:auto;border:0;"
            />
          </td>
        </tr>
      </table>
    </div>
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
