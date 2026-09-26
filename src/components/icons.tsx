import React from 'react';

/**
 * Small inline SVG icon set — replaces emoji glyphs throughout the UI.
 * Pure presentation, stroke-based, inherits currentColor so they pick up
 * whatever text color their surrounding element sets.
 */

type IconProps = { size?: number; className?: string };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export function IconCheck({ size = 16, className }: IconProps): React.ReactElement {
  return (
    <svg {...base(size)} className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconAlertTriangle({ size = 16, className }: IconProps): React.ReactElement {
  return (
    <svg {...base(size)} className={className}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function IconInfo({ size = 16, className }: IconProps): React.ReactElement {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export function IconChevronDown({ size = 16, className }: IconProps): React.ReactElement {
  return (
    <svg {...base(size)} className={className}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconScale({ size = 16, className }: IconProps): React.ReactElement {
  return (
    <svg {...base(size)} className={className}>
      <path d="M12 3v18" />
      <path d="M5 8h14" />
      <path d="M5 8 2.5 14a3 3 0 0 0 5 0L5 8Z" />
      <path d="M19 8l-2.5 6a3 3 0 0 0 5 0L19 8Z" />
      <path d="M7 21h10" />
    </svg>
  );
}

export function IconArrowRight({ size = 16, className }: IconProps): React.ReactElement {
  return (
    <svg {...base(size)} className={className}>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

export function IconFileText({ size = 32, className }: IconProps): React.ReactElement {
  return (
    <svg {...base(size)} className={className}>
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2Z" />
      <path d="M14 2v6h6" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

export function IconSearch({ size = 16, className }: IconProps): React.ReactElement {
  return (
    <svg {...base(size)} className={className}>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

export function IconExternalLink({ size = 16, className }: IconProps): React.ReactElement {
  return (
    <svg {...base(size)} className={className}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

export function IconRefresh({ size = 16, className }: IconProps): React.ReactElement {
  return (
    <svg {...base(size)} className={className}>
      <path d="M21 12a9 9 0 0 1-15.3 6.4L3 15.7" />
      <path d="M3 12a9 9 0 0 1 15.3-6.4L21 8.3" />
      <path d="M21 3v5h-5" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}
