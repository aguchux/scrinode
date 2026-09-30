import type { SVGProps } from 'react';

/**
 * Inline icons.
 *
 * Inline rather than an icon package: these are the only ones the landing page
 * needs, they inherit `currentColor`, and a dependency for six glyphs is the
 * kind of weight §7 says not to add without need.
 *
 * All are decorative. Each is aria-hidden and focusable={false} — a screen
 * reader announcing "graphic" beside a label that already says "Scripture"
 * is noise (§32).
 */
type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...rest }: IconProps) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** The Scrinode mark: an open leaf, for Scripture and growth. */
export function LeafMark(props: IconProps) {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      <path d="M11.4 21.5V12.2C8.9 9.4 5.6 7.9 2.1 7.6c.2 4.9 3.7 9 8.4 9.9v4h.9Z" opacity="0.75" />
      <path d="M12.6 21.5v-4c4.7-.9 8.2-5 8.4-9.9-3.5.3-6.8 1.8-9.3 4.6v9.3h.9Z" />
    </svg>
  );
}

export function BookIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 6.5C10.5 5 8.5 4.3 6 4.3H3.5v13H6c2.5 0 4.5.7 6 2.2" />
      <path d="M12 6.5c1.5-1.5 3.5-2.2 6-2.2h2.5v13H18c-2.5 0-4.5.7-6 2.2" />
      <path d="M12 6.5v13" />
    </Icon>
  );
}

export function StudyIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4 2.5 8.6 12 13.2l9.5-4.6L12 4Z" />
      <path d="M6.5 11v4.6c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6V11" />
    </Icon>
  );
}

/** Zedek. A four-point star: light, not magic. */
export function ZedekIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.2c.5 4.4 4.4 8.3 8.8 8.8-4.4.5-8.3 4.4-8.8 8.8-.5-4.4-4.4-8.3-8.8-8.8 4.4-.5 8.3-4.4 8.8-8.8Z" />
    </Icon>
  );
}

export function WorkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8.2" r="3" />
      <path d="M3.2 19.2c0-2.9 2.6-5.2 5.8-5.2s5.8 2.3 5.8 5.2" />
      <path d="M16.2 6.1a3 3 0 0 1 0 5.9" />
      <path d="M17.6 14.4c1.9.6 3.2 2.3 3.2 4.3" />
    </Icon>
  );
}

export function LibraryIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.2 4.5h3.1v15H4.2z" />
      <path d="M9.4 4.5h3.1v15H9.4z" />
      <path d="m15 5.4 3 .8-3.6 13.5-3-.8z" />
    </Icon>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="2.8" y="5.2" width="18.4" height="13.6" rx="2.2" />
      <path d="m3.6 7 7.3 5.3c.7.5 1.6.5 2.2 0L20.4 7" />
    </Icon>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M18 9.4a6 6 0 1 0-12 0c0 5-2 6.4-2 6.4h16s-2-1.4-2-6.4Z" />
      <path d="M13.7 19.2a2 2 0 0 1-3.4 0" />
    </Icon>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4.5 12h14" />
      <path d="m13 6.5 5.5 5.5L13 17.5" />
    </Icon>
  );
}

/** Magnifier — search, the product's primary verb (§14). */
export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.8" cy="10.8" r="6.5" />
      <path d="m15.6 15.6 4.1 4.1" />
    </Icon>
  );
}

/** Two glyphs side by side — original languages, Greek and Hebrew. */
export function LanguagesIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.4 17.5 7.3 6.8l3.9 10.7" />
      <path d="M4.7 14.2h5.2" />
      <path d="M14.4 9.2h6.2" />
      <path d="M17.5 9.2v8.3" />
      <path d="M14.4 17.5h6.2" />
    </Icon>
  );
}

/** A node linked to three others — cross-references across Scripture (§39). */
export function CrossReferenceIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="5.4" r="2.4" />
      <circle cx="5.2" cy="17.6" r="2.4" />
      <circle cx="18.8" cy="17.6" r="2.4" />
      <path d="M10.8 7.5 6.4 15.5" />
      <path d="m13.2 7.5 4.4 8" />
      <path d="M7.6 17.6h8.8" />
    </Icon>
  );
}

/** An open book with a widening frame — context around the text (§15). */
export function ContextIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 7.6C10.8 6.4 9.2 5.8 7 5.8H4.4v11H7c2.2 0 3.8.6 5 1.8" />
      <path d="M12 7.6c1.2-1.2 2.8-1.8 5-1.8h2.6v11H17c-2.2 0-3.8.6-5 1.8" />
      <path d="M12 7.6v11" />
    </Icon>
  );
}

/** A lamp — insight. Used for Zedek in the feature grid. */
export function InsightIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9.2 17.4a5.6 5.6 0 1 1 5.6 0v1.4a1.4 1.4 0 0 1-1.4 1.4h-2.8a1.4 1.4 0 0 1-1.4-1.4Z" />
      <path d="M10.4 20.8h3.2" />
    </Icon>
  );
}

/** Two figures — shared ministry work and team collaboration (§3.4). */
export function TeamIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="9" cy="8.4" r="3" />
      <path d="M3.6 19.2a5.6 5.6 0 0 1 10.8 0" />
      <path d="M16.2 6.2a3 3 0 0 1 0 5.8" />
      <path d="M17.4 14.2a5.6 5.6 0 0 1 3 5" />
    </Icon>
  );
}

/** A document with lines — notes, sermons and saved work. */
export function DocumentIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 3.4h7.4L19 9v11.6H6Z" />
      <path d="M13.2 3.4V9H19" />
      <path d="M9 13.4h6" />
      <path d="M9 16.6h4" />
    </Icon>
  );
}

/** An upward share arrow — creating and exporting from research (§3.4). */
export function CreateIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 4.2v10" />
      <path d="m8.2 7.8 3.8-3.6 3.8 3.6" />
      <path d="M5 14.4v3.4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-3.4" />
    </Icon>
  );
}

/** A sun over a horizon — the verse of the day. */
export function SunriseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.6 18.4h16.8" />
      <path d="M7.6 18.4a4.4 4.4 0 0 1 8.8 0" />
      <path d="M12 5.2v2.6" />
      <path d="m6.9 7.4 1.8 1.8" />
      <path d="m17.1 7.4-1.8 1.8" />
    </Icon>
  );
}

/** A compass rose — the study workflow, finding a way through (§1). */
export function CompassIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.4" />
      <path d="m15.2 8.8-1.8 4.6-4.6 1.8 1.8-4.6Z" />
    </Icon>
  );
}

/** Sparkles — AI assistance, used sparingly beside Zedek (§6). */
export function SparkIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m12 4 1.6 4.4L18 10l-4.4 1.6L12 16l-1.6-4.4L6 10l4.4-1.6Z" />
      <path d="M18.4 15.2l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7Z" />
    </Icon>
  );
}

/** A chevron, for disclosure rows and menus. */
export function ChevronIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9 6 6 6-6 6" />
    </Icon>
  );
}

/** A filled play triangle in a ring — the overview video control. */
export function PlayIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M10.2 8.6 16 12l-5.8 3.4Z" fill="currentColor" stroke="none" />
    </Icon>
  );
}
