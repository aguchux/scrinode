import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Features } from './features';

/**
 * The flip cards.
 *
 * What is asserted here is the part that is easy to lose: **the description is
 * in the document and in the accessible tree without any interaction.** A flip
 * card built the obvious way hides its back face until a pointer hovers, which
 * means a screen-reader user and a touch user without a hover state never
 * receive it (§32).
 *
 * The rotation itself is not asserted. It lives in CSS, which jsdom does not
 * evaluate — an assertion about it would pass regardless of whether the effect
 * worked and would give false confidence.
 */
describe('Features', () => {
  it('renders every capability as a list item', () => {
    // A list, so a screen reader announces "6 items" rather than six loose
    // regions the reader has to count.
    render(<Features />);

    expect(screen.getAllByRole('listitem')).toHaveLength(6);
  });

  it('makes each card a button, not a div with a handler', () => {
    // A button is focusable, responds to Enter and Space, and is announced as
    // operable. A div with an onClick gives none of that (§32), and on touch
    // it is the only way to reach the back face at all.
    render(<Features />);

    expect(screen.getAllByRole('button')).toHaveLength(6);
  });

  describe('the description is never hover-only', () => {
    it('renders every description without any interaction', () => {
      // The whole point. If this fails, the detail is reachable by mouse alone.
      render(<Features />);

      for (const body of [
        'natural language search across the entire Bible',
        'Explore Hebrew, Greek, and more',
        'Discover deeper connections across Scripture',
        'historical, cultural, and literary context',
        'always-on study partner',
        'Organize notes, sermons, research',
      ]) {
        expect(screen.getByText(new RegExp(body.slice(0, 34), 'i')), body).toBeInTheDocument();
      }
    });

    it('keeps the title and its description inside the same button', () => {
      // So the accessible name of the control carries both. Split across
      // siblings, a screen reader announces a button labelled only by its
      // title and the description becomes orphaned text.
      render(<Features />);

      const card = screen
        .getAllByRole('button')
        .find((button) => button.textContent?.includes('Original Languages'));

      expect(card).toBeDefined();
      expect(within(card as HTMLElement).getByText(/Explore Hebrew, Greek/i)).toBeInTheDocument();
    });

    it('does not mark the description as hidden', () => {
      // aria-hidden or hidden on the back face would remove it from the
      // accessible tree even while it is visually revealed — the exact failure
      // this design has to avoid.
      render(<Features />);

      const description = screen.getByText(/always-on study partner/i);
      expect(description).not.toHaveAttribute('aria-hidden');
      expect(description.closest('[aria-hidden="true"]')).toBeNull();
    });
  });

  it('hides the decorative icons from assistive technology', () => {
    // The title beside each already names the capability; announcing "graphic"
    // before it is noise (§32).
    render(<Features />);

    const card = screen
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('Zedek AI'));

    expect(card?.querySelector('[aria-hidden="true"]')).toBeTruthy();
  });

  it('uses the product language §45 fixes', () => {
    // "Zedek AI" formally, never "Zedek Assistant" or "AI Chat".
    render(<Features />);

    expect(screen.getByText('Zedek AI')).toBeInTheDocument();
    expect(screen.getByText('Ministry Workspaces')).toBeInTheDocument();
  });
});
