import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { SiteHeader } from './site-header';

/**
 * The header's menu carries real behaviour — open, dismiss, focus return — and
 * each part of it is something a hand-rolled dropdown usually gets wrong. These
 * assert the behaviour rather than the markup, so a rewrite that keeps the
 * behaviour keeps passing.
 *
 * Visibility is not asserted here. It lives entirely in media queries, which
 * jsdom does not evaluate; asserting it would test nothing and give false
 * confidence. What is asserted is that the *panel* is absent from the DOM when
 * closed — which matters for §32 regardless of viewport, because a panel merely
 * hidden with CSS keeps its links in the tab order.
 */

beforeAll(() => {
  // jsdom has no matchMedia, and the header listens for the desktop
  // breakpoint. A stub that reports "not matching" is the phone case.
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
        dispatchEvent: () => false,
        onchange: null,
      }),
    });
  }
});

const openMenu = async () => {
  const user = userEvent.setup();
  render(<SiteHeader />);
  const toggle = screen.getByRole('button', { name: 'Open menu' });
  await user.click(toggle);

  return { user, toggle };
};

describe('SiteHeader', () => {
  it('renders the §4 navigation with the labels §45 fixes', () => {
    render(<SiteHeader />);

    const nav = screen.getByRole('navigation', { name: 'Primary' });
    for (const label of ['Home', 'Scripture', 'Study', 'Zedek AI', 'Workspaces', 'Library']) {
      expect(within(nav).getByText(label), label).toBeInTheDocument();
    }
  });

  it('keeps the waitlist call to action out of the menu', () => {
    // It is the page's purpose; burying it behind a menu button costs
    // conversions, so it stays in the bar at every width.
    render(<SiteHeader />);

    expect(screen.getByRole('button', { name: /join/i })).toBeInTheDocument();
  });

  describe('routes that do not exist yet', () => {
    it('renders them as text, never as links', () => {
      // An anchor with aria-disabled is still focusable and still navigates on
      // Enter in most browsers — exactly the 404 it looks like it prevents.
      render(<SiteHeader />);

      const nav = screen.getByRole('navigation', { name: 'Primary' });
      expect(within(nav).queryByRole('link', { name: 'Scripture' })).not.toBeInTheDocument();
      expect(within(nav).getByText('Scripture')).toBeInTheDocument();
    });

    it('keeps Home a real link', () => {
      render(<SiteHeader />);

      const nav = screen.getByRole('navigation', { name: 'Primary' });
      expect(within(nav).getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/');
    });

    it('marks them with more than colour in the menu', async () => {
      // §32 forbids colour as the only indicator of state. A dimmed label alone
      // tells a reader with low vision nothing.
      await openMenu();

      const menu = screen.getByRole('navigation', { name: 'Primary, mobile' });
      expect(within(menu).getAllByText('Soon').length).toBeGreaterThan(0);
    });
  });

  describe('the menu', () => {
    it('is absent from the DOM until opened', () => {
      // Not merely hidden: a CSS-hidden panel keeps six destinations in the tab
      // order, so a keyboard reader tabs through invisible links (§32).
      render(<SiteHeader />);

      expect(
        screen.queryByRole('navigation', { name: 'Primary, mobile' }),
      ).not.toBeInTheDocument();
    });

    it('opens on the toggle and reports its state', async () => {
      const { toggle } = await openMenu();

      expect(screen.getByRole('navigation', { name: 'Primary, mobile' })).toBeInTheDocument();
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });

    it('points aria-controls at the panel it opens', async () => {
      const { toggle } = await openMenu();

      const id = toggle.getAttribute('aria-controls');
      expect(id).toBeTruthy();
      expect(document.getElementById(id as string)).toBeInTheDocument();
    });

    it('closes on Escape', async () => {
      const { user } = await openMenu();

      await user.keyboard('{Escape}');

      expect(
        screen.queryByRole('navigation', { name: 'Primary, mobile' }),
      ).not.toBeInTheDocument();
    });

    it('returns focus to the toggle after Escape', async () => {
      // Without the return a keyboard reader is dropped at the top of the
      // document and has to tab back to where they were.
      //
      // Focus is moved INTO the panel first. Asserting straight after the
      // opening click passes whether or not the component returns focus,
      // because the click already left focus on the toggle — a test that
      // cannot fail. Verified by deleting the focus() call, which must fail
      // this.
      const { user, toggle } = await openMenu();

      const menu = screen.getByRole('navigation', { name: 'Primary, mobile' });
      const firstLink = within(menu).getByRole('link', { name: 'Home' });
      firstLink.focus();
      expect(firstLink).toHaveFocus();

      await user.keyboard('{Escape}');

      expect(toggle).toHaveFocus();
    });

    it('closes on a click outside', async () => {
      // The behaviour a menu is expected to have, and the one most hand-rolled
      // dropdowns omit.
      const { user } = await openMenu();

      await user.click(document.body);

      expect(
        screen.queryByRole('navigation', { name: 'Primary, mobile' }),
      ).not.toBeInTheDocument();
    });

    it('stays open when the panel itself is clicked', async () => {
      const { user } = await openMenu();

      await user.click(screen.getByRole('navigation', { name: 'Primary, mobile' }));

      expect(screen.getByRole('navigation', { name: 'Primary, mobile' })).toBeInTheDocument();
    });

    it('closes when a destination is chosen', async () => {
      // Otherwise the panel covers the page the reader just navigated to.
      const { user } = await openMenu();

      const menu = screen.getByRole('navigation', { name: 'Primary, mobile' });
      await user.click(within(menu).getByRole('link', { name: 'Home' }));

      expect(
        screen.queryByRole('navigation', { name: 'Primary, mobile' }),
      ).not.toBeInTheDocument();
    });

    it('carries its own Sign In, which the phone bar has no room for', async () => {
      // Nothing may be unreachable on a phone. Sign In leaves the bar at narrow
      // widths, so the menu holds a second one — both are in the DOM at all
      // times and CSS decides which is visible, so this asserts there are two.
      const { toggle } = await openMenu();

      const links = screen.getAllByRole('link', { name: 'Sign In' });
      expect(links.length).toBe(2);

      const panel = document.getElementById(toggle.getAttribute('aria-controls') as string);
      expect(links.some((link) => panel?.contains(link))).toBe(true);
    });
  });
});
