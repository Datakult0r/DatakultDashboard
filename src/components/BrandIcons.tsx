'use client';

/**
 * BrandIcons — small inline SVG marks for the data sources / tools the dashboard
 * shows in CardMeta. All paths embedded, no external SVG fetches (safety).
 */
import type { ComponentType, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const wrap = (paths: React.ReactNode, viewBox = '0 0 24 24'): ComponentType<IconProps> => {
  const Icon = ({ size = 12, ...rest }: IconProps) => (
    <svg width={size} height={size} viewBox={viewBox} xmlns="http://www.w3.org/2000/svg" {...rest}>
      {paths}
    </svg>
  );
  Icon.displayName = 'BrandIcon';
  return Icon;
};

export const LinkedInIcon = wrap(
  <>
    <rect width="24" height="24" rx="3" fill="#0A66C2" />
    <path fill="#fff" d="M5.5 8.5h3v10h-3v-10zm1.5-4.5a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5zM10.5 8.5h2.85v1.4h.04c.4-.74 1.36-1.52 2.8-1.52 3 0 3.55 1.97 3.55 4.55v5.57h-3v-4.94c0-1.18-.02-2.7-1.65-2.7-1.65 0-1.9 1.29-1.9 2.62v5.02h-2.96v-10z" />
  </>,
);
export const ApifyIcon = wrap(
  <>
    <rect width="24" height="24" rx="3" fill="#97CA00" />
    <path fill="#000" d="M7 16.5l5-9 5 9h-2.6l-1-1.8h-2.8l-1 1.8H7zm4.4-3.4h1.2L12 11.1l-.6 2z" />
  </>,
);
export const PerplexityIcon = wrap(
  <>
    <rect width="24" height="24" rx="3" fill="#20808D" />
    <path fill="#fff" d="M12 5l1.5 4.5H18l-3.6 2.6 1.4 4.4L12 13.9 8.2 16.5l1.4-4.4L6 9.5h4.5L12 5z" />
  </>,
);
export const BeeperIcon = wrap(
  <>
    <rect width="24" height="24" rx="6" fill="#0A0A0A" />
    <path fill="#FFC107" d="M7 9c0-1.1.9-2 2-2h6c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2h-3l-3 3v-3H9c-1.1 0-2-.9-2-2V9z" />
  </>,
);
export const GmailIcon = wrap(
  <>
    <rect width="24" height="24" rx="3" fill="#fff" />
    <path fill="#EA4335" d="M4 7l8 5.5L20 7v10a1 1 0 0 1-1 1h-2v-7l-5 3.5L7 11v7H5a1 1 0 0 1-1-1V7z" />
  </>,
);
export const GoogleCalendarIcon = wrap(
  <>
    <rect width="24" height="24" rx="3" fill="#fff" />
    <text x="12" y="17" fontSize="11" fontWeight="700" fontFamily="Arial,sans-serif" fill="#1A73E8" textAnchor="middle">31</text>
  </>,
);
export const BrowserUseIcon = wrap(
  <>
    <rect width="24" height="24" rx="3" fill="#1A1A1A" />
    <circle cx="12" cy="12" r="6" stroke="#7DD3A0" strokeWidth="1.5" fill="none" />
    <path d="M12 8v4l2.5 2" stroke="#7DD3A0" strokeWidth="1.5" strokeLinecap="round" fill="none" />
  </>,
);
export const FirecrawlIcon = wrap(
  <>
    <rect width="24" height="24" rx="3" fill="#FF6B35" />
    <path fill="#fff" d="M12 5c2 2 3 4 3 6.5 0 2-1.4 3.5-3 3.5s-3-1.5-3-3.5C9 9 10 7 12 5zm0 11.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
  </>,
);
export const ArbeitSwissIcon = wrap(
  <>
    <rect width="24" height="24" rx="3" fill="#D52B1E" />
    <rect x="9.5" y="5" width="5" height="14" fill="#fff" />
    <rect x="5" y="9.5" width="14" height="5" fill="#fff" />
  </>,
);
export const RemoteOKIcon = wrap(
  <>
    <rect width="24" height="24" rx="3" fill="#000" />
    <text x="12" y="16" fontSize="9" fontWeight="900" fontFamily="Arial,sans-serif" fill="#fff" textAnchor="middle">RO</text>
  </>,
);

export const BRAND_BY_METHOD: Record<string, ComponentType<IconProps>> = {
  linkedin: LinkedInIcon,
  apify: ApifyIcon,
  perplexity: PerplexityIcon,
  beeper: BeeperIcon,
  gmail: GmailIcon,
  google_calendar: GoogleCalendarIcon,
  browser_use: BrowserUseIcon,
  firecrawl: FirecrawlIcon,
  remoteok: RemoteOKIcon,
  arbeit_swiss: ArbeitSwissIcon,
};
