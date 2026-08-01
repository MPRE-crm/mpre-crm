'use client';

import {
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

type GoldEstateListing = {
  id: string;
  title: string;
  property_address: string;
  city: string | null;
  state: string | null;
  zip: string | null;
  list_price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  square_feet: number | null;
  acres: number | null;
  lot_size_text: string | null;
};

type GoldEstatePhoto = {
  label: string;
  url: string;
};

type MarketingBrand = {
  name: string | null;
  logo_url: string | null;
};

type GoldEstateIdentity = {
  profile: {
    marketing_from_name: string | null;
    marketing_from_email: string | null;
    marketing_phone: string | null;
    marketing_title: string | null;
    marketing_website_url: string | null;
    marketing_license_number: string | null;
    marketing_headshot_url: string | null;
    marketing_logo_url: string | null;
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
  listing: GoldEstateListing;
  copy: CanvaFlyerCopy;
  photos: GoldEstatePhoto[];
  identity: GoldEstateIdentity | null;
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

const WIDTH = 2000;
const HEIGHT = 1414;

const GOLD_ESTATE_TEMPLATE_PREVIEW =
  '/marketing/canva-templates/luxury/single-sided/luxury-landscape-01-gold-estate-master.svg';

const GOLD = '#c99b42';
const LIGHT_GOLD = '#e3c57e';
const BLACK = '#080808';
const WHITE = '#ffffff';
const MUTED = '#d2d2d2';

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
      candidate.length <=
        maximumCharacters ||
      !current
    ) {
      current = candidate;
      continue;
    }

    lines.push(current);
    current = word;

    if (
      lines.length ===
      maximumLines
    ) {
      break;
    }
  }

  if (
    current &&
    lines.length <
      maximumLines
  ) {
    lines.push(current);
  }

  const truncated =
    wordIndex <
      words.length - 1 ||
    lines.length >
      maximumLines;

  const result =
    lines.slice(
      0,
      maximumLines
    );

  if (
    truncated &&
    result.length > 0
  ) {
    const lastIndex =
      result.length - 1;

    result[lastIndex] =
      `${result[lastIndex]
        .replace(
          /[\s,.;:!?-]+$/,
          ''
        )
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
  const lines =
    wrapLines(
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
      letterSpacing={
        letterSpacing
      }
    >
      {lines.map(
        (line, index) => (
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
        )
      )}
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
}: {
  url: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  clipId: string;
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
        fill="#1c1c1c"
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
          fontSize={30}
          fontWeight={700}
          textAnchor="middle"
        >
          PHOTO REQUIRED
        </text>
      )}


    </g>
  );
}

function FactBlock({
  x,
  y,
  value,
  label,
}: {
  x: number;
  y: number;
  value: string;
  label: string;
}) {
  return (
    <g>
      <text
        x={x}
        y={y}
        fill={WHITE}
        fontFamily="Georgia, serif"
        fontSize={35}
        fontWeight={700}
        textAnchor="middle"
      >
        {value}
      </text>

      <text
        x={x}
        y={y + 35}
        fill={MUTED}
        fontFamily="Arial, sans-serif"
        fontSize={15}
        fontWeight={700}
        letterSpacing={1.2}
        textAnchor="middle"
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
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  name: string;
  url: string;
}) {
  return (
    <g>
      <SvgText
        value={name}
        x={x + width / 2}
        y={y + height * 0.58}
        maximumCharacters={22}
        maximumLines={2}
        fontSize={32}
        lineHeight={36}
        fill={GOLD}
        fontFamily="Georgia, serif"
        fontWeight={700}
        textAnchor="middle"
      />

      {url && (
        <image
          href={url}
          x={x}
          y={y}
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid meet"
          crossOrigin="anonymous"
        />
      )}
    </g>
  );
}
function blobAsDataUrl(
  blob: Blob
) {
  return new Promise<string>(
    (resolve, reject) => {
      const reader =
        new FileReader();

      reader.addEventListener(
        'load',
        () => {
          if (
            typeof reader.result ===
              'string' &&
            reader.result
          ) {
            resolve(
              reader.result
            );
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

      reader.readAsDataURL(
        blob
      );
    }
  );
}

async function inlineSvgImages(
  svg: SVGSVGElement
) {
  const images =
    Array.from(
      svg.querySelectorAll(
        'image'
      )
    );

  await Promise.all(
    images.map(
      async (image) => {
        const href =
          image.getAttribute(
            'href'
          ) ||
          '';

        if (
          !href ||
          href.startsWith(
            'data:'
          )
        ) {
          return;
        }

        const response =
          await fetch(href, {
            credentials:
              'omit',
            cache:
              'force-cache',
          });

        if (!response.ok) {
          throw new Error(
            `A required Flyer image could not be loaded (${response.status}).`
          );
        }

        const dataUrl =
          await blobAsDataUrl(
            await response.blob()
          );

        image.setAttribute(
          'href',
          dataUrl
        );
      }
    )
  );
}

function loadImage(
  source: string
) {
  return new Promise<HTMLImageElement>(
    (resolve, reject) => {
      const image =
        new Image();

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

function safeFileName(
  value: string
) {
  return (
    value
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        '-'
      )
      .replace(
        /^-+|-+$/g,
        ''
      )
      .slice(0, 80) ||
    'listing'
  );
}

async function serializedSvg(
  svg: SVGSVGElement
) {
  const clone =
    svg.cloneNode(
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

  await inlineSvgImages(
    clone
  );

  return new XMLSerializer()
    .serializeToString(
      clone
    );
}

async function downloadPng(
  svg: SVGSVGElement,
  filename: string
) {
  const serialized =
    await serializedSvg(svg);

  const svgBlob =
    new Blob(
      [serialized],
      {
        type:
          'image/svg+xml;charset=utf-8',
      }
    );

  const svgUrl =
    URL.createObjectURL(
      svgBlob
    );

  try {
    const image =
      await loadImage(
        svgUrl
      );

    const canvas =
      document.createElement(
        'canvas'
      );

    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    const context =
      canvas.getContext(
        '2d'
      );

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

    const png =
      await canvasPng(
        canvas
      );

    const pngUrl =
      URL.createObjectURL(
        png
      );

    try {
      const link =
        document.createElement(
          'a'
        );

      link.href = pngUrl;
      link.download =
        filename;
      link.rel =
        'noopener';

      document.body
        .appendChild(link);

      link.click();
      link.remove();
    } finally {
      URL.revokeObjectURL(
        pngUrl
      );
    }
  } finally {
    URL.revokeObjectURL(
      svgUrl
    );
  }
}

async function printFlyer(
  svg: SVGSVGElement,
  title: string
) {
  const printWindow =
    window.open(
      '',
      '_blank'
    );

  if (!printWindow) {
    throw new Error(
      'The browser blocked the print window. Allow pop-ups and try again.'
    );
  }

  printWindow.opener =
    null;

  try {
    const serialized =
      await serializedSvg(
        svg
      );

    printWindow.document
      .open();

    printWindow.document
      .write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 0;
    }

    html,
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
    }

    .sheet {
      width: 297mm;
      height: 210mm;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }

    svg {
      display: block;
      width: 297mm;
      height: 210mm;
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

    printWindow.document
      .close();
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

export default function ListingGoldEstateFlyerPreview({
  listing,
  copy,
  photos,
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

  const generatedId =
    useId()
      .replace(
        /:/g,
        ''
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
    useState<
      string | null
    >(null);

  const [
    notice,
    setNotice,
  ] =
    useState<
      string | null
    >(null);

  const hero =
    photos[0]?.url ||
    '';
  const kitchen =
    photos[1]?.url ||
    '';
  const living =
    photos[2]?.url ||
    '';
  const bedroom =
    photos[3]?.url ||
    '';

  const address =
    cleanText(
      listing
        .property_address
    ) ||
    cleanText(
      listing.title
    );

  const cityLine = [
    cleanText(
      listing.city
    ),
    cleanText(
      listing.state
    ),
  ]
    .filter(Boolean)
    .join(', ');

  const locality =
    [
      cityLine,
      cleanText(
        listing.zip
      ),
    ]
      .filter(Boolean)
      .join(' ');

  const price =
    cleanText(
      copy.price_line
    ) ||
    (
      typeof listing
        .list_price ===
        'number'
        ? listing.list_price
            .toLocaleString(
              'en-US',
              {
                style:
                  'currency',
                currency:
                  'USD',
                maximumFractionDigits:
                  0,
              }
            )
        : ''
    );

  const description =
    cleanText(
      copy.short_description
    ) ||
    cleanText(
      copy.public_description
    );

  const features =
    copy.feature_bullets
      .map(cleanText)
      .filter(Boolean)
      .slice(0, 6);

  const leftFeatures =
    features.slice(
      0,
      3
    );

  const rightFeatures =
    features.slice(
      3,
      6
    );

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

  const organizationName =
    cleanText(
      identity?.branding
        .organization.name
    ) ||
    'MPRE';

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
                2,
            }
          )
      : cleanText(
          listing
            .lot_size_text
        ) ||
        '—';

  const filename =
    `${safeFileName(
      address
    )}-gold-estate-flyer.png`;

  const controlsBusy =
    saving ||
    activeAction !==
      null;

  async function runExport(
    action:
      | 'png'
      | 'print'
  ) {
    const svg =
      svgRef.current;

    if (!svg) {
      setError(
        'The Flyer preview is not ready.'
      );
      return;
    }

    setActiveAction(
      action
    );
    setError(null);
    setNotice(null);

    try {
      if (
        action === 'png'
      ) {
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
          `${address} Gold Estate Flyer`
        );

        setNotice(
          'The print window opened. Choose Save as PDF to create a PDF.'
        );
      }
    } catch (
      exportError:
        unknown
    ) {
      setError(
        exportError
          instanceof Error
          ? exportError
              .message
          : 'The Flyer could not be exported.'
      );
    } finally {
      setActiveAction(
        null
      );
    }
  }

  async function runSave(
    action:
      | 'save'
      | 'approve'
  ) {
    setActiveAction(
      action
    );
    setError(null);
    setNotice(null);

    try {
      const saved =
        action === 'approve'
          ? await onApprove()
          : await onSave();

      if (saved) {
        setNotice(
          action ===
            'approve'
            ? 'The Flyer is approved.'
            : 'The Flyer is saved and ready for review.'
        );
      }
    } catch (
      saveError:
        unknown
    ) {
      setError(
        saveError
          instanceof Error
          ? saveError.message
          : 'The Flyer could not be saved.'
      );
    } finally {
      setActiveAction(
        null
      );
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black text-slate-950">
            Review Finished Flyer
          </h3>

          <p className="mt-1 text-sm leading-6 text-slate-600">
            Your approved photos, wording, listing information, agent identity,
            branding, and required advertising language are automatically
            placed into the Gold Estate Flyer.
          </p>
        </div>

        <span className="rounded-full bg-violet-100 px-3 py-1.5 text-xs font-black text-violet-800">
          {statusLabel(
            status
          )}
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

      <div className="mt-5 overflow-hidden rounded-2xl border border-slate-300 bg-slate-950 shadow-xl">
        <svg
          ref={svgRef}
          role="img"
          aria-label={`Gold Estate Flyer for ${address}`}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          xmlns="http://www.w3.org/2000/svg"
          className="h-auto w-full"
          style={{
            aspectRatio:
              `${WIDTH} / ${HEIGHT}`,
          }}
        >
          <image
            href={GOLD_ESTATE_TEMPLATE_PREVIEW}
            x={0}
            y={0}
            width={WIDTH}
            height={HEIGHT}
            preserveAspectRatio="none"
          />

          <PhotoFrame
            url={hero}
            label="Main Exterior"
            x={51}
            y={52}
            width={1096}
            height={668}
            clipId={`${generatedId}-hero`}
          />

          <PhotoFrame
            url={kitchen}
            label="Kitchen"
            x={51}
            y={728}
            width={355}
            height={330}
            clipId={`${generatedId}-kitchen`}
          />

          <PhotoFrame
            url={living}
            label="Living Room"
            x={419}
            y={728}
            width={355}
            height={330}
            clipId={`${generatedId}-living`}
          />

          <PhotoFrame
            url={bedroom}
            label="Primary Bedroom"
            x={787}
            y={728}
            width={360}
            height={330}
            clipId={`${generatedId}-bedroom`}
          />

          <rect
            x={1195}
            y={120}
            width={760}
            height={340}
            fill={BLACK}
          />

          <SvgText
            value={address}
            x={1215}
            y={180}
            maximumCharacters={21}
            maximumLines={3}
            fontSize={59}
            lineHeight={61}
            fill={WHITE}
            fontFamily="Georgia, serif"
            fontWeight={700}
          />

          <text
            x={1215}
            y={354}
            fill={GOLD}
            fontFamily="Arial, sans-serif"
            fontSize={20}
            fontWeight={700}
            letterSpacing={2}
          >
            {locality.toUpperCase()}
          </text>

          <text
            x={1215}
            y={422}
            fill={GOLD}
            fontFamily="Georgia, serif"
            fontSize={45}
            fontWeight={700}
          >
            {price}
          </text>

          <rect
            x={1205}
            y={548}
            width={740}
            height={105}
            fill={BLACK}
          />

          <FactBlock
            x={1287}
            y={585}
            value={
              typeof listing
                .bedrooms ===
                'number'
                ? String(
                    listing
                      .bedrooms
                  )
                : '—'
            }
            label="BEDROOMS"
          />

          <FactBlock
            x={1480}
            y={585}
            value={
              typeof listing
                .bathrooms ===
                'number'
                ? String(
                    listing
                      .bathrooms
                  )
                : '—'
            }
            label="BATHROOMS"
          />

          <FactBlock
            x={1668}
            y={585}
            value={
              typeof listing
                .square_feet ===
                'number'
                ? listing
                    .square_feet
                    .toLocaleString(
                      'en-US'
                    )
                : '—'
            }
            label="SQ FT"
          />

          <FactBlock
            x={1860}
            y={585}
            value={lotValue}
            label={
              typeof listing
                .acres ===
                'number'
                ? 'ACRES'
                : 'LOT'
            }
          />

          <rect
            x={1200}
            y={725}
            width={755}
            height={218}
            fill={BLACK}
          />

          <SvgText
            value={copy.headline}
            x={1215}
            y={765}
            maximumCharacters={42}
            maximumLines={2}
            fontSize={28}
            lineHeight={32}
            fill={WHITE}
            fontFamily="Georgia, serif"
            fontWeight={700}
          />

          <SvgText
            value={description}
            x={1215}
            y={845}
            maximumCharacters={76}
            maximumLines={4}
            fontSize={18}
            lineHeight={24}
            fill={WHITE}
            fontFamily="Arial, sans-serif"
            fontWeight={400}
          />

          <rect
            x={1200}
            y={1000}
            width={755}
            height={120}
            fill={BLACK}
          />

          {leftFeatures.map(
            (feature, index) => (
              <SvgText
                key={`left-${feature}`}
                value={`• ${feature}`}
                x={1215}
                y={
                  1028 +
                  index * 31
                }
                maximumCharacters={49}
                maximumLines={1}
                fontSize={13}
                lineHeight={17}
                fill={WHITE}
                fontFamily="Arial, sans-serif"
                fontWeight={500}
              />
            )
          )}

          {rightFeatures.map(
            (feature, index) => (
              <SvgText
                key={`right-${feature}`}
                value={`• ${feature}`}
                x={1592}
                y={
                  1028 +
                  index * 31
                }
                maximumCharacters={49}
                maximumLines={1}
                fontSize={13}
                lineHeight={17}
                fill={WHITE}
                fontFamily="Arial, sans-serif"
                fontWeight={500}
              />
            )
          )}

          <rect
            x={45}
            y={1130}
            width={700}
            height={200}
            fill={BLACK}
          />

          <defs>
            <clipPath
              id={`${generatedId}-headshot`}
            >
              <circle
                cx={158}
                cy={1210}
                r={82}
              />
            </clipPath>
          </defs>

          <circle
            cx={158}
            cy={1210}
            r={86}
            fill="#eeeeee"
            stroke={GOLD}
            strokeWidth={5}
          />

          {headshot ? (
            <image
              href={headshot}
              x={76}
              y={1128}
              width={164}
              height={164}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#${generatedId}-headshot)`}
              crossOrigin="anonymous"
            />
          ) : (
            <text
              x={158}
              y={1240}
              fill="#555555"
              fontFamily="Arial, sans-serif"
              fontSize={72}
              fontWeight={800}
              textAnchor="middle"
            >
              {agentName
                .slice(0, 1)
                .toUpperCase()}
            </text>
          )}

          <SvgText
            value={agentName}
            x={275}
            y={1168}
            maximumCharacters={30}
            maximumLines={1}
            fontSize={31}
            lineHeight={34}
            fill={GOLD}
            fontFamily="Georgia, serif"
            fontWeight={700}
          />

          <SvgText
            value={agentTitle}
            x={275}
            y={1202}
            maximumCharacters={35}
            maximumLines={1}
            fontSize={16}
            lineHeight={20}
            fill={WHITE}
            fontFamily="Arial, sans-serif"
            fontWeight={700}
          />

          <SvgText
            value={[
              agentPhone,
              agentEmail,
            ]
              .filter(Boolean)
              .join(' • ')}
            x={275}
            y={1237}
            maximumCharacters={62}
            maximumLines={1}
            fontSize={14}
            lineHeight={18}
            fill={MUTED}
            fontFamily="Arial, sans-serif"
            fontWeight={500}
          />

          <SvgText
            value={[
              agentWebsite,
              agentLicense
                ? `License ${agentLicense}`
                : '',
            ]
              .filter(Boolean)
              .join(' • ')}
            x={275}
            y={1268}
            maximumCharacters={62}
            maximumLines={1}
            fontSize={13}
            lineHeight={17}
            fill={MUTED}
            fontFamily="Arial, sans-serif"
            fontWeight={500}
          />

          <SvgText
            value={officeAddress}
            x={275}
            y={1297}
            maximumCharacters={66}
            maximumLines={1}
            fontSize={12}
            lineHeight={16}
            fill={MUTED}
            fontFamily="Arial, sans-serif"
            fontWeight={500}
          />

          <rect
            x={750}
            y={1130}
            width={435}
            height={200}
            fill={BLACK}
          />

          <BrandMark
            x={790}
            y={1160}
            width={350}
            height={115}
            name={organizationName}
            url={organizationLogo}
          />

          <rect
            x={1190}
            y={1130}
            width={405}
            height={200}
            fill={BLACK}
          />

          <BrandMark
            x={1230}
            y={1160}
            width={325}
            height={115}
            name={brokerageName}
            url={brokerageLogo}
          />

          <rect
            x={1600}
            y={1130}
            width={355}
            height={200}
            fill={BLACK}
          />

          {/* Reserved for the listing website QR code. */}

          <line
            x1={748}
            x2={748}
            y1={1130}
            y2={1330}
            stroke="#493a21"
            strokeWidth={2}
          />

          <line
            x1={1188}
            x2={1188}
            y1={1130}
            y2={1330}
            stroke="#493a21"
            strokeWidth={2}
          />

          <line
            x1={1598}
            x2={1598}
            y1={1130}
            y2={1330}
            stroke="#493a21"
            strokeWidth={2}
          />

          <rect
            x={45}
            y={1340}
            width={1910}
            height={74}
            fill={BLACK}
          />

          <line
            x1={50}
            x2={1950}
            y1={1340}
            y2={1340}
            stroke={GOLD}
            strokeWidth={2}
          />

          <SvgText
            value={legalLine}
            x={65}
            y={1375}
            maximumCharacters={235}
            maximumLines={2}
            fontSize={11}
            lineHeight={15}
            fill={MUTED}
            fontFamily="Arial, sans-serif"
            fontWeight={500}
          />        </svg>
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
            disabled={controlsBusy}
            onClick={() =>
              void runExport(
                'png'
              )
            }
            className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-sm font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-40"
          >
            {activeAction ===
            'png' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download PNG
          </button>

          <button
            type="button"
            disabled={controlsBusy}
            onClick={() =>
              void runExport(
                'print'
              )
            }
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            {activeAction ===
            'print' ? (
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
              void runSave(
                'save'
              )
            }
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {activeAction ===
            'save' ? (
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
            {activeAction ===
            'approve' ? (
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