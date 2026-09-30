import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Closing } from './closing';

/**
 * The closing band.
 *
 * The waitlist and the footer were merged onto one backdrop. What these guard
 * is what a merge like that quietly loses: the anchors other components scroll
 * to, and the region boundaries a screen reader relies on to tell "join the
 * waitlist" from "footer".
 *
 * The shared backdrop and the divider are CSS, which jsdom does not evaluate,
 * so they are not asserted — an assertion there would pass regardless of
 * whether either worked.
 */
describe('Closing', () => {
  describe('anchors other components depend on', () => {
    it('keeps #waitlist, which the header button and the hero scroll to', () => {
      // Both call getElementById('waitlist'). Losing this id breaks two
      // controls elsewhere with no error anywhere.
      const { container } = render(<Closing />);

      expect(container.querySelector('#waitlist')).toBeInTheDocument();
    });

    it('keeps #about, which the footer nav links to', () => {
      const { container } = render(<Closing />);

      expect(container.querySelector('#about')).toBeInTheDocument();
    });
  });

  describe('regions stay distinguishable', () => {
    it('exposes the waitlist as its own labelled region', () => {
      // Merged onto one backdrop, but not merged semantically: a screen reader
      // should still find "Join the waitlist" rather than meeting the form
      // inside "footer".
      render(<Closing />);

      expect(screen.getByRole('region', { name: 'Join the waitlist' })).toBeInTheDocument();
    });

    it('exposes the footer as a contentinfo landmark', () => {
      render(<Closing />);

      expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    });

    it('keeps the waitlist form outside the footer landmark', () => {
      // Inside it, the form would be announced as part of the site's
      // boilerplate rather than as the page's call to action.
      render(<Closing />);

      const footer = screen.getByRole('contentinfo');
      expect(within(footer).queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  describe('footer links', () => {
    it('renders unbuilt routes as text, never as links', () => {
      // A footer full of dead links is worse than a short one, and an anchor
      // with aria-disabled still navigates on Enter in most browsers.
      render(<Closing />);

      const product = screen.getByRole('navigation', { name: 'Product' });
      expect(within(product).queryByRole('link', { name: 'Scripture' })).not.toBeInTheDocument();
      expect(within(product).getByText('Scripture')).toBeInTheDocument();
    });

    it('keeps the routes that do exist as real links', () => {
      render(<Closing />);

      const account = screen.getByRole('navigation', { name: 'Account' });
      expect(within(account).getByRole('link', { name: 'Sign In' })).toHaveAttribute(
        'href',
        '/signin',
      );
    });
  });

  it('states the year as a constant, not a render-time computation', () => {
    // new Date().getFullYear() is a hydration hazard: across New Year in
    // different time zones the server and the browser disagree, and React
    // reports a mismatch it does not patch up.
    render(<Closing />);

    expect(screen.getByText(/© 2026 Scrinode/)).toBeInTheDocument();
  });

  it('names the licensing basis for the Scripture it quotes', () => {
    // §21 treats provenance as first-class. Saying so in the footer is part of
    // that rather than a footnote nobody writes.
    render(<Closing />);

    expect(screen.getByText(/public-domain and openly licensed/i)).toBeInTheDocument();
  });
});
