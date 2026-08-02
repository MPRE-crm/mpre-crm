'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import {
  Check,
  ChevronLeft,
  Download,
  Loader2,
  Printer,
  Save,
} from 'lucide-react';

import type {
  CanvaFlyerCopy,
  CanvaFlyerStatus,
} from '../../../../lib/listing-canva-marketing-package';

type LuxuryFlyerListing = {
  id: string;
  title: string;
  property_address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  mls_number: string | null;
  list_price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  acres: number | null;
  garage_spaces: number | null;
  year_built: number | null;
  lot_size_text: string | null;
};

type LuxuryFlyerPhoto = {
  label: string;
  url: string;
};

type MarketingBrand = {
  name: string | null;
  logo_url: string | null;
};

type LuxuryFlyerIdentity = {
  profile: {
    marketing_from_name: string | null;
    marketing_from_email: string | null;
    marketing_phone: string | null;
    marketing_title: string | null;
    marketing_website_url: string | null;
    marketing_license_number: string | null;
    marketing_headshot_url: string | null;
    marketing_logo_url: string | null;
    marketing_signature_image_url: string | null;
  };
  branding: {
    personal: MarketingBrand;
    organization: MarketingBrand;
    brokerage: MarketingBrand;
  };
  compliance: {
    advertisement_label: string | null;
    standard_disclaimer: string | null;
    mls_attribution: string | null;
    broker_license_number: string | null;
    public_office_address: string | null;
  };
};

type Props = {
  listing: LuxuryFlyerListing;
  copy: CanvaFlyerCopy;
  photos: LuxuryFlyerPhoto[];
  qrCodeDataUrl: string;
  qrPublicUrl:
    | string
    | null;
  identity: LuxuryFlyerIdentity | null;
  identityLoading: boolean;
  issues: string[];
  status: CanvaFlyerStatus;
  saving: boolean;
  saveDisabled: boolean;
  approvalDisabled: boolean;
  onBack: () => void;
  onSave: () => Promise<boolean>;
  onApprove: () => Promise<boolean>;
};

type SvgTextProps = {
  value: string;
  x: number;
  y: number;
  maximumCharacters: number;
  maximumLines: number;
  fontSize: number;
  lineHeight: number;
  fill: string;
  fontFamily: string;
  fontWeight?: number | string;
  textAnchor?: 'start' | 'middle' | 'end';
  letterSpacing?: number;
};

const WIDTH = 2550;
const HEIGHT = 3300;

const BLACK = '#0f172a';
const SOFT_BLACK = '#0f172a';
const IVORY = '#f4efe6';
const WHITE = '#ffffff';
const GOLD = '#c7a35a';
const PALE_GOLD = '#e7d6ad';
const MUTED = '#b7b1a8';
const INK = '#171717';

function cleanText(value: string | null | undefined) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function wrapLines(
  input: string,
  maximumCharacters: number,
  maximumLines: number
) {
  const value = cleanText(input);

  if (!value) {
    return [];
  }

  const words = value.split(' ');
  const lines: string[] = [];
  let current = '';
  let wordIndex = 0;

  for (
    wordIndex = 0;
    wordIndex < words.length;
    wordIndex += 1
  ) {
    const word = words[wordIndex];
    const candidate = current
      ? `${current} ${word}`
      : word;

    if (
      candidate.length <= maximumCharacters ||
      !current
    ) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = word;

    if (lines.length === maximumLines) {
      break;
    }
  }

  if (
    current &&
    lines.length < maximumLines
  ) {
    lines.push(current);
  }

  const truncated =
    wordIndex < words.length - 1 ||
    lines.length > maximumLines;

  const result = lines.slice(0, maximumLines);

  if (
    truncated &&
    result.length > 0
  ) {
    const lastIndex = result.length - 1;

    result[lastIndex] =
      `${result[lastIndex]
        .replace(/[\s,.;:!?-]+$/, '')
        .slice(
          0,
          Math.max(
            1,
            maximumCharacters - 1
          )
        )}…`;
  }

  return result;
}

function wrapAllLines(
  input: string,
  maximumCharacters: number
) {
  return wrapLines(
    input,
    maximumCharacters,
    Number.MAX_SAFE_INTEGER
  );
}

function SvgText({
  value,
  x,
  y,
  maximumCharacters,
  maximumLines,
  fontSize,
  lineHeight,
  fill,
  fontFamily,
  fontWeight = 400,
  textAnchor = 'start',
  letterSpacing,
}: SvgTextProps) {
  const lines = wrapLines(
    value,
    maximumCharacters,
    maximumLines
  );

  if (lines.length === 0) {
    return null;
  }

  return (
    <text
      x={x}
      y={y}
      fill={fill}
      fontFamily={fontFamily}
      fontSize={fontSize}
      fontWeight={fontWeight}
      textAnchor={textAnchor}
      letterSpacing={letterSpacing}
    >
      {lines.map((line, index) => (
        <tspan
          key={`${line}-${index}`}
          x={x}
          dy={
            index === 0
              ? 0
              : lineHeight
          }
        >
          {line}
        </tspan>
      ))}
    </text>
  );
}

function PhotoFrame({
  url,
  label,
  x,
  y,
  width,
  height,
  clipId,
  border = false,
}: {
  url: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  clipId: string;
  border?: boolean;
}) {
  return (
    <g>
      <title>{label}</title>
      <defs>
        <clipPath id={clipId}>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
          />
        </clipPath>
      </defs>

      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="#262626"
      />

      {url ? (
        <image
          href={url}
          x={x}
          y={y}
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
          crossOrigin="anonymous"
        />
      ) : (
        <text
          x={x + width / 2}
          y={y + height / 2}
          fill={MUTED}
          fontFamily="Arial, sans-serif"
          fontSize={28}
          fontWeight={700}
          textAnchor="middle"
        >
          PHOTO REQUIRED
        </text>
      )}

      {border && (
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill="none"
          stroke={GOLD}
          strokeWidth={5}
        />
      )}
    </g>
  );
}

type FactIconName =
  | 'bedrooms'
  | 'bathrooms'
  | 'square-feet'
  | 'acres'
  | 'garage'
  | 'year-built';

function FactIcon({
  x,
  y,
  icon,
}: {
  x: number;
  y: number;
  icon: FactIconName;
}) {
  return (
    <g
      transform={`translate(${x} ${y}) scale(1.18)`}
      fill="none"
      stroke={PALE_GOLD}
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icon === 'bedrooms' && (
        <>
          <path d="M3 29V9" />
          <path d="M3 23h34" />
          <path d="M8 23v-8h9c4 0 7 3 7 7v1" />
          <path d="M24 23V13h7c3 0 6 3 6 6v10" />
          <path d="M3 29v5M37 29v5" />
        </>
      )}

      {icon === 'bathrooms' && (
        <>
          <path d="M4 22h32" />
          <path d="M7 22v4c0 5 4 9 9 9h8c5 0 9-4 9-9v-4" />
          <path d="M10 22V10a6 6 0 0 1 12 0" />
          <path d="M20 10h6" />
        </>
      )}

      {icon === 'square-feet' && (
        <>
          <rect x={6} y={6} width={28} height={28} rx={2} />
          <path d="M12 18v-6h6M28 22v6h-6" />
          <path d="M12 12l8 8M28 28l-8-8" />
        </>
      )}

      {icon === 'acres' && (
        <>
          <path d="M5 10l10-4 10 4 10-4v25l-10 4-10-4-10 4z" />
          <path d="M15 6v25M25 10v25" />
        </>
      )}

      {icon === 'garage' && (
        <>
          <path d="M4 18L20 6l16 12" />
          <path d="M7 17v18h26V17" />
          <rect x={12} y={22} width={16} height={13} rx={1} />
          <path d="M12 27h16M12 31h16" />
        </>
      )}

      {icon === 'year-built' && (
        <>
          <rect x={5} y={8} width={30} height={27} rx={3} />
          <path d="M12 5v7M28 5v7M5 15h30" />
          <path d="M12 22h4M21 22h4M12 28h4M21 28h4" />
        </>
      )}
    </g>
  );
}

function FactItem({
  x,
  y,
  value,
  label,
  icon,
}: {
  x: number;
  y: number;
  value: string;
  label: string;
  icon: FactIconName;
}) {
  return (
    <g>
      <FactIcon
        x={x}
        y={y - 42}
        icon={icon}
      />

      <text
        x={x + 62}
        y={y}
        fill={WHITE}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize={70}
        fontWeight={700}
      >
        {value}
      </text>

      <text
        x={x + 62}
        y={y + 54}
        fill={PALE_GOLD}
        fontFamily="Arial, sans-serif"
        fontSize={28}
        fontWeight={700}
        letterSpacing={1.4}
      >
        {label}
      </text>
    </g>
  );
}

function BrandMark({
  x,
  y,
  width,
  height,
  name,
  url,
  imagePadding = 22,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  url: string;
  imagePadding?: number;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={18}
        fill={IVORY}
      />

      {url ? (
        <image
          href={url}
          x={x + imagePadding}
          y={y + imagePadding}
          width={width - imagePadding * 2}
          height={height - imagePadding * 2}
          preserveAspectRatio="xMidYMid meet"
          crossOrigin="anonymous"
        />
      ) : (
        <SvgText
          value={name}
          x={x + width / 2}
          y={y + height * 0.58}
          maximumCharacters={22}
          maximumLines={2}
          fontSize={30}
          lineHeight={34}
          fill={INK}
          fontFamily="Georgia, 'Times New Roman', serif"
          fontWeight={700}
          textAnchor="middle"
        />
      )}
    </g>
  );
}

function blobAsDataUrl(blob: Blob) {
  return new Promise<string>(
    (resolve, reject) => {
      const reader = new FileReader();

      reader.addEventListener(
        'load',
        () => {
          if (
            typeof reader.result === 'string' &&
            reader.result
          ) {
            resolve(reader.result);
            return;
          }

          reject(
            new Error(
              'An image could not be encoded for export.'
            )
          );
        }
      );

      reader.addEventListener(
        'error',
        () =>
          reject(
            new Error(
              'An image could not be read for export.'
            )
          )
      );

      reader.readAsDataURL(blob);
    }
  );
}

function normalizeFooterLogoSource(
  source: string
) {
  const normalizedSource =
    source.trim();

  if (
    /(?:^|\/)MPREcrm\.png(?:[?#].*)?$/i.test(
      normalizedSource
    )
  ) {
    return '/MPREcrm.png';
  }

  if (
    /(?:^|\/)HomesofIdahocrm\.png(?:[?#].*)?$/i.test(
      normalizedSource
    )
  ) {
    return '/HomesofIdahocrm.png';
  }

  return normalizedSource;
}

function useEmbeddedImage(
  source: string
) {
  const [state, setState] =
    useState({
      source: '',
      dataUrl: '',
      loading: false,
    });

  useEffect(() => {
    const normalizedSource =
      source.trim();

    const controller =
      new AbortController();

    let active = true;

    if (!normalizedSource) {
      setState({
        source: '',
        dataUrl: '',
        loading: false,
      });

      return () => {
        active = false;
        controller.abort();
      };
    }

    if (
      normalizedSource.startsWith(
        'data:'
      )
    ) {
      setState({
        source: normalizedSource,
        dataUrl: normalizedSource,
        loading: false,
      });

      return () => {
        active = false;
        controller.abort();
      };
    }

    setState({
      source: normalizedSource,
      dataUrl: '',
      loading: true,
    });

    void (async () => {
      try {
        const response = await fetch(
          normalizedSource,
          {
            credentials: 'omit',
            cache: 'force-cache',
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            'The footer logo could not be loaded.'
          );
        }

        const dataUrl =
          await blobAsDataUrl(
            await response.blob()
          );

        if (!active) {
          return;
        }

        setState({
          source: normalizedSource,
          dataUrl,
          loading: false,
        });
      } catch (error: unknown) {
        if (
          !active ||
          (
            error instanceof Error &&
            error.name === 'AbortError'
          )
        ) {
          return;
        }

        setState({
          source: normalizedSource,
          dataUrl: '',
          loading: false,
        });
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [source]);

  const normalizedSource =
    source.trim();

  if (
    state.source !==
    normalizedSource
  ) {
    return {
      dataUrl: '',
      loading: Boolean(
        normalizedSource
      ),
    };
  }

  return {
    dataUrl: state.dataUrl,
    loading: state.loading,
  };
}

async function inlineSvgImages(
  svg: SVGSVGElement
) {
  const images = Array.from(
    svg.querySelectorAll('image')
  );

  await Promise.all(
    images.map(async (image) => {
      const href =
        image.getAttribute('href') || '';

      if (
        !href ||
        href.startsWith('data:')
      ) {
        return;
      }

      const response = await fetch(
        href,
        {
          credentials: 'omit',
          cache: 'force-cache',
        }
      );

      if (!response.ok) {
        throw new Error(
          `A required Flyer image could not be loaded (${response.status}).`
        );
      }

      const dataUrl = await blobAsDataUrl(
        await response.blob()
      );

      image.setAttribute(
        'href',
        dataUrl
      );
    })
  );
}

function loadImage(source: string) {
  return new Promise<HTMLImageElement>(
    (resolve, reject) => {
      const image = new Image();

      image.addEventListener(
        'load',
        () => resolve(image)
      );

      image.addEventListener(
        'error',
        () =>
          reject(
            new Error(
              'The Flyer preview could not be rasterized.'
            )
          )
      );

      image.src = source;
    }
  );
}

function canvasPng(
  canvas: HTMLCanvasElement
) {
  return new Promise<Blob>(
    (resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (
            !blob ||
            blob.size === 0
          ) {
            reject(
              new Error(
                'The Flyer PNG export was empty.'
              )
            );
            return;
          }

          resolve(blob);
        },
        'image/png',
        1
      );
    }
  );
}

function safeFileName(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) ||
    'listing'
  );
}

async function serializedSvg(
  svg: SVGSVGElement
) {
  const clone = svg.cloneNode(
    true
  ) as SVGSVGElement;

  clone.setAttribute(
    'width',
    String(WIDTH)
  );
  clone.setAttribute(
    'height',
    String(HEIGHT)
  );
  clone.setAttribute(
    'xmlns',
    'http://www.w3.org/2000/svg'
  );

  await inlineSvgImages(clone);

  return new XMLSerializer()
    .serializeToString(clone);
}

async function downloadPng(
  svg: SVGSVGElement,
  filename: string
) {
  const serialized =
    await serializedSvg(svg);

  const svgBlob = new Blob(
    [serialized],
    {
      type:
        'image/svg+xml;charset=utf-8',
    }
  );

  const svgUrl =
    URL.createObjectURL(svgBlob);

  try {
    const image = await loadImage(
      svgUrl
    );

    const canvas =
      document.createElement('canvas');

    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    const context =
      canvas.getContext('2d');

    if (!context) {
      throw new Error(
        'This browser could not create the Flyer PNG.'
      );
    }

    context.drawImage(
      image,
      0,
      0,
      WIDTH,
      HEIGHT
    );

    const png = await canvasPng(
      canvas
    );

    const pngUrl =
      URL.createObjectURL(png);

    try {
      const link =
        document.createElement('a');

      link.href = pngUrl;
      link.download = filename;
      link.rel = 'noopener';

      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      URL.revokeObjectURL(pngUrl);
    }
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

async function printFlyer(
  svg: SVGSVGElement,
  title: string
) {
  const printWindow = window.open(
    '',
    '_blank'
  );

  if (!printWindow) {
    throw new Error(
      'The browser blocked the print window. Allow pop-ups and try again.'
    );
  }

  printWindow.opener = null;

  try {
    const serialized =
      await serializedSvg(svg);

    printWindow.document.open();

    printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page {
      size: Letter portrait;
      margin: 0;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
    }

    .sheet {
      width: 8.5in;
      height: 11in;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    svg {
      display: block;
      width: 8.5in;
      height: 11in;
    }
  </style>
</head>
<body>
  <div class="sheet">${serialized}</div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () {
        window.focus();
        window.print();
      }, 200);
    });
  </script>
</body>
</html>`);

    printWindow.document.close();
  } catch (error) {
    printWindow.close();
    throw error;
  }
}

function statusLabel(
  status: CanvaFlyerStatus
) {
  const labels:
    Record<
      CanvaFlyerStatus,
      string
    > = {
      not_started:
        'Not Started',
      editing:
        'Editing',
      ready_for_review:
        'Ready for Review',
      approved:
        'Approved',
      exported:
        'Exported',
      printed:
        'Printed',
    };

  return labels[status];
}

export default function ListingLuxuryBlackWhiteFlyerPreview({
  listing,
  copy,
  photos,
  qrCodeDataUrl,
  qrPublicUrl,
  identity,
  identityLoading,
  issues,
  status,
  saving,
  saveDisabled,
  approvalDisabled,
  onBack,
  onSave,
  onApprove,
}: Props) {
  const svgRef =
    useRef<SVGSVGElement | null>(
      null
    );

  const generatedId = useId()
    .replace(/:/g, '');

  const [
    failedSignatureUrl,
    setFailedSignatureUrl,
  ] = useState<string | null>(
    null
  );

  const [
    activeAction,
    setActiveAction,
  ] =
    useState<
      | 'png'
      | 'print'
      | 'save'
      | 'approve'
      | null
    >(null);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const [
    notice,
    setNotice,
  ] =
    useState<string | null>(
      null
    );

  const hero =
    photos[0]?.url || '';

  const supportingPhotos = [
    photos[1],
    photos[2],
    photos[3],
    photos[4],
  ];

  const address =
    cleanText(
      listing.property_address
    ) ||
    cleanText(listing.title);

  const cityLine = [
    cleanText(listing.city),
    cleanText(listing.state),
  ]
    .filter(Boolean)
    .join(', ');

  const locality = [
    cityLine,
    cleanText(listing.zip),
  ]
    .filter(Boolean)
    .join(' ');

  const mlsNumber =
    cleanText(listing.mls_number);

  const currentListingPrice =
    typeof listing.list_price ===
      'number'
      ? listing.list_price
          .toLocaleString(
            'en-US',
            {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits:
                0,
            }
          )
      : '';

  const price =
    currentListingPrice ||
    cleanText(copy.price_line);

  const description =
    cleanText(
      copy.public_description
    ) ||
    cleanText(
      copy.short_description
    );

  const descriptionTop = 2070;
  const descriptionBottom = 2460;

  const descriptionLayoutCandidates = [
    {
      fontSize: 36,
      lineHeight: 45,
      maximumCharacters: 112,
    },
    {
      fontSize: 34,
      lineHeight: 42,
      maximumCharacters: 120,
    },
    {
      fontSize: 32,
      lineHeight: 40,
      maximumCharacters: 128,
    },

  ] as const;

  const descriptionLayout =
    descriptionLayoutCandidates.find(
      (candidate) => {
        const lineCount =
          wrapAllLines(
            description,
            candidate.maximumCharacters
          ).length;

        const renderedHeight =
          lineCount > 0
            ? candidate.fontSize +
              Math.max(
                0,
                lineCount - 1
              ) * candidate.lineHeight
            : 0;

        return (
          renderedHeight <=
          descriptionBottom - descriptionTop
        );
      }
    ) || {
      fontSize: 32,
      lineHeight: 40,
      maximumCharacters: 128,
    };

  const descriptionLines =
    wrapAllLines(
      description,
      descriptionLayout.maximumCharacters
    );

  const headline =
    cleanText(copy.headline) ||
    'Exceptional living, beautifully presented.';

  const features =
    copy.feature_bullets
      .map(cleanText)
      .filter(Boolean)
      .slice(0, 6);

  const descriptionRenderedHeight =
    descriptionLines.length > 0
      ? descriptionLayout.fontSize +
        Math.max(
          0,
          descriptionLines.length - 1
        ) *
          descriptionLayout.lineHeight
      : 0;

  const highlightsTitleY =
    descriptionTop +
    descriptionRenderedHeight +
    55;

  const highlightsGridY =
    highlightsTitleY + 55;

  const highlightRowSpacing = 82;
  const highlightFontSize = 30;
  const highlightLineHeight = 37;

  const visibleFeatures =
    features.slice(0, 4);

  const agentName =
    cleanText(
      identity?.profile
        .marketing_from_name
    ) ||
    cleanText(
      identity?.branding
        .personal.name
    ) ||
    'Listing Agent';

  const agentTitle =
    cleanText(
      identity?.profile
        .marketing_title
    ) ||
    'REALTOR®';

  const agentPhone =
    cleanText(
      identity?.profile
        .marketing_phone
    );

  const agentEmail =
    cleanText(
      identity?.profile
        .marketing_from_email
    );

  const agentWebsite =
    cleanText(
      identity?.profile
        .marketing_website_url
    );

  const agentWebsiteDisplay =
    agentWebsite
      .replace(
        /^https?:\/\/(?:www\.)?/i,
        ''
      )
      .replace(/\/+$/, '');

  const agentLicense =
    cleanText(
      identity?.profile
        .marketing_license_number
    );

  const headshot =
    cleanText(
      identity?.profile
        .marketing_headshot_url
    );

  const signatureImage =
    cleanText(
      identity?.profile
        .marketing_signature_image_url
    );

  const showSignatureImage =
    Boolean(
      signatureImage &&
        failedSignatureUrl !==
          signatureImage
    );

  const organizationName =
    cleanText(
      identity?.branding
        .organization.name
    ) ||
    'MPRE';

  const normalizedAgentTitle =
    /^realtor(?:®)?$/i.test(
      agentTitle
    )
      ? 'REALTOR®'
      : agentTitle;

  const agentDisplayTitle =
    [
      normalizedAgentTitle,
      organizationName,
    ]
      .filter(Boolean)
      .join(' | ');

  const organizationLogo =
    cleanText(
      identity?.branding
        .organization.logo_url
    );

  const brokerageName =
    cleanText(
      identity?.branding
        .brokerage.name
    ) ||
    'Homes of Idaho';

  const brokerageLogo =
    cleanText(
      identity?.branding
        .brokerage.logo_url
    );

  const organizationLogoSource =
    normalizeFooterLogoSource(
      organizationLogo
    );

  const brokerageLogoSource =
    normalizeFooterLogoSource(
      brokerageLogo
    );

  const organizationLogoImage =
    useEmbeddedImage(
      organizationLogoSource
    );

  const brokerageLogoImage =
    useEmbeddedImage(
      brokerageLogoSource
    );

  const footerLogosLoading =
    identityLoading ||
    organizationLogoImage.loading ||
    brokerageLogoImage.loading;

  const officeAddress =
    cleanText(
      identity?.compliance
        .public_office_address
    );

  const legalLine = [
    cleanText(
      identity?.compliance
        .advertisement_label
    ),
    cleanText(
      identity?.compliance
        .standard_disclaimer
    ),
    cleanText(
      identity?.compliance
        .mls_attribution
    ),
    cleanText(
      identity?.compliance
        .broker_license_number
    )
      ? `Broker License ${
          identity?.compliance
            .broker_license_number
        }`
      : '',
    officeAddress,
  ]
    .filter(Boolean)
    .join(' • ');

  const lotValue =
    typeof listing.acres ===
      'number' &&
    Number.isFinite(
      listing.acres
    )
      ? listing.acres
          .toLocaleString(
            'en-US',
            {
              maximumFractionDigits:
                3,
            }
          )
      : cleanText(
          listing.lot_size_text
        ) ||
        '—';

  const lotLabel =
    typeof listing.acres ===
      'number'
      ? 'ACRES'
      : 'LOT';

  const filename =
    `${safeFileName(
      address
    )}-black-white-showcase-flyer.png`;

  const controlsBusy =
    saving ||
    activeAction !== null;

  const exportBusy =
    controlsBusy ||
    footerLogosLoading;

  async function runExport(
    action:
      | 'png'
      | 'print'
  ) {
    const svg = svgRef.current;

    if (!svg) {
      setError(
        'The Flyer preview is not ready.'
      );
      return;
    }

    setActiveAction(action);
    setError(null);
    setNotice(null);

    try {
      if (action === 'png') {
        await downloadPng(
          svg,
          filename
        );

        setNotice(
          'The finished Flyer PNG was downloaded.'
        );
      } else {
        await printFlyer(
          svg,
          `${address} Luxury Flyer`
        );

        setNotice(
          'The print window opened. Choose Save as PDF to create a PDF.'
        );
      }
    } catch (
      exportError: unknown
    ) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : 'The Flyer could not be exported.'
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function runSave(
    action:
      | 'save'
      | 'approve'
  ) {
    setActiveAction(action);
    setError(null);
    setNotice(null);

    try {
      const saved =
        action === 'approve'
          ? await onApprove()
          : await onSave();

      if (saved) {
        setNotice(
          action === 'approve'
            ? 'The Flyer is approved.'
            : 'The Flyer is saved and ready for review.'
        );
      }
    } catch (
      saveError: unknown
    ) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'The Flyer could not be saved.'
      );
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-950">
            Review Finished Luxury Flyer
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-600">
            Your selected photos, listing wording, agent identity, MPRE branding,
            brokerage branding, and required advertising language are placed
            into the native Black &amp; White Showcase flyer.
          </p>
        </div>

        <span className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-black text-violet-800">
          {statusLabel(status)}
        </span>
      </div>

      {identityLoading && (
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900">
          Checking Flyer branding and advertising requirements...
        </div>
      )}

      {!identityLoading &&
        issues.length > 0 && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-sm font-bold text-amber-950">
              Complete these items before approval:
            </div>

            <ul className="mt-2 space-y-1 text-sm leading-6 text-amber-900">
              {issues.map(
                (issue) => (
                  <li key={issue}>
                    • {issue}
                  </li>
                )
              )}
            </ul>
          </div>
        )}

      {!identityLoading &&
        issues.length === 0 && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">
            The finished Flyer is ready for review and approval.
          </div>
        )}

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-300 bg-slate-950 shadow-2xl">
        <svg
          ref={svgRef}
          role="img"
          aria-label={`Luxury Black and White Showcase Flyer for ${address}`}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          xmlns="http://www.w3.org/2000/svg"
          className="h-auto w-full"
          style={{
            aspectRatio:
              `${WIDTH} / ${HEIGHT}`,
          }}
        >
          <defs>
            <linearGradient
              id={`${generatedId}-hero-fade`}
              x1="0"
              y1="0"
              x2="1"
              y2="0"
            >
              <stop
                offset="0%"
                stopColor={BLACK}
                stopOpacity="0.98"
              />
              <stop
                offset="69%"
                stopColor={BLACK}
                stopOpacity="0.88"
              />
              <stop
                offset="100%"
                stopColor={BLACK}
                stopOpacity="0"
              />
            </linearGradient>

            <clipPath
              id={`${generatedId}-headshot`}
            >
              <circle
                cx={1830}
                cy={2310}
                r={108}
              />
            </clipPath>
          </defs>

          <rect
            x={0}
            y={0}
            width={WIDTH}
            height={HEIGHT}
            fill={IVORY}
          />

          <PhotoFrame
            url={hero}
            label="Main Exterior"
            x={0}
            y={0}
            width={WIDTH}
            height={1320}
            clipId={`${generatedId}-hero`}
          />

          <rect
            x={0}
            y={0}
            width={1220}
            height={1320}
            fill={`url(#${generatedId}-hero-fade)`}
          />

          <path
            d="M 0 0 H 760 L 1038 1320 H 0 Z"
            fill={BLACK}
            opacity={0.95}
          />

          <line
            x1={138}
            y1={120}
            x2={560}
            y2={120}
            stroke={GOLD}
            strokeWidth={8}
          />

          <text
            x={138}
            y={210}
            fill={GOLD}
            fontFamily="Arial, sans-serif"
            fontSize={46}
            fontWeight={800}
            letterSpacing={8}
          >
            FOR SALE
          </text>

          <text
            x={138}
            y={310}
            fill={WHITE}
            fontFamily="Arial, sans-serif"
            fontSize={31}
            fontWeight={700}
            letterSpacing={3}
          >
            DISTINCTIVE PROPERTY COLLECTION
          </text>

          <SvgText
            value={address}
            x={138}
            y={440}
            maximumCharacters={20}
            maximumLines={2}
            fontSize={120}
            lineHeight={124}
            fill={WHITE}
            fontFamily="Georgia, 'Times New Roman', serif"
            fontWeight={700}
          />

          <text
            x={140}
            y={525}
            fill={PALE_GOLD}
            fontFamily="Arial, sans-serif"
            fontSize={30}
            fontWeight={700}
            letterSpacing={3.8}
          >
            {locality.toUpperCase()}
          </text>

          {mlsNumber && (
            <text
              x={140}
              y={575}
              fill={PALE_GOLD}
              fontFamily="Arial, sans-serif"
              fontSize={23}
              fontWeight={700}
              letterSpacing={2.2}
            >
              {`MLS #${mlsNumber}`.toUpperCase()}
            </text>
          )}

          <text
            x={138}
            y={720}
            fill={GOLD}
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize={104}
            fontWeight={700}
          >
            {price}
          </text>

          <line
            x1={138}
            y1={795}
            x2={900}
            y2={795}
            stroke="#4d463a"
            strokeWidth={4}
          />

          <FactItem
            x={138}
            y={875}
            value={
              typeof listing.bedrooms ===
                'number'
                ? String(
                    listing.bedrooms
                  )
                : '—'
            }
            label="BEDROOMS"
            icon="bedrooms"
          />

          <FactItem
            x={470}
            y={875}
            value={
              typeof listing.bathrooms ===
                'number'
                ? String(
                    listing.bathrooms
                  )
                : '—'
            }
            label="BATHROOMS"
            icon="bathrooms"
          />

          <FactItem
            x={138}
            y={1040}
            value={
              typeof listing.square_feet ===
                'number'
                ? listing.square_feet
                    .toLocaleString(
                      'en-US'
                    )
                : '—'
            }
            label="SQUARE FEET"
            icon="square-feet"
          />

          <FactItem
            x={470}
            y={1040}
            value={lotValue}
            label={lotLabel}
            icon="acres"
          />

          <FactItem
            x={138}
            y={1205}
            value={
              typeof listing.garage_spaces ===
                'number'
                ? String(
                    listing.garage_spaces
                  )
                : '—'
            }
            label="GARAGE SPACES"
            icon="garage"
          />

          <FactItem
            x={470}
            y={1205}
            value={
              typeof listing.year_built ===
                'number'
                ? String(
                    listing.year_built
                  )
                : '—'
            }
            label="YEAR BUILT"
            icon="year-built"
          />

          <g
            aria-label="Listing website QR code"
            transform="translate(1540 -30)"
          >
            <rect
              x={55}
              y={990}
              width={930}
              height={355}
              rx={28}
              fill={BLACK}
              fillOpacity={0.9}
              stroke={GOLD}
              strokeWidth={4}
            />

            <rect
              x={95}
              y={1035}
              width={270}
              height={270}
              rx={18}
              fill={WHITE}
              stroke={GOLD}
              strokeWidth={6}
            />

            {qrCodeDataUrl ? (
              <image
                href={
                  qrCodeDataUrl
                }
                x={110}
                y={1050}
                width={240}
                height={240}
                preserveAspectRatio="xMidYMid meet"
              />
            ) : (
              <text
                x={230}
                y={1188}
                fill={BLACK}
                fontFamily="Arial, sans-serif"
                fontSize={17}
                fontWeight={800}
                textAnchor="middle"
              >
                QR NOT ASSIGNED
              </text>
            )}

            <text
              x={405}
              y={1085}
              fill={GOLD}
              fontFamily="Arial, sans-serif"
              fontSize={36}
              fontWeight={800}
              letterSpacing={3.5}
            >
              SCAN FOR DETAILS
            </text>

            <text
              x={405}
              y={1152}
              fill={WHITE}
              fontFamily="Georgia, 'Times New Roman', serif"
              fontSize={52}
              fontWeight={700}
            >
              Property Website
            </text>

            <SvgText
              value={
                qrPublicUrl
                  ? 'Scan to explore complete photos, property video, nearby schools, and full property details.'
                  : 'Assign a reusable QR code to activate this flyer.'
              }
              x={405}
              y={1210}
              maximumCharacters={36}
              maximumLines={3}
              fontSize={28}
              lineHeight={34}
              fill={WHITE}
              fontFamily="Arial, sans-serif"
              fontWeight={500}
            />
          </g>
          <rect
            x={0}
            y={1320}
            width={WIDTH}
            height={460}
            fill={BLACK}
          />

          {supportingPhotos.map(
            (photo, index) => {
              const x =
                30 +
                index * 627;

              return (
                <g
                  key={`${photo?.label || 'photo'}-${index}`}
                >
                  <PhotoFrame
                    url={photo?.url || ''}
                    label={
                      photo?.label ||
                      `Supporting Photo ${index + 1}`
                    }
                    x={x}
                    y={1340}
                    width={609}
                    height={405}
                    clipId={`${generatedId}-support-${index}`}
                  />

                  <rect
                    x={x}
                    y={1340}
                    width={609}
                    height={7}
                    fill={GOLD}
                  />
                </g>
              );
            }
          )}

          <rect
            x={0}
            y={1780}
            width={WIDTH}
            height={980}
            fill={IVORY}
          />

          <text
            x={100}
            y={1850}
            fill={GOLD}
            fontFamily="Arial, sans-serif"
            fontSize={28}
            fontWeight={800}
            letterSpacing={6}
          >
            THE RESIDENCE
          </text>

          <SvgText
            value={headline}
            x={100}
            y={1930}
            maximumCharacters={39}
            maximumLines={2}
            fontSize={67}
            lineHeight={74}
            fill={INK}
            fontFamily="Georgia, 'Times New Roman', serif"
            fontWeight={700}
          />

          <SvgText
            value={description}
            x={100}
            y={2070}
            maximumCharacters={
              descriptionLayout
                .maximumCharacters
            }
            maximumLines={Math.max(
              descriptionLines.length,
              1
            )}
            fontSize={
              descriptionLayout.fontSize
            }
            lineHeight={
              descriptionLayout.lineHeight
            }
            fill="#3f3a34"
            fontFamily="Arial Narrow, Arial, sans-serif"
            fontWeight={500}
          />

          <text
            x={100}
            y={highlightsTitleY}
            fill={GOLD}
            fontFamily="Arial, sans-serif"
            fontSize={27}
            fontWeight={800}
            letterSpacing={4}
          >
            PROPERTY HIGHLIGHTS
          </text>

          {visibleFeatures.map(
            (feature, index) => {
              const column =
                index % 2;
              const row =
                Math.floor(
                  index / 2
                );
              const x =
                column === 0
                  ? 100
                  : 860;
              const y =
                highlightsGridY +
                row *
                  highlightRowSpacing;

              return (
                <g
                  key={`${feature}-${index}`}
                >
                  <circle
                    cx={x}
                    cy={y - 8}
                    r={6}
                    fill={GOLD}
                  />

                  <SvgText
                    value={feature}
                    x={x + 28}
                    y={y}
                    maximumCharacters={48}
                    maximumLines={2}
                    fontSize={highlightFontSize}
                    lineHeight={highlightLineHeight}
                    fill={INK}
                    fontFamily="Arial, sans-serif"
                    fontWeight={700}
                  />
                </g>
              );
            }
          )}

          <g transform="matrix(1.15 0 0 1.15 -250 -548)">
          {showSignatureImage ? (
            <g
              aria-label="Saved email signature"
            >
              <rect
                x={1650}
                y={2140}
                width={770}
                height={620}
                rx={30}
                fill={SOFT_BLACK}
              />

              <rect
                x={1650}
                y={2140}
                width={770}
                height={620}
                rx={30}
                fill="none"
                stroke={GOLD}
                strokeWidth={4}
              />

              <rect
                x={1680}
                y={2170}
                width={710}
                height={560}
                rx={22}
                fill={IVORY}
              />

              <image
                href={signatureImage}
                x={1710}
                y={2200}
                width={650}
                height={500}
                preserveAspectRatio="xMidYMid meet"
                crossOrigin="anonymous"
                onError={() =>
                  setFailedSignatureUrl(
                    signatureImage
                  )
                }
              />
            </g>
          ) : (
            <>
          <rect
            x={1650}
            y={2140}
            width={770}
            height={620}
            rx={30}
            fill={SOFT_BLACK}
          />

          <rect
            x={1650}
            y={2140}
            width={770}
            height={620}
            rx={30}
            fill="none"
            stroke={GOLD}
            strokeWidth={4}
          />

          <circle
            cx={1830}
            cy={2310}
            r={116}
            fill={IVORY}
            stroke={GOLD}
            strokeWidth={7}
          />

          {headshot ? (
            <image
              href={headshot}
              x={1722}
              y={2202}
              width={216}
              height={216}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#${generatedId}-headshot)`}
              crossOrigin="anonymous"
            />
          ) : (
            <text
              x={1830}
              y={2348}
              fill="#4c4c4c"
              fontFamily="Arial, sans-serif"
              fontSize={92}
              fontWeight={800}
              textAnchor="middle"
            >
              {agentName
                .slice(0, 1)
                .toUpperCase()}
            </text>
          )}

          <text
            x={1985}
            y={2208}
            fill={GOLD}
            fontFamily="Arial, sans-serif"
            fontSize={18}
            fontWeight={800}
            letterSpacing={4}
          >
            LISTED BY
          </text>

          <SvgText
            value={agentName}
            x={1985}
            y={2272}
            maximumCharacters={18}
            maximumLines={2}
            fontSize={44}
            lineHeight={47}
            fill={WHITE}
            fontFamily="Georgia, 'Times New Roman', serif"
            fontWeight={700}
          />

          <SvgText
            value={agentDisplayTitle}
            x={1985}
            y={2350}
            maximumCharacters={32}
            maximumLines={1}
            fontSize={20}
            lineHeight={24}
            fill={GOLD}
            fontFamily="Arial, sans-serif"
            fontWeight={800}
            letterSpacing={1.5}
          />

          <line
            x1={1735}
            y1={2460}
            x2={2335}
            y2={2460}
            stroke="#49443b"
            strokeWidth={2}
          />

          <g
            transform="translate(1745 2492)"
            fill="none"
            stroke={GOLD}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 4l6-2 5 10-4 3c3 6 7 10 13 13l3-4 10 5-2 6c-1 3-4 4-7 3C15 34 6 25 2 11 1 8 2 5 5 4z" />
          </g>

          <SvgText
            value={agentPhone}
            x={1805}
            y={2530}
            maximumCharacters={24}
            maximumLines={1}
            fontSize={31}
            lineHeight={35}
            fill={WHITE}
            fontFamily="Georgia, 'Times New Roman', serif"
            fontWeight={700}
          />

          <g
            transform="translate(1745 2570)"
            fill="none"
            stroke={GOLD}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x={2} y={4} width={36} height={27} rx={3} />
            <path d="M4 7l16 13L36 7" />
          </g>

          <SvgText
            value={agentEmail}
            x={1805}
            y={2605}
            maximumCharacters={40}
            maximumLines={1}
            fontSize={22}
            lineHeight={27}
            fill={WHITE}
            fontFamily="Arial, sans-serif"
            fontWeight={600}
          />

          <g
            transform="translate(1745 2638)"
            fill="none"
            stroke={GOLD}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx={20} cy={20} r={17} />
            <path d="M3 20h34M20 3c6 6 9 11 9 17s-3 12-9 17M20 3c-6 6-9 11-9 17s3 12 9 17" />
          </g>

          <SvgText
            value={agentWebsiteDisplay}
            x={1805}
            y={2675}
            maximumCharacters={36}
            maximumLines={1}
            fontSize={22}
            lineHeight={27}
            fill={WHITE}
            fontFamily="Arial, sans-serif"
            fontWeight={600}
          />

          <SvgText
            value={
              agentLicense
                ? `License ${agentLicense}`
                : ''
            }
            x={1805}
            y={2730}
            maximumCharacters={38}
            maximumLines={1}
            fontSize={18}
            lineHeight={22}
            fill={MUTED}
            fontFamily="Arial, sans-serif"
            fontWeight={600}
          />

            </>
          )}
          </g>

          <rect
            x={0}
            y={2760}
            width={WIDTH}
            height={540}
            fill={BLACK}
          />

          <rect
            x={0}
            y={2760}
            width={WIDTH}
            height={8}
            fill={GOLD}
          />

          <g transform="translate(0 -90)">
          <BrandMark
            x={110}
            y={2920}
            width={610}
            height={165}
            name={organizationName}
            url={organizationLogoImage.dataUrl}
            imagePadding={14}
          />

          <BrandMark
            x={760}
            y={2920}
            width={400}
            height={165}
            name={brokerageName}
            url={brokerageLogoImage.dataUrl}
            imagePadding={14}
          />

          <text
            x={1810}
            y={2945}
            fill={GOLD}
            fontFamily="Arial, sans-serif"
            fontSize={30}
            fontWeight={800}
            letterSpacing={6}
            textAnchor="middle"
          >
            PRIVATE SHOWINGS
          </text>

          <text
            x={1810}
            y={3025}
            fill={WHITE}
            fontFamily="Georgia, 'Times New Roman', serif"
            fontSize={58}
            fontWeight={700}
            textAnchor="middle"
          >
            <tspan>{agentName}</tspan>
            <tspan
              dx={30}
              fill={GOLD}
              fontFamily="Arial, sans-serif"
              fontSize={24}
              fontWeight={800}
              letterSpacing={3.5}
            >
              LISTING AGENT
            </tspan>
          </text>

          <SvgText
            value={
              cleanText(
                copy.call_to_action
              ) ||
              'Schedule your private tour today.'
            }
            x={1810}
            y={3090}
            maximumCharacters={58}
            maximumLines={2}
            fontSize={36}
            lineHeight={41}
            fill={WHITE}
            fontFamily="Georgia, 'Times New Roman', serif"
            fontWeight={700}
            textAnchor="middle"
          />

          <g
            transform="translate(1320 3122) scale(1.25)"
            fill="none"
            stroke={GOLD}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 4l6-2 5 10-4 3c3 6 7 10 13 13l3-4 10 5-2 6c-1 3-4 4-7 3C15 34 6 25 2 11 1 8 2 5 5 4z" />
          </g>

          <SvgText
            value={agentPhone}
            x={1385}
            y={3170}
            maximumCharacters={24}
            maximumLines={1}
            fontSize={34}
            lineHeight={39}
            fill={WHITE}
            fontFamily="Georgia, 'Times New Roman', serif"
            fontWeight={700}
          />

          <g
            transform="translate(1665 3122) scale(1.25)"
            fill="none"
            stroke={GOLD}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x={2} y={4} width={36} height={27} rx={3} />
            <path d="M4 7l16 13L36 7" />
          </g>

          <SvgText
            value={agentEmail}
            x={1730}
            y={3170}
            maximumCharacters={40}
            maximumLines={1}
            fontSize={29}
            lineHeight={34}
            fill={WHITE}
            fontFamily="Arial, sans-serif"
            fontWeight={700}
          />

          <g
            transform="translate(2100 3122) scale(1.25)"
            fill="none"
            stroke={GOLD}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx={20} cy={20} r={17} />
            <path d="M3 20h34M20 3c6 6 9 11 9 17s-3 12-9 17M20 3c-6 6-9 11-9 17s3 12 9 17" />
          </g>

          <SvgText
            value={agentWebsiteDisplay}
            x={2165}
            y={3170}
            maximumCharacters={36}
            maximumLines={1}
            fontSize={29}
            lineHeight={34}
            fill={WHITE}
            fontFamily="Arial, sans-serif"
            fontWeight={700}
          />

          <line
            x1={110}
            y1={3250}
            x2={2440}
            y2={3250}
            stroke="#3c3832"
            strokeWidth={2}
          />

          <SvgText
            value={legalLine}
            x={110}
            y={3292}
            maximumCharacters={150}
            maximumLines={3}
            fontSize={20}
            lineHeight={24}
            fill={MUTED}
            fontFamily="Arial, sans-serif"
            fontWeight={500}
          />
          </g>
        </svg>
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
          {error}
        </div>
      )}

      {notice && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          {notice}
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          disabled={controlsBusy}
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Wording
        </button>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={exportBusy}
            onClick={() =>
              void runExport('png')
            }
            className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-40"
          >
            {activeAction === 'png' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download PNG
          </button>

          <button
            type="button"
            disabled={exportBusy}
            onClick={() =>
              void runExport('print')
            }
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {activeAction === 'print' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Printer className="h-4 w-4" />
            )}
            Print / Save PDF
          </button>

          <button
            type="button"
            disabled={
              controlsBusy ||
              saveDisabled
            }
            onClick={() =>
              void runSave('save')
            }
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {activeAction === 'save' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save for Review
          </button>

          <button
            type="button"
            disabled={
              controlsBusy ||
              approvalDisabled
            }
            onClick={() =>
              void runSave(
                'approve'
              )
            }
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-40"
          >
            {activeAction === 'approve' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            Approve Flyer
          </button>
        </div>
      </div>
    </section>
  );
}
