'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowIcon, Button, SearchIcon, Wordmark } from '@scrinode/ui';

/**
 * The site header.
 *
 * Carries §4's navigation — Scripture, Study, Zedek, Work, Library — and the
 * labels match it exactly, with "Zedek AI" as the formal form §45 specifies.
 *
 * **Most links point at routes that do not exist yet.** Those render as plain
 * text rather than anchors, so nobody lands on a 404 and no promise is made
 * that the click cannot keep. As each surface ships, flipping `ready` makes it
 * a real link — one line per route.
 *
 * ## Mobile first, and that is a CSS rule here
 *
 * The phone layout is the default: wordmark, then a menu button. No media
 * query produces it. Above 64rem the links appear inline and the button goes
 * away.
 *
 * **Nothing that a media query governs carries an inline `display`.** An
 * inline style beats any stylesheet rule, so `display: none` in a class
 * silently does nothing — the bug that put three squeezed panes on a phone
 * (§5). Visibility lives entirely in `globals.css`.
 *
 * The panel is a real menu, not a dropdown: it closes on Escape, on a click
 * outside, and on choosing a destination, and it holds the actions that do not
 * fit in the bar — search and Sign In — so nothing is unreachable on a phone.
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
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  // Escape closes, and focus returns to the button that opened it. Without the
  // return, a keyboard reader is dropped at the top of the document and has to
  // tab back to where they were (§32).
  useEffect(() => {
    if (!menuOpen) return undefined;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      toggleRef.current?.focus();
    };

    // A click anywhere outside the panel dismisses it — the behaviour a menu
    // is expected to have, and the one most hand-rolled dropdowns omit.
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || toggleRef.current?.contains(target)) return;
      setMenuOpen(false);
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [menuOpen]);

  // Crossing into the desktop breakpoint while the panel is open would leave
  // it floating over a nav bar that already shows the same links.
  useEffect(() => {
    const wide = window.matchMedia('(min-width: 64rem)');
    const onChange = () => {
      if (wide.matches) setMenuOpen(false);
    };

    wide.addEventListener('change', onChange);
    return () => wide.removeEventListener('change', onChange);
  }, []);

  const close = () => setMenuOpen(false);

  return (
    <header className="scrinode-header">
      <a href="/" className="scrinode-header-brand" aria-label="Scrinode home">
        {/* Smaller on a phone, where the bar is the scarcest space on the page. */}
        <Wordmark tone="light" size={34} />
      </a>

      <nav aria-label="Primary" className="scrinode-nav">
        {NAV.map((item) => (
          <NavLink key={item.href} {...item} />
        ))}
      </nav>

      <div className="scrinode-header-actions">
        <button type="button" aria-label="Search" className="scrinode-icon-button">
          <SearchIcon width={18} height={18} />
        </button>

        <a href="/signin" className="scrinode-signin">
          Sign In
        </a>

        {/* The one action that stays in the bar at every width: it is the page's
            purpose, and burying it in a menu costs conversions. */}
        <Button
          variant="gold"
          size="sm"
          onClick={() => {
            close();
            document.getElementById('waitlist')?.scrollIntoView({ behavior: 'smooth' });
          }}
        >
          <span className="scrinode-cta-long">Join Waitlist</span>
          <span className="scrinode-cta-short">Join</span>
          <ArrowIcon width={15} height={15} />
        </Button>

        <button
          ref={toggleRef}
          type="button"
          className="scrinode-menu-toggle scrinode-icon-button"
          aria-expanded={menuOpen}
          aria-controls="scrinode-mobile-menu"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MenuGlyph open={menuOpen} />
        </button>
      </div>

      {/*
        Rendered only when open. A panel hidden with CSS keeps its links in the
        tab order, so a keyboard reader tabs through six invisible destinations
        before reaching the page (§32).
      */}
      {menuOpen && (
        <div ref={panelRef} id="scrinode-mobile-menu" className="scrinode-mobile-menu">
          <nav aria-label="Primary, mobile" className="scrinode-mobile-menu-nav">
            {NAV.map((item) => (
              <NavLink key={item.href} {...item} block onNavigate={close} />
            ))}
          </nav>

          <div className="scrinode-mobile-menu-footer">
            <a href="/signin" className="scrinode-mobile-menu-signin" onClick={close}>
              Sign In
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

function MenuGlyph({ open }: { readonly open: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    >
      {open ? (
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
  );
}

function NavLink({
  label,
  href,
  ready,
  block = false,
  onNavigate,
}: {
  readonly label: string;
  readonly href: string;
  readonly ready: boolean;
  readonly block?: boolean;
  readonly onNavigate?: () => void;
}) {
  const className = block ? 'scrinode-nav-link scrinode-nav-link-block' : 'scrinode-nav-link';

  if (!ready) {
    // A span, not a disabled link: an anchor with aria-disabled is still
    // focusable and still navigates on Enter in most browsers, which is
    // exactly the 404 this avoids. The title says why rather than leaving a
    // dimmed label unexplained (§32).
    return (
      <span className={`${className} scrinode-nav-link-pending`} title={`${label} is not available yet`}>
        {label}
        {block && <span className="scrinode-nav-soon">Soon</span>}
      </span>
    );
  }

  return (
    <a href={href} className={className} onClick={onNavigate}>
      {label}
    </a>
  );
}
