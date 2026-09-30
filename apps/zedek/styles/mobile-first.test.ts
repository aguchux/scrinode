import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Mobile-first, asserted against the stylesheet.
 *
 * §5 makes this a rule about CSS rather than an aspiration: the phone layout
 * is what the stylesheet says with **no media query at all**, and every query
 * is a `min-width` that adds capability as space allows. A `max-width` rule is
 * a desktop layout apologising to a phone, and it inverts the cascade — the
 * phone downloads and then overrides CSS written for a screen it does not have.
 *
 * Nearly all Scrinode's readers are on phones and tablets, so a regression
 * here is a regression for almost everyone.
 */

const workspace = readFileSync(join(__dirname, 'workspace.css'), 'utf8');

describe('the workspace stylesheet', () => {
  it('contains no max-width media query', () => {
    const queries = workspace.match(/@media[^{]*max-width[^{]*/g) ?? [];

    expect(queries).toEqual([]);
  });

  it('adds capability with min-width queries', () => {
    // The inverse check. Zero media queries would also satisfy the rule above
    // while meaning the responsive layout had been deleted.
    const queries = workspace.match(/@media[^{]*min-width[^{]*/g) ?? [];

    expect(queries.length).toBeGreaterThanOrEqual(2);
  });

  it('honours prefers-reduced-motion', () => {
    // §5 and §32. The drawer slide and the status pulse are what move here,
    // and a vestibular trigger is not a preference to ignore.
    expect(workspace).toContain('prefers-reduced-motion');
  });

  it('sizes the composer and search inputs at 16px', () => {
    /*
     * Below 16px, iOS zooms the viewport when a field is focused and never
     * zooms back — the layout is wrong for the rest of the session. It is the
     * most common mobile form bug there is, and it is invisible on a desktop.
     *
     * Both fields set `font-size: 1rem`, which is 16px at the default root.
     */
    const fields = ['.zdk-composer-input', '.zdk-search-input'];

    for (const selector of fields) {
      const block = ruleBlock(workspace, selector);
      expect(block, `${selector} should exist`).toBeTruthy();
      expect(block, `${selector} must be at least 16px or iOS will zoom`).toMatch(
        /font-size:\s*1rem/,
      );
    }
  });

  it('uses dynamic viewport units for the shell height', () => {
    // `100vh` includes mobile Safari's collapsing URL bar, which puts a fixed
    // composer below the fold until the reader scrolls.
    expect(workspace).toContain('100dvh');
    expect(workspace).not.toMatch(/min-height:\s*100vh/);
  });

  it('keeps the drawer out of the tab order while closed', () => {
    // A transform alone leaves a keyboard user tabbing into a panel they
    // cannot see. `visibility` is what removes it (§32).
    const block = ruleBlock(workspace, '.zdk-rail');

    expect(block).toMatch(/visibility:\s*hidden/);
  });

  it('gives every interactive control a 44px target', () => {
    /*
     * §32's touch target, and §5 is explicit that a control which only appears
     * on a wide screen is still touched on a tablet.
     *
     * 2.75rem is 44px. Listed rather than derived, because a regex over every
     * rule would either miss a control or flag a decorative span.
     */
    const controls = [
      '.zdk-rail-toggle',
      '.zdk-composer-button',
      '.zdk-study',
      '.zdk-convo',
      '.zdk-search-input',
    ];

    for (const selector of controls) {
      const block = ruleBlock(workspace, selector);
      expect(block, `${selector} should exist`).toBeTruthy();
      expect(block, `${selector} must meet the 44px touch target`).toMatch(
        /(min-height|height):\s*2\.75rem/,
      );
    }
  });
});

/** The declaration block for a selector, or undefined. */
function ruleBlock(css: string, selector: string): string | undefined {
  // Anchored on the selector followed by ` {`, so `.zdk-rail` does not match
  // `.zdk-rail-toggle`.
  const pattern = new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`);
  return pattern.exec(css)?.[1];
}
