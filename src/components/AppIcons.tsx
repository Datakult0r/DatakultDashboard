'use client';

/** AppIcons — inline SVG brand-mark set for the Clinic of AI Control Tower.
 * Coherent visual language: 24x24 viewBox, currentColor strokes, optional
 * silver-gradient variant for hero placements. Conceptual renderings of
 * universal motifs (clocks, charts, networks) — not derived from any specific
 * third-party design.
 */
import type { ComponentType, SVGProps } from 'react';

type Variant = 'currentColor' | 'silver' | 'accent';
interface IconProps extends SVGProps<SVGSVGElement> {
  size?: number;
  variant?: Variant;
}

function Defs() {
  return (
    <defs>
      <linearGradient id="cot-silver" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%"   stopColor="#F2F2F2" />
        <stop offset="50%"  stopColor="#C9C9C9" />
        <stop offset="100%" stopColor="#8E8E8E" />
      </linearGradient>
    </defs>
  );
}

const wrap = (paths: (variant: Variant) => React.ReactNode): ComponentType<IconProps> => {
  const Icon = ({ size = 18, variant = 'currentColor', ...rest }: IconProps) => {
    const stroke = variant === 'silver' ? '#525252' : 'currentColor';
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"
           fill="none" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" {...rest}>
        <Defs />
        <g>{paths(variant)}</g>
      </svg>
    );
  };
  Icon.displayName = 'AppIcon';
  return Icon;
};

const Plate = ({ variant }: { variant: Variant }) =>
  variant === 'silver' ? (
    <rect x="2" y="2" width="20" height="20" rx="3.5" fill="url(#cot-silver)" stroke="#7C7C7C" strokeWidth="0.8" />
  ) : null;

export const ClinicAIPlusIcon = wrap((v) => (
  <>
    <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6V3z"
          fill={v === 'silver' ? 'url(#cot-silver)' : v === 'accent' ? 'currentColor' : 'none'}
          stroke={v === 'silver' ? '#6E6E6E' : 'currentColor'} />
    <circle cx="9" cy="12" r="1.1" fill="currentColor" />
    <circle cx="15" cy="12" r="1.1" fill="currentColor" />
    <circle cx="12" cy="9" r="1.1" fill="currentColor" />
    <circle cx="12" cy="15" r="1.1" fill="currentColor" />
    <path d="M9 12h6M12 9v6M9 12l3-3 3 3-3 3z" />
  </>
));

export const ConsoleIcon = wrap((v) => (
  <>{Plate({ variant: v })}
    <rect x="5" y="7" width="5" height="4" rx="0.6" />
    <rect x="11" y="6" width="6" height="5" rx="0.6" />
    <path d="M13 7.5l1.2 1.5 1.4-2 .9 1" />
    <rect x="6.5" y="13" width="11" height="6" rx="1" />
    <circle cx="12" cy="16" r="1.2" />
    <path d="M12 14.5v-0.6M12 17.5v0.6M10.5 16h-0.6M13.5 16h0.6" />
  </>
));

export const BroadcastTowerIcon = wrap((v) => (
  <>{Plate({ variant: v })}
    <path d="M8 6c1 1.5 1 3 0 4.5M16 6c-1 1.5-1 3 0 4.5M6 5c1.6 2.2 1.6 4.5 0 7M18 5c-1.6 2.2-1.6 4.5 0 7" />
    <path d="M12 8.5l-2.5 9h5L12 8.5z" />
    <path d="M11 12.5h2" />
    <rect x="9" y="18.5" width="6" height="1.4" rx="0.3" />
  </>
));

export const AICalendarIcon = wrap((v) => (
  <>{Plate({ variant: v })}
    <rect x="6" y="6" width="12" height="12" rx="1.3" />
    <path d="M6 9.5h12M9 5.5v2M15 5.5v2" />
    <text x="12" y="15.5" fontSize="4.5" fontWeight="700" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="Arial,sans-serif">AI</text>
  </>
));

export const DocumentIcon = wrap((v) => (
  <>{Plate({ variant: v })}
    <path d="M8 5.5h6l3 3v10h-9z" />
    <path d="M14 5.5v3h3" />
    <circle cx="11" cy="13.5" r="1.3" />
    <path d="M9 17c.6-1 1.3-1.5 2-1.5s1.4.5 2 1.5" />
  </>
));

export const NetworkedProfileIcon = wrap((v) => (
  <>{Plate({ variant: v })}
    <circle cx="12" cy="10" r="2" />
    <path d="M9 14.5c.6-1.5 1.7-2.3 3-2.3s2.4.8 3 2.3" />
    <circle cx="6.5" cy="7.5" r="1" /><circle cx="17.5" cy="7.5" r="1" />
    <circle cx="6.5" cy="16" r="1" /><circle cx="17.5" cy="16" r="1" />
    <path d="M7.5 8L10 10M16.5 8L14 10M7.5 15.5L10 14M16.5 15.5L14 14" strokeWidth="1.1" />
  </>
));

export const ComplexNetworkIcon = wrap((v) => (
  <>{Plate({ variant: v })}
    <circle cx="7" cy="9" r="1" /><circle cx="17" cy="9" r="1" />
    <circle cx="7" cy="15" r="1" /><circle cx="17" cy="15" r="1" />
    <circle cx="12" cy="6" r="1" /><circle cx="12" cy="18" r="1" />
    <path d="M7 9l5-3M17 9l-5-3M7 15l5 3M17 15l-5 3M7 9v6M17 9v6" strokeWidth="1" />
  </>
));

export const DataGraphIcon = wrap((v) => (
  <>{Plate({ variant: v })}
    <rect x="5.5" y="5.5" width="13" height="13" rx="1" />
    <path d="M5.5 8.5h13" />
    <circle cx="7.2" cy="7" r="0.4" fill="currentColor" stroke="none" />
    <circle cx="8.6" cy="7" r="0.4" fill="currentColor" stroke="none" />
    <path d="M7 16.5l3-3 2.5 2 4-4.5" />
  </>
));

export const StackedCardsIcon = wrap((v) => (
  <>{Plate({ variant: v })}
    <rect x="5" y="9" width="14" height="9" rx="1.3" />
    <rect x="6.2" y="7" width="11.6" height="9" rx="1.3" fill={v === 'silver' ? 'url(#cot-silver)' : 'none'} />
    <rect x="7.4" y="5" width="9.2" height="9" rx="1.3" fill={v === 'silver' ? 'url(#cot-silver)' : 'none'} />
    <path d="M9 8h6M9 10h4" strokeWidth="1.1" />
  </>
));

export const CronIcon = wrap((v) => (
  <>{Plate({ variant: v })}
    <circle cx="11.5" cy="12" r="5.5" />
    <path d="M11.5 8.5v3.5l2.3 1.5" />
    <path d="M19 9.5h2M19 12h2.4M19 14.5h2" strokeWidth="1.2" />
  </>
));

export const BriefingIcon = wrap((v) => (
  <>{Plate({ variant: v })}
    <path d="M5 8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-3l-2.5 2.5L9 16H7a2 2 0 0 1-2-2V8z" />
    <path d="M9 11.5c1-1.5 4.5-1.5 5.5 0-1 1.5-4.5 1.5-5.5 0z" />
    <circle cx="11.7" cy="11.5" r="0.9" fill="currentColor" />
  </>
));

export const NudgeIcon = wrap((v) => (
  <>{Plate({ variant: v })}
    <path d="M9 16.5h6M10.5 16.5v1.5M13.5 16.5v1.5" />
    <path d="M6.5 16.5c1-1.2 1.5-3 1.5-4.5V11a4 4 0 1 1 8 0v1c0 1.5.5 3.3 1.5 4.5z" />
    <circle cx="17" cy="7.5" r="1" fill="currentColor" stroke="none" />
  </>
));

export const QueueProfileIcon = wrap((v) => (
  <>{Plate({ variant: v })}
    <rect x="5" y="9" width="14" height="3" rx="0.6" />
    <rect x="5" y="12.5" width="14" height="3" rx="0.6" />
    <rect x="5" y="16" width="14" height="3" rx="0.6" />
    <circle cx="7.5" cy="7" r="2" />
  </>
));

export const GoalTargetIcon = wrap((v) => (
  <>{Plate({ variant: v })}
    <circle cx="11.5" cy="12" r="6" />
    <circle cx="11.5" cy="12" r="3.5" />
    <circle cx="11.5" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <path d="M16 7.5l3-1-1 3M16 7.5l-4.5 4.5" />
  </>
));

export const WeeklyStatsIcon = wrap((v) => (
  <>{Plate({ variant: v })}
    <path d="M5.5 18.5h14" />
    <rect x="6.5" y="13" width="2" height="5" />
    <rect x="9.5" y="10" width="2" height="8" />
    <rect x="12.5" y="14" width="2" height="4" />
    <rect x="15.5" y="8" width="2" height="10" />
    <path d="M6 11l3-2 3 2 3-3 3 1.5" strokeWidth="1.1" />
  </>
));

export const HandshakeIcon = wrap((v) => (
  <>{Plate({ variant: v })}
    <path d="M5 11l3-2 2 1.5 2-1.5 2 1.5 2-1.5 3 2v3l-3 2-2-1.5-2 1.5-2-1.5-2 1.5L5 14z" />
  </>
));

export const APP_ICONS = {
  clinic: ClinicAIPlusIcon, console: ConsoleIcon, broadcast: BroadcastTowerIcon,
  calendar: AICalendarIcon, document: DocumentIcon, networked_profile: NetworkedProfileIcon,
  complex_network: ComplexNetworkIcon, data_graph: DataGraphIcon, stacked_cards: StackedCardsIcon,
  cron: CronIcon, briefing: BriefingIcon, nudge: NudgeIcon,
  queue: QueueProfileIcon, goal: GoalTargetIcon, weekly_stats: WeeklyStatsIcon, handshake: HandshakeIcon,
} as const;
export type AppIconName = keyof typeof APP_ICONS;
