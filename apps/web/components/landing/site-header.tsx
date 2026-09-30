'use client';

import { useState } from 'react';
import { ArrowIcon, Button, SearchIcon, Wordmark } from '@scrinode/ui';

/**
 * The site header.
 *
 * Now carries §4's navigation — Scripture, Study, Zedek, Work, Library — rather
 * than the coming-soon page's section anchors. The IA is fixed by §4 and must
 * not drift, so these labels match it exactly, with "Zedek AI" as the formal
 * form §45 specifies.
 *
 * **Most links point at routes that do not exist yet.** Those render as plain
 * text rather than anchors, so nobody lands on a 404 and no promise is made
 * that the click cannot keep. As each surface ships, flipping `ready` makes it
 * a real link — one line per route.
 *
 * Profile sits top-right, outside the five domains, as §4 requires.
 */

const NAV = [
  { label: 'Home', href: '/', ready: true },
  { label: 'Scripture', href: '/scripture', ready: false },
  { label: 'Study', href: '/study', ready: false },
  { label: 'Zedek AI', href: '/zedek', ready: false },
  { label: 'Workspaces', href: '/workspaces', ready: false },
  { label: 'Library', href: '/library', ready: false },
] as const;

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      style={{
        position: 'relative',
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        gap: '1.25rem',
        padding: '0.85rem clamp(1rem, 4vw, 2.75rem)',
      }}
    >
      <a href="/" style={{ textDecoration: 'none', flexShrink: 0 }} aria-label="Scrinode home">
        <Wordmark tone="light" size={38} />
      </a>

      <nav
        aria-label="Primary"
        className="scrinode-nav"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '1.6rem',
          marginLeft: '1.5rem',
        }}
      >
        {NAV.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>

      <div
        style={{
          marginLeft: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: '1rem',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          aria-label="Search"
          className="scrinode-header-search"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '2.1rem',
            height: '2.1rem',
            borderRadius: '999px',
            border: '1px solid rgba(247,244,236,0.18)',
            background: 'transparent',
            color: 'rgba(247,244,236,0.86)',
            cursor: 'pointer',
          }}
        >
          <SearchIcon width={17} height={17} />
        </button>

        <a
          href="/signin"
          className="scrinode-signin"
          style={{
            fontSize: '0.875rem',
            color: 'rgba(247,244,236,0.86)',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
          }}
        >
          Sign In
        </a>

        <Button
          variant="gold"
          size="sm"
          onClick={() => document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' })}
        >
          Join Waitlist
          <ArrowIcon width={15} height={15} />
        </Button>

        {/* Below the nav breakpoint the links collapse here (§5). */}
        <button
          type="button"
          className="scrinode-menu-toggle"
          aria-expanded={menuOpen}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((open) => !open)}
          style={{
            display: 'none',
            width: '2.1rem',
            height: '2.1rem',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '0.4rem',
            border: '1px solid rgba(247,244,236,0.18)',
            background: 'transparent',
            color: '#f7f4ec',
            cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none"
               stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            {menuOpen ? (
              <>
                <path d="m6 6 12 12" />
                <path d="M18 6 6 18" />
              </>
            ) : (
              <>
                <path d="M4 7h16" />
                <path d="M4 12h16" />
                <path d="M4 17h16" />
              </>
            )}
          </svg>
        </button>
      </div>

      {menuOpen && (
        <nav
          aria-label="Primary, mobile"
          className="scrinode-mobile-nav"
          style={{
            position: 'absolute',
            top: '100%',
            left: 'clamp(1rem, 4vw, 2.75rem)',
            right: 'clamp(1rem, 4vw, 2.75rem)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.2rem',
            padding: '0.6rem',
            borderRadius: '0.7rem',
            background: 'rgba(16,21,31,0.97)',
            border: '1px solid rgba(247,244,236,0.12)',
            boxShadow: '0 24px 48px -16px rgba(0,0,0,0.6)',
          }}
        >
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} block />
          ))}
        </nav>
      )}
    </header>
  );
}

function NavLink({
  label,
  href,
  ready,
  block = false,
}: {
  readonly label: string;
  readonly href: string;
  readonly ready: boolean;
  readonly block?: boolean;
}) {
  const shared = {
    fontSize: '0.875rem',
    textDecoration: 'none',
    whiteSpace: 'nowrap' as const,
    ...(block ? { padding: '0.55rem 0.6rem', borderRadius: '0.4rem' } : {}),
  };

  if (!ready) {
    // A span, not a disabled link: an anchor with aria-disabled is still
    // focusable and still navigates on Enter in most browsers, which is
    // exactly the 404 this avoids. The title says why rather than leaving a
    // dimmed label unexplained (§32).
    return (
      <span
        title={`${label} is not available yet`}
        style={{ ...shared, color: 'rgba(247,244,236,0.45)', cursor: 'default' }}
      >
        {label}
      </span>
    );
  }

  return (
    <a href={href} style={{ ...shared, color: 'rgba(247,244,236,0.92)' }}>
      {label}
    </a>
  );
}
