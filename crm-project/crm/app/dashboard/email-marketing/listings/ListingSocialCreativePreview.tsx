'use client';

import {
  forwardRef,
  useId,
  type ReactNode,
} from 'react';

import type {
  SocialAgentBrand,
  SocialBrokerageBrand,
  SocialCreativeAsset,
  SocialOrganizationBrand,
  SocialTemplateDefinition,
} from '../../../../lib/listing-social-creative';

type PreviewProps = {
  asset: SocialCreativeAsset;
  template: SocialTemplateDefinition;
  agent: SocialAgentBrand;
  organization: SocialOrganizationBrand;
  brokerage: SocialBrokerageBrand;
  showSafeArea?: boolean;
};

type Brand = {
  name: string;
  logoUrl: string;
};

function estimatedTextWidth(
  value: string,
  fontSize: number,
  fontWeight: number,
  letterSpacing = 0
) {
  const weightFactor =
    fontWeight >= 800
      ? 1.04
      : fontWeight >= 600
      ? 1.02
      : 1;
  const characters = Array.from(value);
  const glyphWidth = characters.reduce(
    (total, character) => {
      if (/\s/.test(character)) {
        return total + 0.32;
      }
      if (/[ilI1|.,'`:;]/.test(character)) {
        return total + 0.3;
      }
      if (/[MW@#%&]/.test(character)) {
        return total + 0.92;
      }
      if (/[A-Z0-9]/.test(character)) {
        return total + 0.65;
      }
      return total + 0.56;
    },
    0
  );

  return (
    glyphWidth * fontSize * weightFactor +
    Math.max(0, characters.length - 1) *
      letterSpacing
  );
}

function ellipsizedLine(
  value: string,
  maximumWidth: number,
  fontSize: number,
  fontWeight: number,
  letterSpacing: number
) {
  let fitted = value
    .trimEnd()
    .replace(/[.,;:!?\s]+$/, '');

  while (
    fitted &&
    estimatedTextWidth(
      `${fitted}…`,
      fontSize,
      fontWeight,
      letterSpacing
    ) > maximumWidth
  ) {
    fitted = Array.from(fitted)
      .slice(0, -1)
      .join('')
      .trimEnd();
  }

  return `${fitted || ''}…`;
}

function linesFor(
  value: string,
  maximumWidth: number,
  maximumLines: number,
  fontSize: number,
  fontWeight: number,
  letterSpacing = 0
) {
  const normalized = value
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) {
    return [''];
  }

  const characters = Array.from(normalized);
  const lines: string[] = [];
  let current = '';
  let cursor = 0;
  let truncated = false;

  while (cursor < characters.length) {
    const candidate =
      current + characters[cursor];

    if (
      !current ||
      estimatedTextWidth(
        candidate,
        fontSize,
        fontWeight,
        letterSpacing
      ) <= maximumWidth
    ) {
      current = candidate;
      cursor += 1;
      continue;
    }

    if (
      lines.length >=
      maximumLines - 1
    ) {
      truncated = true;
      break;
    }

    const breakAt =
      current.lastIndexOf(' ');

    if (breakAt > 0) {
      lines.push(
        current
          .slice(0, breakAt)
          .trimEnd()
      );
      current = current
        .slice(breakAt + 1)
        .trimStart();
    } else {
      lines.push(current);
      current = '';
    }
  }

  if (
    current.trim() &&
    lines.length < maximumLines
  ) {
    lines.push(current.trim());
  }

  if (cursor < characters.length) {
    truncated = true;
  }

  const included = lines.slice(
    0,
    maximumLines
  );

  if (truncated && included.length > 0) {
    const lastIndex =
      included.length - 1;
    included[lastIndex] = ellipsizedLine(
      included[lastIndex],
      maximumWidth,
      fontSize,
      fontWeight,
      letterSpacing
    );
  }

  return included.length > 0
    ? included
    : [''];
}

function SvgText({
  value,
  x,
  y,
  maximumWidth,
  maximumLines,
  lineHeight,
  fontSize,
  fill,
  fontFamily,
  fontWeight,
  textAnchor = 'start',
  letterSpacing,
}: {
  value: string;
  x: number;
  y: number;
  maximumWidth: number;
  maximumLines: number;
  lineHeight: number;
  fontSize: number;
  fill: string;
  fontFamily: string;
  fontWeight: number;
  textAnchor?: 'start' | 'middle' | 'end';
  letterSpacing?: number;
}) {
  const lines = linesFor(
    value,
    maximumWidth,
    maximumLines,
    fontSize,
    fontWeight,
    letterSpacing
  );

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
          key={`${index}:${line}`}
          x={x}
          dy={index === 0 ? 0 : lineHeight}
        >
          {line}
        </tspan>
      ))}
    </text>
  );
}

function Photo({
  url,
  label,
  x,
  y,
  width,
  height,
  radius,
  clipId,
  filter,
}: {
  url: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  clipId: string;
  filter: string;
}) {
  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            rx={radius}
          />
        </clipPath>
      </defs>
      {url ? (
        <image
          href={url}
          aria-label={label}
          x={x}
          y={y}
          width={width}
          height={height}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
          style={{ filter }}
        />
      ) : (
        <g>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            rx={radius}
            fill="#1e293b"
          />
          <text
            x={x + width / 2}
            y={y + height / 2}
            fill="#e2e8f0"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize={Math.max(
              18,
              Math.min(width, height) * 0.045
            )}
            fontWeight={700}
            textAnchor="middle"
          >
            Photo required
          </text>
        </g>
      )}
    </>
  );
}

function BrandMark({
  brand,
  fallback,
  x,
  y,
  width,
  height,
  align,
  color,
  fontFamily,
}: {
  brand: Brand;
  fallback: string;
  x: number;
  y: number;
  width: number;
  height: number;
  align: 'start' | 'end';
  color: string;
  fontFamily: string;
}) {
  if (brand.logoUrl) {
    return (
      <image
        href={brand.logoUrl}
        aria-label={`${brand.name || fallback} logo`}
        x={x}
        y={y}
        width={width}
        height={height}
        preserveAspectRatio={
          align === 'start'
            ? 'xMinYMid meet'
            : 'xMaxYMid meet'
        }
        style={{
          filter:
            'drop-shadow(0 1px 1px rgba(255,255,255,0.85)) drop-shadow(0 2px 3px rgba(0,0,0,0.85))',
        }}
      />
    );
  }

  return (
    <SvgText
      value={brand.name || fallback}
      x={
        align === 'start'
          ? x
          : x + width
      }
      y={y + height * 0.58}
      maximumWidth={width}
      maximumLines={2}
      lineHeight={Math.max(12, height * 0.25)}
      fontSize={Math.max(12, height * 0.27)}
      fill={color}
      fontFamily={fontFamily}
      fontWeight={800}
      textAnchor={align}
      letterSpacing={1.1}
    />
  );
}

function BrandFooter({
  organization,
  brokerage,
  x,
  y,
  width,
  height,
  color,
  borderColor,
  fontFamily,
  phaseOneSizing = false,
}: {
  organization: SocialOrganizationBrand;
  brokerage: SocialBrokerageBrand;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  borderColor: string;
  fontFamily: string;
  phaseOneSizing?: boolean;
}) {
  const duplicateLogo = Boolean(
    organization.logoUrl &&
      brokerage.logoUrl &&
      organization.logoUrl ===
        brokerage.logoUrl
  );

  return (
    <g>
      <line
        x1={x}
        x2={x + width}
        y1={y}
        y2={y}
        stroke={borderColor}
        strokeWidth={2}
      />
      <BrandMark
        brand={organization}
        fallback="Organization"
        x={x}
        y={
          y +
          height *
            (phaseOneSizing
              ? 0.22
              : 0.14)
        }
        width={width * 0.42}
        height={
          height *
          (phaseOneSizing
            ? 0.56
            : 0.72)
        }
        align="start"
        color={color}
        fontFamily={fontFamily}
      />
      <BrandMark
        brand={{
          ...brokerage,
          logoUrl: duplicateLogo
            ? ''
            : brokerage.logoUrl,
        }}
        fallback="Licensed Brokerage"
        x={x + width * 0.48}
        y={
          y +
          height *
            (phaseOneSizing
              ? 0.1
              : 0.14)
        }
        width={width * 0.52}
        height={
          height *
          (phaseOneSizing
            ? 0.76
            : 0.72)
        }
        align="end"
        color={color}
        fontFamily={fontFamily}
      />
    </g>
  );
}

function Facts({
  facts,
  x,
  y,
  maximumWidth,
  fill,
  foreground,
  borderColor,
  fontFamily,
  compact = false,
  variant = 'pills',
  uppercase = false,
}: {
  facts: string[];
  x: number;
  y: number;
  maximumWidth: number;
  fill: string;
  foreground: string;
  borderColor: string;
  fontFamily: string;
  compact?: boolean;
  variant?: 'pills' | 'underline';
  uppercase?: boolean;
}) {
  const fontSize = compact ? 18 : 22;
  const height = compact ? 36 : 44;
  const gap = compact ? 8 : 10;
  let cursor = x;

  return (
    <g>
      {facts.slice(0, compact ? 3 : 4).map((fact) => {
        const displayFact = uppercase
          ? fact.toUpperCase()
          : fact;
        const width = Math.min(
          maximumWidth,
          Math.max(
            variant === 'underline'
              ? 84
              : compact
              ? 96
              : 120,
            estimatedTextWidth(
              displayFact,
              fontSize,
              700,
              uppercase ? 1 : 0
            ) +
              (variant === 'underline'
                ? 8
                : 30)
          )
        );
        const point = cursor;
        cursor += width + gap;

        if (
          point + width >
          x + maximumWidth
        ) {
          return null;
        }

        return (
          <g key={`${point}:${fact}`}>
            {variant === 'pills' ? (
              <rect
                x={point}
                y={y}
                width={width}
                height={height}
                rx={height / 2}
                fill={fill}
                stroke={borderColor}
                strokeWidth={1.5}
              />
            ) : (
              <line
                x1={point}
                x2={point + width}
                y1={y + height}
                y2={y + height}
                stroke={borderColor}
                strokeWidth={1.5}
              />
            )}
            <text
              x={
                variant === 'pills'
                  ? point + width / 2
                  : point
              }
              y={y + height * 0.65}
              fill={foreground}
              fontFamily={fontFamily}
              fontSize={fontSize}
              fontWeight={700}
              textAnchor={
                variant === 'pills'
                  ? 'middle'
                  : 'start'
              }
              letterSpacing={
                uppercase ? 1 : undefined
              }
            >
              {displayFact}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function CampaignChip({
  value,
  x,
  y,
  background,
  foreground,
  fontFamily,
  fontSize = 20,
  height = 54,
  minimumWidth = 190,
  maximumWidth = 420,
  horizontalPadding = 58,
  radius = 8,
  letterSpacing = 2.2,
}: {
  value: string;
  x: number;
  y: number;
  background: string;
  foreground: string;
  fontFamily: string;
  fontSize?: number;
  height?: number;
  minimumWidth?: number;
  maximumWidth?: number;
  horizontalPadding?: number;
  radius?: number;
  letterSpacing?: number;
}) {
  const width = Math.max(
    minimumWidth,
    Math.min(
      maximumWidth,
      estimatedTextWidth(
        value.toUpperCase(),
        fontSize,
        900,
        letterSpacing
      ) + horizontalPadding
    )
  );

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={radius}
        fill={background}
      />
      <text
        x={x + width / 2}
        y={y + height * 0.65}
        fill={foreground}
        fontFamily={fontFamily}
        fontSize={fontSize}
        fontWeight={900}
        textAnchor="middle"
        letterSpacing={letterSpacing}
      >
        {value.toUpperCase()}
      </text>
    </g>
  );
}

function AgentCard({
  agent,
  clipPrefix,
  x,
  y,
  width,
  foreground,
  muted,
  accent,
  accentForeground,
  fontFamily,
  scale = 1,
  squareHeadshot = false,
}: {
  agent: SocialAgentBrand;
  clipPrefix: string;
  x: number;
  y: number;
  width: number;
  foreground: string;
  muted: string;
  accent: string;
  accentForeground: string;
  fontFamily: string;
  scale?: number;
  squareHeadshot?: boolean;
}) {
  const imageSize = 86 * scale;
  const personalLogoWidth =
    130 * scale;
  const personalLogoHeight =
    70 * scale;
  const textGap = 22 * scale;
  const textX =
    x + imageSize + textGap;
  const personalLogoX =
    x + width - personalLogoWidth;
  const textRight = agent.logoUrl
    ? personalLogoX - 18 * scale
    : x + width;
  const textWidth = Math.max(
    72 * scale,
    textRight - textX
  );

  return (
    <g>
      {agent.headshotUrl ? (
        <Photo
          url={agent.headshotUrl}
          label={`${agent.name || 'Listing agent'} headshot`}
          x={x}
          y={y}
          width={imageSize}
          height={imageSize}
          radius={
            squareHeadshot
              ? 8 * scale
              : imageSize / 2
          }
          clipId={`${clipPrefix}-agent-${Math.round(x)}-${Math.round(y)}`}
          filter="none"
        />
      ) : (
        <g>
          {squareHeadshot ? (
            <rect
              x={x}
              y={y}
              width={imageSize}
              height={imageSize}
              rx={8 * scale}
              fill={accent}
            />
          ) : (
            <circle
              cx={x + imageSize / 2}
              cy={y + imageSize / 2}
              r={imageSize / 2}
              fill={accent}
            />
          )}
          <text
            x={x + imageSize / 2}
            y={y + imageSize * 0.66}
            fill={accentForeground}
            fontFamily={fontFamily}
            fontSize={38 * scale}
            fontWeight={900}
            textAnchor="middle"
          >
            {agent.name
              .slice(0, 1)
              .toUpperCase() || 'A'}
          </text>
        </g>
      )}
      <SvgText
        value={agent.name || 'Listing Agent'}
        x={textX}
        y={y + 28 * scale}
        maximumWidth={textWidth}
        maximumLines={1}
        lineHeight={30 * scale}
        fontSize={25 * scale}
        fill={foreground}
        fontFamily={fontFamily}
        fontWeight={800}
      />
      <SvgText
        value={agent.title}
        x={textX}
        y={y + 56 * scale}
        maximumWidth={textWidth}
        maximumLines={1}
        lineHeight={24 * scale}
        fontSize={18 * scale}
        fill={muted}
        fontFamily={fontFamily}
        fontWeight={500}
      />
      <SvgText
        value={[
          agent.phone,
          agent.websiteUrl,
        ]
          .filter(Boolean)
          .join(' • ')}
        x={textX}
        y={y + 82 * scale}
        maximumWidth={textWidth}
        maximumLines={2}
        lineHeight={18 * scale}
        fontSize={16 * scale}
        fill={muted}
        fontFamily={fontFamily}
        fontWeight={700}
      />
      {agent.logoUrl && (
        <image
          href={agent.logoUrl}
          aria-label={`${agent.name || 'Agent'} personal brand logo`}
          x={personalLogoX}
          y={y + 8 * scale}
          width={personalLogoWidth}
          height={personalLogoHeight}
          preserveAspectRatio="xMaxYMid meet"
          style={{
            filter:
              'drop-shadow(0 1px 1px rgba(255,255,255,0.85)) drop-shadow(0 2px 3px rgba(0,0,0,0.85))',
          }}
        />
      )}
    </g>
  );
}

function InstagramCarouselLayout({
  asset,
  template,
  agent,
  organization,
  brokerage,
  clipPrefix,
}: PreviewProps & {
  clipPrefix: string;
}) {
  const { width, height, tokens } =
    template;
  const editorial =
    tokens.layout === 'editorial';
  const banded =
    tokens.layout === 'banded';
  const framed =
    tokens.layout === 'framed';
  const headlineLength = Array.from(
    asset.headline.trim()
  ).length;
  const headlineNeedsRoom =
    headlineLength > 42;
  const headlineIsDense =
    headlineLength > 88;
  const headlineValue = banded
    ? asset.headline.toUpperCase()
    : asset.headline;
  const headingSize = editorial
    ? headlineIsDense
      ? 50
      : headlineNeedsRoom
      ? 62
      : 74
    : banded
    ? headlineIsDense
      ? 46
      : headlineNeedsRoom
      ? 58
      : 70
    : headlineIsDense
    ? 48
    : headlineNeedsRoom
    ? 59
    : 68;
  const headingWeight = editorial
    ? 500
    : banded
    ? 900
    : 700;
  const headingLetterSpacing =
    editorial
      ? -0.8
      : banded
      ? 0.7
      : -1.2;
  const headingLineHeight =
    headingSize * 1.08;
  const detailFontSize = editorial
    ? 36
    : banded
    ? 39
    : 34;
  const detailLineHeight =
    detailFontSize * 1.4;
  const photoX = framed
    ? width * 0.06
    : 0;
  const photoY = framed
    ? height * 0.06
    : 0;
  const photoWidth = framed
    ? width * 0.88
    : width;
  const photoHeight = framed
    ? height * 0.52
    : height;
  const contentX = editorial
    ? width * 0.04
    : banded
    ? 0
    : width * 0.06;
  const contentWidth = editorial
    ? width * 0.88
    : banded
    ? width
    : width * 0.88;
  const contentBottom = banded
    ? 0
    : height * 0.04;
  const contentPadding = framed
    ? 44
    : 48;
  const innerWidth =
    contentWidth - contentPadding * 2;
  const headingLines = linesFor(
    headlineValue,
    innerWidth,
    3,
    headingSize,
    headingWeight,
    headingLetterSpacing
  );
  const detailLines = linesFor(
    asset.detail,
    innerWidth,
    2,
    detailFontSize,
    500
  );
  const factsHeight =
    asset.facts.length > 0 ? 44 : 0;
  const agentScale = 1.55;
  const agentHeight =
    asset.showContactCard
      ? 104 * agentScale
      : 0;
  const footerHeight = 128;
  const requiredHeight =
    contentPadding +
    headingSize +
    (headingLines.length - 1) *
      headingLineHeight +
    20 +
    detailFontSize +
    (detailLines.length - 1) *
      detailLineHeight +
    (factsHeight
      ? 26 + factsHeight
      : 0) +
    (agentHeight
      ? 30 + agentHeight
      : 0) +
    28 +
    footerHeight +
    20;
  const maximumContentHeight =
    editorial
      ? height *
        (asset.showContactCard
          ? 0.64
          : headlineIsDense
          ? 0.66
          : headlineNeedsRoom
          ? 0.59
          : 0.51)
      : banded
      ? height *
        (asset.showContactCard
          ? 0.6
          : headlineIsDense
          ? 0.62
          : headlineNeedsRoom
          ? 0.55
          : 0.47)
      : height;
  const framedTop =
    height *
    (asset.showContactCard
      ? 0.46
      : headlineIsDense
      ? 0.44
      : headlineNeedsRoom
      ? 0.53
      : 0.62);
  const contentHeight = framed
    ? height -
      contentBottom -
      framedTop
    : Math.min(
        maximumContentHeight,
        Math.max(
          requiredHeight,
          height * 0.34
        )
      );
  const contentY = framed
    ? framedTop
    : height -
      contentBottom -
      contentHeight;
  const headingY =
    contentY +
    contentPadding +
    headingSize;
  const detailY =
    headingY +
    (headingLines.length - 1) *
      headingLineHeight +
    detailFontSize +
    20;
  const factsY =
    detailY +
    (detailLines.length - 1) *
      detailLineHeight +
    28;
  const footerY =
    contentY +
    contentHeight -
    footerHeight -
    20;
  const agentY =
    footerY - agentHeight - 24;
  const primaryPhoto =
    asset.photos[0];
  const overlayId = `${clipPrefix}-carousel-overlay`;
  const contentId = `${clipPrefix}-carousel-content`;
  const chipX = framed
    ? width * 0.08
    : width * 0.05;
  const chipY = framed
    ? height * 0.08
    : height * 0.045;

  return (
    <>
      <defs>
        <linearGradient
          id={overlayId}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          {banded ? (
            <>
              <stop
                offset="45%"
                stopColor="#0f3b63"
                stopOpacity={0.02}
              />
              <stop
                offset="100%"
                stopColor="#0f3b63"
                stopOpacity={0.28}
              />
            </>
          ) : (
            <>
              <stop
                offset="42%"
                stopColor="#080809"
                stopOpacity={0}
              />
              <stop
                offset="100%"
                stopColor="#080809"
                stopOpacity={0.58}
              />
            </>
          )}
        </linearGradient>
        <linearGradient
          id={contentId}
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          <stop
            offset="0%"
            stopColor="#09090a"
            stopOpacity={0.91}
          />
          <stop
            offset="100%"
            stopColor="#1e1e20"
            stopOpacity={0.74}
          />
        </linearGradient>
      </defs>
      <rect
        width={width}
        height={height}
        fill={tokens.canvas}
      />
      <Photo
        url={primaryPhoto?.url || ''}
        label={
          primaryPhoto?.verifiedLabel ||
          'Listing property photo'
        }
        x={photoX}
        y={photoY}
        width={photoWidth}
        height={photoHeight}
        radius={framed ? 12 : 0}
        clipId={`${clipPrefix}-carousel-photo`}
        filter={tokens.imageFilter}
      />
      {!framed && (
        <rect
          x={photoX}
          y={photoY}
          width={photoWidth}
          height={photoHeight}
          fill={`url(#${overlayId})`}
        />
      )}
      <CampaignChip
        value={asset.eyebrow}
        x={chipX}
        y={chipY}
        background={tokens.chipBackground}
        foreground={tokens.chipForeground}
        fontFamily={tokens.bodyFont}
        fontSize={29}
        height={66}
        minimumWidth={180}
        maximumWidth={width * 0.58}
        horizontalPadding={62}
        radius={
          editorial
            ? 4
            : banded
            ? 10
            : 0
        }
        letterSpacing={
          editorial
            ? 4.2
            : banded
            ? 3.2
            : 3.8
        }
      />
      <g>
        <rect
          x={width - 137}
          y={chipY}
          width={83}
          height={58}
          rx={framed ? 0 : 7}
          fill={
            framed
              ? 'rgba(255,255,255,0.85)'
              : 'rgba(0,0,0,0.65)'
          }
        />
        <text
          x={width - 95.5}
          y={chipY + 38}
          fill={
            framed
              ? '#0f172a'
              : '#ffffff'
          }
          fontFamily={tokens.bodyFont}
          fontSize={29}
          fontWeight={800}
          textAnchor="middle"
        >
          {asset.index + 1}/
          {asset.totalAssets}
        </text>
      </g>
      <rect
        x={contentX}
        y={contentY}
        width={contentWidth}
        height={contentHeight}
        fill={
          editorial
            ? `url(#${contentId})`
            : tokens.contentBackground
        }
      />
      {editorial && (
        <line
          x1={contentX}
          x2={contentX}
          y1={contentY}
          y2={contentY + contentHeight}
          stroke={tokens.border}
          strokeWidth={12}
        />
      )}
      {framed && (
        <line
          x1={contentX}
          x2={contentX + contentWidth}
          y1={contentY}
          y2={contentY}
          stroke={tokens.border}
          strokeWidth={6}
        />
      )}
      <SvgText
        value={headlineValue}
        x={contentX + contentPadding}
        y={headingY}
        maximumWidth={innerWidth}
        maximumLines={3}
        lineHeight={headingLineHeight}
        fontSize={headingSize}
        fill={tokens.foreground}
        fontFamily={tokens.headingFont}
        fontWeight={headingWeight}
        letterSpacing={
          headingLetterSpacing
        }
      />
      <SvgText
        value={asset.detail}
        x={contentX + contentPadding}
        y={detailY}
        maximumWidth={innerWidth}
        maximumLines={2}
        lineHeight={detailLineHeight}
        fontSize={detailFontSize}
        fill={tokens.muted}
        fontFamily={tokens.bodyFont}
        fontWeight={500}
      />
      {asset.facts.length > 0 && (
        <Facts
          facts={asset.facts}
          x={contentX + contentPadding}
          y={factsY}
          maximumWidth={innerWidth}
          fill={tokens.accent}
          foreground={
            banded
              ? tokens.accentForeground
              : tokens.foreground
          }
          borderColor={tokens.border}
          fontFamily={tokens.bodyFont}
          compact
          variant={
            banded
              ? 'pills'
              : 'underline'
          }
          uppercase={framed}
        />
      )}
      {asset.showContactCard && (
        <AgentCard
          agent={agent}
          clipPrefix={clipPrefix}
          x={contentX + contentPadding}
          y={agentY}
          width={innerWidth}
          foreground={tokens.foreground}
          muted={tokens.muted}
          accent={tokens.accent}
          accentForeground={
            tokens.accentForeground
          }
          fontFamily={tokens.bodyFont}
          scale={agentScale}
          squareHeadshot={framed}
        />
      )}
      <BrandFooter
        organization={organization}
        brokerage={brokerage}
        x={contentX + contentPadding}
        y={footerY}
        width={innerWidth}
        height={footerHeight}
        color={tokens.foreground}
        borderColor={tokens.border}
        fontFamily={tokens.bodyFont}
        phaseOneSizing
      />
    </>
  );
}

function FullFrameLayout({
  asset,
  template,
  agent,
  organization,
  brokerage,
  clipPrefix,
}: PreviewProps & {
  clipPrefix: string;
}) {
  const { width, height, tokens } =
    template;
  const framed =
    tokens.layout === 'framed';
  const photoInset = framed
    ? width * 0.06
    : 0;
  const photoHeight = framed
    ? height * 0.56
    : height;
  const contentHeight =
    asset.showContactCard
      ? height * 0.48
      : height * 0.39;
  const contentY =
    height - contentHeight;
  const contentX = width * 0.055;
  const contentWidth = width * 0.89;
  const headingSize =
    asset.headline.length > 70
      ? 46
      : asset.headline.length > 40
      ? 56
      : 68;
  const headingWeight =
    tokens.layout === 'editorial'
      ? 500
      : 800;
  const textMaximumWidth =
    contentWidth - 84;
  const headingLineHeight =
    headingSize * 1.06;
  const headingY = contentY + 82;
  const headingLineCount =
    linesFor(
      asset.headline,
      textMaximumWidth,
      3,
      headingSize,
      headingWeight
    ).length;
  const headingBottom =
    headingY +
    (headingLineCount - 1) *
      headingLineHeight;
  const detailY =
    headingBottom + 44;
  const detailLineCount =
    linesFor(
      asset.detail,
      textMaximumWidth,
      2,
      23,
      500
    ).length;
  const detailBottom =
    detailY +
    (detailLineCount - 1) * 30;
  const brandY =
    contentY +
    contentHeight -
    104;
  const factsY = Math.min(
    Math.max(
      contentY +
        contentHeight * 0.59,
      detailBottom + 28
    ),
    brandY - 58
  );
  const primaryPhoto =
    asset.photos[0];
  const overlayId = `${clipPrefix}-full-frame-overlay`;

  return (
    <>
      <rect
        width={width}
        height={height}
        fill={tokens.canvas}
      />
      <Photo
        url={primaryPhoto?.url || ''}
        label={
          primaryPhoto?.verifiedLabel ||
          'Listing property photo'
        }
        x={photoInset}
        y={framed ? height * 0.055 : 0}
        width={
          framed
            ? width - photoInset * 2
            : width
        }
        height={photoHeight}
        radius={framed ? 18 : 0}
        clipId={`${clipPrefix}-primary`}
        filter={tokens.imageFilter}
      />
      <rect
        width={width}
        height={height}
        fill={`url(#${overlayId})`}
      />
      <defs>
        <linearGradient
          id={overlayId}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="42%"
            stopColor={tokens.canvas}
            stopOpacity={0}
          />
          <stop
            offset="100%"
            stopColor={tokens.canvas}
            stopOpacity={framed ? 0.1 : 0.92}
          />
        </linearGradient>
      </defs>
      <CampaignChip
        value={asset.eyebrow}
        x={width * 0.055}
        y={height * 0.055}
        background={tokens.chipBackground}
        foreground={tokens.chipForeground}
        fontFamily={tokens.bodyFont}
      />
      {asset.totalAssets > 1 && (
        <g>
          <rect
            x={width - 132}
            y={height * 0.055}
            width={78}
            height={50}
            rx={7}
            fill="rgba(0,0,0,0.68)"
          />
          <text
            x={width - 93}
            y={height * 0.055 + 33}
            fill="#ffffff"
            fontFamily={tokens.bodyFont}
            fontSize={20}
            fontWeight={800}
            textAnchor="middle"
          >
            {asset.index + 1}/{asset.totalAssets}
          </text>
        </g>
      )}
      <rect
        x={contentX}
        y={contentY}
        width={contentWidth}
        height={contentHeight - height * 0.035}
        rx={tokens.layout === 'editorial' ? 16 : 8}
        fill={tokens.canvas}
        fillOpacity={
          tokens.layout === 'framed'
            ? 0.98
            : 0.93
        }
        stroke={tokens.border}
        strokeWidth={tokens.layout === 'framed' ? 2 : 1}
      />
      <SvgText
        value={asset.headline}
        x={contentX + 42}
        y={headingY}
        maximumWidth={textMaximumWidth}
        maximumLines={3}
        lineHeight={headingLineHeight}
        fontSize={headingSize}
        fill={tokens.foreground}
        fontFamily={tokens.headingFont}
        fontWeight={headingWeight}
      />
      <SvgText
        value={asset.detail}
        x={contentX + 42}
        y={detailY}
        maximumWidth={textMaximumWidth}
        maximumLines={2}
        lineHeight={30}
        fontSize={23}
        fill={tokens.muted}
        fontFamily={tokens.bodyFont}
        fontWeight={500}
      />
      <Facts
        facts={asset.facts}
        x={contentX + 42}
        y={factsY}
        maximumWidth={contentWidth - 84}
        fill={tokens.accent}
        foreground={tokens.accentForeground}
        borderColor={tokens.border}
        fontFamily={tokens.bodyFont}
      />
      {asset.showContactCard && (
        <AgentCard
          agent={agent}
          clipPrefix={clipPrefix}
          x={contentX + 42}
          y={
            contentY +
            contentHeight * 0.64
          }
          width={contentWidth - 84}
          foreground={tokens.foreground}
          muted={tokens.muted}
          accent={tokens.accent}
          accentForeground={
            tokens.accentForeground
          }
          fontFamily={tokens.bodyFont}
        />
      )}
      <BrandFooter
        organization={organization}
        brokerage={brokerage}
        x={contentX + 42}
        y={brandY}
        width={contentWidth - 84}
        height={74}
        color={tokens.foreground}
        borderColor={tokens.border}
        fontFamily={tokens.bodyFont}
      />
    </>
  );
}

function FacebookMosaicLayout({
  asset,
  template,
  organization,
  brokerage,
  clipPrefix,
}: PreviewProps & {
  clipPrefix: string;
}) {
  const { width, height, tokens } =
    template;
  const imageHeight = height * 0.64;
  const leftWidth = width * 0.66;
  const gap = 10;
  const rightWidth =
    width - leftWidth - gap;
  const rightHeight =
    (imageHeight - gap) / 2;
  const textMaximumWidth =
    width - 108;
  const headlineY =
    imageHeight + 84;
  const headlineLines = linesFor(
    asset.headline,
    textMaximumWidth,
    2,
    54,
    800
  );
  const headlineBottom =
    headlineY +
    (headlineLines.length - 1) * 58;
  const detailY = Math.max(
    imageHeight + 214,
    headlineBottom + 70
  );
  const detailLines = linesFor(
    asset.detail,
    textMaximumWidth,
    2,
    23,
    500
  );
  const factsY =
    detailY +
    (detailLines.length - 1) * 30 +
    44;

  return (
    <>
      <rect
        width={width}
        height={height}
        fill={tokens.canvas}
      />
      <Photo
        url={asset.photos[0]?.url || ''}
        label={
          asset.photos[0]?.verifiedLabel ||
          'Main listing photo'
        }
        x={0}
        y={0}
        width={leftWidth}
        height={imageHeight}
        radius={0}
        clipId={`${clipPrefix}-mosaic-0`}
        filter={tokens.imageFilter}
      />
      <Photo
        url={asset.photos[1]?.url || ''}
        label={
          asset.photos[1]?.verifiedLabel ||
          'Supporting listing photo'
        }
        x={leftWidth + gap}
        y={0}
        width={rightWidth}
        height={rightHeight}
        radius={0}
        clipId={`${clipPrefix}-mosaic-1`}
        filter={tokens.imageFilter}
      />
      <Photo
        url={asset.photos[2]?.url || ''}
        label={
          asset.photos[2]?.verifiedLabel ||
          'Supporting listing photo'
        }
        x={leftWidth + gap}
        y={rightHeight + gap}
        width={rightWidth}
        height={rightHeight}
        radius={0}
        clipId={`${clipPrefix}-mosaic-2`}
        filter={tokens.imageFilter}
      />
      <CampaignChip
        value={asset.eyebrow}
        x={48}
        y={48}
        background={tokens.chipBackground}
        foreground={tokens.chipForeground}
        fontFamily={tokens.bodyFont}
      />
      <rect
        x={0}
        y={imageHeight}
        width={width}
        height={height - imageHeight}
        fill={tokens.canvas}
      />
      <SvgText
        value={asset.headline}
        x={54}
        y={headlineY}
        maximumWidth={textMaximumWidth}
        maximumLines={2}
        lineHeight={58}
        fontSize={54}
        fill={tokens.foreground}
        fontFamily={tokens.headingFont}
        fontWeight={800}
      />
      <SvgText
        value={asset.detail}
        x={54}
        y={detailY}
        maximumWidth={textMaximumWidth}
        maximumLines={2}
        lineHeight={28}
        fontSize={23}
        fill={tokens.muted}
        fontFamily={tokens.bodyFont}
        fontWeight={500}
      />
      <Facts
        facts={asset.facts}
        x={54}
        y={factsY}
        maximumWidth={width - 108}
        fill={tokens.accent}
        foreground={tokens.accentForeground}
        borderColor={tokens.border}
        fontFamily={tokens.bodyFont}
        compact
      />
      <BrandFooter
        organization={organization}
        brokerage={brokerage}
        x={54}
        y={height - 88}
        width={width - 108}
        height={68}
        color={tokens.foreground}
        borderColor={tokens.border}
        fontFamily={tokens.bodyFont}
      />
    </>
  );
}

function StoryLayout({
  asset,
  template,
  agent,
  organization,
  brokerage,
  showSafeArea,
  clipPrefix,
}: PreviewProps & {
  clipPrefix: string;
}) {
  const { width, height, tokens } =
    template;
  const topSafe = 220;
  const bottomSafe = 280;
  const overlayId = `${clipPrefix}-story-overlay`;
  const textMaximumWidth =
    width - 128;
  const headingSize = 76;
  const headingLineHeight = 82;
  const headingY = 800;
  const headingLines = linesFor(
    asset.headline,
    textMaximumWidth,
    4,
    headingSize,
    800
  );
  const headingBottom =
    headingY +
    (headingLines.length - 1) *
      headingLineHeight;
  const detailSize = 27;
  const detailLineHeight = 33;
  const detailY =
    headingBottom + 58;
  const footerHeight = 150;
  const safeBottom =
    height - bottomSafe;
  const footerY =
    safeBottom -
    footerHeight -
    32;
  const agentScale = 1.35;
  const agentHeight =
    104 * agentScale;
  const agentY =
    footerY - agentHeight - 42;
  const factsY = agentY - 70;

  return (
    <>
      <rect
        width={width}
        height={height}
        fill={tokens.canvas}
      />
      <Photo
        url={asset.photos[0]?.url || ''}
        label={
          asset.photos[0]?.verifiedLabel ||
          'Listing property photo'
        }
        x={0}
        y={0}
        width={width}
        height={height}
        radius={0}
        clipId={`${clipPrefix}-story`}
        filter={tokens.imageFilter}
      />
      <defs>
        <linearGradient
          id={overlayId}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="30%"
            stopColor={tokens.canvas}
            stopOpacity={0.05}
          />
          <stop
            offset="76%"
            stopColor={tokens.canvas}
            stopOpacity={0.78}
          />
          <stop
            offset="100%"
            stopColor={tokens.canvas}
            stopOpacity={0.98}
          />
        </linearGradient>
      </defs>
      <rect
        width={width}
        height={height}
        fill={`url(#${overlayId})`}
      />
      <CampaignChip
        value={asset.eyebrow}
        x={64}
        y={topSafe + 24}
        background={tokens.chipBackground}
        foreground={tokens.chipForeground}
        fontFamily={tokens.bodyFont}
      />
      <SvgText
        value={asset.headline}
        x={64}
        y={headingY}
        maximumWidth={textMaximumWidth}
        maximumLines={4}
        lineHeight={headingLineHeight}
        fontSize={headingSize}
        fill={tokens.foreground}
        fontFamily={tokens.headingFont}
        fontWeight={800}
      />
      <SvgText
        value={asset.detail}
        x={64}
        y={detailY}
        maximumWidth={textMaximumWidth}
        maximumLines={2}
        lineHeight={detailLineHeight}
        fontSize={detailSize}
        fill={tokens.muted}
        fontFamily={tokens.bodyFont}
        fontWeight={600}
      />
      <Facts
        facts={asset.facts}
        x={64}
        y={factsY}
        maximumWidth={width - 128}
        fill={tokens.accent}
        foreground={tokens.accentForeground}
        borderColor={tokens.border}
        fontFamily={tokens.bodyFont}
      />
      <AgentCard
        agent={agent}
        clipPrefix={clipPrefix}
        x={64}
        y={agentY}
        width={width - 128}
        foreground={tokens.foreground}
        muted={tokens.muted}
        accent={tokens.accent}
        accentForeground={
          tokens.accentForeground
        }
        fontFamily={tokens.bodyFont}
        scale={agentScale}
      />
      <BrandFooter
        organization={organization}
        brokerage={brokerage}
        x={64}
        y={footerY}
        width={width - 128}
        height={footerHeight}
        color={tokens.foreground}
        borderColor={tokens.border}
        fontFamily={tokens.bodyFont}
      />
      {showSafeArea && (
        <g
          data-preview-only="true"
          pointerEvents="none"
        >
          <rect
            x={28}
            y={topSafe}
            width={width - 56}
            height={
              height -
              topSafe -
              bottomSafe
            }
            fill="none"
            stroke="#ffffff"
            strokeWidth={3}
            strokeDasharray="14 12"
            opacity={0.82}
          />
          <text
            x={width - 52}
            y={topSafe + 34}
            fill="#ffffff"
            fontFamily={tokens.bodyFont}
            fontSize={21}
            fontWeight={800}
            textAnchor="end"
          >
            PREVIEW SAFE AREA
          </text>
        </g>
      )}
    </>
  );
}

function LinkedInLayout({
  asset,
  template,
  agent,
  organization,
  brokerage,
  clipPrefix,
}: PreviewProps & {
  clipPrefix: string;
}) {
  const { width, height, tokens } =
    template;
  const imageWidth = width * 0.52;
  const panelX = imageWidth;
  const panelWidth =
    width - imageWidth;
  const panelPadding = 36;
  const innerWidth =
    panelWidth - panelPadding * 2;
  const panelClipId = `${clipPrefix}-linkedin-panel`;
  const headingSize = 40;
  const headingLineHeight = 44;
  const headingY = 132;
  const headingLines = linesFor(
    asset.headline,
    innerWidth,
    3,
    headingSize,
    800
  );
  const headingBottom =
    headingY +
    (headingLines.length - 1) *
      headingLineHeight;
  const detailSize = 18;
  const detailLineHeight = 23;
  const detailY = Math.max(
    278,
    headingBottom + 50
  );
  const detailLines = linesFor(
    asset.detail,
    innerWidth,
    2,
    detailSize,
    500
  );
  const detailBottom =
    detailY +
    (detailLines.length - 1) *
      detailLineHeight;
  const factsY = Math.max(
    342,
    detailBottom + 28
  );

  return (
    <>
      <rect
        width={width}
        height={height}
        fill={tokens.canvas}
      />
      <Photo
        url={asset.photos[0]?.url || ''}
        label={
          asset.photos[0]?.verifiedLabel ||
          'Listing property photo'
        }
        x={0}
        y={0}
        width={imageWidth}
        height={height}
        radius={0}
        clipId={`${clipPrefix}-linkedin`}
        filter={tokens.imageFilter}
      />
      <rect
        x={panelX}
        y={0}
        width={panelWidth}
        height={height}
        fill={tokens.canvas}
      />
      <defs>
        <clipPath id={panelClipId}>
          <rect
            x={panelX}
            y={0}
            width={panelWidth}
            height={height}
          />
        </clipPath>
      </defs>
      <g
        clipPath={`url(#${panelClipId})`}
      >
        <CampaignChip
          value={asset.eyebrow}
          x={panelX + panelPadding}
          y={34}
          background={tokens.chipBackground}
          foreground={tokens.chipForeground}
          fontFamily={tokens.bodyFont}
        />
        <SvgText
          value={asset.headline}
          x={panelX + panelPadding}
          y={headingY}
          maximumWidth={innerWidth}
          maximumLines={3}
          lineHeight={headingLineHeight}
          fontSize={headingSize}
          fill={tokens.foreground}
          fontFamily={tokens.headingFont}
          fontWeight={800}
        />
        <SvgText
          value={asset.detail}
          x={panelX + panelPadding}
          y={detailY}
          maximumWidth={innerWidth}
          maximumLines={2}
          lineHeight={detailLineHeight}
          fontSize={detailSize}
          fill={tokens.muted}
          fontFamily={tokens.bodyFont}
          fontWeight={500}
        />
        <Facts
          facts={asset.facts}
          x={panelX + panelPadding}
          y={factsY}
          maximumWidth={innerWidth}
          fill={tokens.accent}
          foreground={tokens.accentForeground}
          borderColor={tokens.border}
          fontFamily={tokens.bodyFont}
          compact
        />
        <AgentCard
          agent={agent}
          clipPrefix={clipPrefix}
          x={panelX + panelPadding}
          y={400}
          width={innerWidth}
          foreground={tokens.foreground}
          muted={tokens.muted}
          accent={tokens.accent}
          accentForeground={
            tokens.accentForeground
          }
          fontFamily={tokens.bodyFont}
          scale={0.8}
        />
        <BrandFooter
          organization={organization}
          brokerage={brokerage}
          x={panelX + panelPadding}
          y={height - 82}
          width={innerWidth}
          height={66}
          color={tokens.foreground}
          borderColor={tokens.border}
          fontFamily={tokens.bodyFont}
        />
      </g>
    </>
  );
}

function XLayout({
  asset,
  template,
  organization,
  brokerage,
  clipPrefix,
}: PreviewProps & {
  clipPrefix: string;
}) {
  const { width, height, tokens } =
    template;
  const overlayId = `${clipPrefix}-x-overlay`;
  const textMaximumWidth = 740;
  const headingSize = 68;
  const headingLineHeight = 74;
  const headingY = 235;
  const headingLines = linesFor(
    asset.headline,
    textMaximumWidth,
    3,
    headingSize,
    800
  );
  const headingBottom =
    headingY +
    (headingLines.length - 1) *
      headingLineHeight;
  const detailY = Math.max(
    500,
    headingBottom + 52
  );
  const framed =
    tokens.layout === 'framed';

  return (
    <>
      <rect
        width={width}
        height={height}
        fill={tokens.canvas}
      />
      <Photo
        url={asset.photos[0]?.url || ''}
        label={
          asset.photos[0]?.verifiedLabel ||
          'Listing property photo'
        }
        x={0}
        y={0}
        width={width}
        height={height}
        radius={0}
        clipId={`${clipPrefix}-x`}
        filter={tokens.imageFilter}
      />
      <defs>
        <linearGradient
          id={overlayId}
          x1="0"
          y1="0"
          x2="1"
          y2="0"
        >
          <stop
            offset="0%"
            stopColor={tokens.canvas}
            stopOpacity={
              framed ? 0.9 : 0.98
            }
          />
          <stop
            offset="56%"
            stopColor={tokens.canvas}
            stopOpacity={
              framed ? 0.55 : 0.72
            }
          />
          <stop
            offset="100%"
            stopColor={tokens.canvas}
            stopOpacity={0.02}
          />
        </linearGradient>
      </defs>
      <rect
        width={width}
        height={height}
        fill={`url(#${overlayId})`}
      />
      <CampaignChip
        value={asset.eyebrow}
        x={70}
        y={66}
        background={tokens.chipBackground}
        foreground={tokens.chipForeground}
        fontFamily={tokens.bodyFont}
      />
      <SvgText
        value={asset.headline}
        x={70}
        y={headingY}
        maximumWidth={textMaximumWidth}
        maximumLines={3}
        lineHeight={headingLineHeight}
        fontSize={headingSize}
        fill={tokens.foreground}
        fontFamily={tokens.headingFont}
        fontWeight={800}
      />
      <SvgText
        value={asset.detail}
        x={70}
        y={detailY}
        maximumWidth={textMaximumWidth}
        maximumLines={2}
        lineHeight={34}
        fontSize={28}
        fill={tokens.muted}
        fontFamily={tokens.bodyFont}
        fontWeight={600}
      />
      <Facts
        facts={asset.facts}
        x={70}
        y={588}
        maximumWidth={760}
        fill={tokens.accent}
        foreground={tokens.accentForeground}
        borderColor={tokens.border}
        fontFamily={tokens.bodyFont}
      />
      <BrandFooter
        organization={organization}
        brokerage={brokerage}
        x={70}
        y={height - 118}
        width={740}
        height={88}
        color={tokens.foreground}
        borderColor={tokens.border}
        fontFamily={tokens.bodyFont}
      />
    </>
  );
}

function Layout({
  asset,
  template,
  agent,
  organization,
  brokerage,
  showSafeArea,
  clipPrefix,
}: PreviewProps & {
  clipPrefix: string;
}): ReactNode {
  const props = {
    asset,
    template,
    agent,
    organization,
    brokerage,
    showSafeArea,
    clipPrefix,
  };

  switch (template.composition) {
    case 'instagram_carousel':
      return (
        <InstagramCarouselLayout
          {...props}
        />
      );
    case 'facebook_mosaic':
      return (
        <FacebookMosaicLayout
          {...props}
        />
      );
    case 'story_reel':
      return <StoryLayout {...props} />;
    case 'linkedin_landscape':
      return (
        <LinkedInLayout {...props} />
      );
    case 'x_landscape':
      return <XLayout {...props} />;
    case 'instagram_single':
      return (
        <FullFrameLayout {...props} />
      );
    default:
      return (
        <FullFrameLayout {...props} />
      );
  }
}

const ListingSocialCreativePreview =
  forwardRef<
    SVGSVGElement,
    PreviewProps
  >(function ListingSocialCreativePreview(
    {
      asset,
      template,
      agent,
      organization,
      brokerage,
      showSafeArea = true,
    },
    ref
  ) {
    const generatedId = useId()
      .replace(/:/g, '');
    const label = `${
      template.selection.platform
    } ${template.selection.format} creative ${
      asset.index + 1
    } of ${asset.totalAssets}: ${
      asset.headline
    }`;
    const personalLogoDuplicates =
      Boolean(
        agent.logoUrl &&
          [
            organization.logoUrl,
            brokerage.logoUrl,
          ].includes(agent.logoUrl)
      );
    const displayAgent =
      personalLogoDuplicates
        ? {
            ...agent,
            logoUrl: '',
          }
        : agent;

    return (
      <svg
        ref={ref}
        role="img"
        aria-label={label}
        viewBox={`0 0 ${template.width} ${template.height}`}
        xmlns="http://www.w3.org/2000/svg"
        className="h-auto w-full overflow-hidden border shadow-lg"
        style={{
          aspectRatio: `${template.width} / ${template.height}`,
          backgroundColor:
            template.tokens.canvas,
          borderColor:
            template.tokens.border,
          borderRadius:
            template.tokens.radius,
        }}
      >
        <Layout
          asset={asset}
          template={template}
          agent={displayAgent}
          organization={organization}
          brokerage={brokerage}
          showSafeArea={showSafeArea}
          clipPrefix={generatedId}
        />
      </svg>
    );
  });

export default ListingSocialCreativePreview;

export function socialCreativeRequiredImageUrls(
  asset: SocialCreativeAsset,
  agent: SocialAgentBrand,
  organization: SocialOrganizationBrand,
  brokerage: SocialBrokerageBrand
) {
  return Array.from(
    new Set(
      [
        ...asset.photos.map(
          (photo) => photo.url
        ),
        organization.logoUrl,
        brokerage.logoUrl,
        asset.showContactCard
          ? agent.headshotUrl
          : '',
        asset.showContactCard
          ? agent.logoUrl
          : '',
      ].filter(Boolean)
    )
  );
}

function blobAsDataUrl(blob: Blob) {
  return new Promise<string>(
    (resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener(
        'load',
        () => {
          const result =
            typeof reader.result ===
            'string'
              ? reader.result
              : '';

          if (!result) {
            reject(
              new Error(
                'An export image could not be encoded.'
              )
            );
            return;
          }

          resolve(result);
        }
      );
      reader.addEventListener(
        'error',
        () =>
          reject(
            new Error(
              'An export image could not be read.'
            )
          )
      );
      reader.readAsDataURL(blob);
    }
  );
}

async function inlineImages(
  svg: SVGSVGElement,
  requiredImageUrls: string[]
) {
  const loadedUrls = new Set<string>();
  const images = Array.from(
    svg.querySelectorAll('image')
  );

  for (const image of images) {
    const href =
      image.getAttribute('href') || '';

    if (!href) {
      continue;
    }

    if (href.startsWith('data:')) {
      loadedUrls.add(href);
      continue;
    }

    const response = await fetch(href, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(
        `A required export image could not be loaded (${response.status}).`
      );
    }

    const blob = await response.blob();

    if (
      !blob.type
        .toLowerCase()
        .startsWith('image/')
    ) {
      throw new Error(
        'A required export asset was not a valid image.'
      );
    }

    image.setAttribute(
      'href',
      await blobAsDataUrl(blob)
    );
    loadedUrls.add(href);
  }

  const missingRequired =
    requiredImageUrls.filter(
      (url) => !loadedUrls.has(url)
    );

  if (missingRequired.length > 0) {
    throw new Error(
      'A required photo or branding image was not included in the export.'
    );
  }
}

function loadedImage(url: string) {
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
              'The prepared SVG could not be rasterized.'
            )
          )
      );
      image.src = url;
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
          if (!blob || blob.size === 0) {
            reject(
              new Error(
                'The PNG export was empty.'
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

export async function downloadSocialCreativePng({
  svg,
  template,
  filename,
  requiredImageUrls,
}: {
  svg: SVGSVGElement;
  template: SocialTemplateDefinition;
  filename: string;
  requiredImageUrls: string[];
}) {
  const clone =
    svg.cloneNode(true) as SVGSVGElement;
  clone
    .querySelectorAll(
      '[data-preview-only="true"]'
    )
    .forEach((node) =>
      node.remove()
    );
  clone.setAttribute(
    'width',
    String(template.width)
  );
  clone.setAttribute(
    'height',
    String(template.height)
  );
  clone.setAttribute(
    'xmlns',
    'http://www.w3.org/2000/svg'
  );

  await inlineImages(
    clone,
    requiredImageUrls
  );

  const serialized =
    new XMLSerializer().serializeToString(
      clone
    );
  const svgBlob = new Blob(
    [serialized],
    {
      type: 'image/svg+xml;charset=utf-8',
    }
  );
  const svgUrl =
    URL.createObjectURL(svgBlob);

  try {
    const image =
      await loadedImage(svgUrl);
    const canvas =
      document.createElement('canvas');
    canvas.width = template.width;
    canvas.height = template.height;
    const context =
      canvas.getContext('2d');

    if (!context) {
      throw new Error(
        'This browser could not create the PNG canvas.'
      );
    }

    context.drawImage(
      image,
      0,
      0,
      template.width,
      template.height
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
