import type { Study } from '@scrinode/types';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StudyMenu } from './study-menu';

/**
 * The Study switcher.
 *
 * A dropdown is easy to build and easy to build badly. What is asserted here
 * is the part that makes it a menu rather than a div that opens: it closes on
 * Escape and on an outside press, it returns focus, and the keyboard can walk
 * it (§32).
 */

const STUDIES: readonly Pick<Study, 'id' | 'title'>[] = [
  { id: 's1', title: 'Romans Study' },
  { id: 's2', title: 'Advent teaching' },
];

/**
 * `activeStudy` is omitted rather than passed as undefined: the project runs
 * `exactOptionalPropertyTypes`, under which an optional property and one set
 * to undefined are different types.
 */
function setup(
  over: Partial<Omit<React.ComponentProps<typeof StudyMenu>, 'activeStudy'>> & {
    noActiveStudy?: boolean;
  } = {},
) {
  const { noActiveStudy, ...rest } = over;
  const onSelect = vi.fn();
  const onCreate = vi.fn();

  render(
    <StudyMenu
      {...(noActiveStudy ? {} : { activeStudy: STUDIES[0] as Pick<Study, 'id' | 'title'> })}
      studies={STUDIES}
      onSelect={onSelect}
      onCreate={onCreate}
      {...rest}
    />,
  );

  return { onSelect, onCreate, button: screen.getByRole('button', { name: /Study:/ }) };
}

describe('StudyMenu', () => {
  it('names what the control does, not only the Study', () => {
    // "Romans Study" alone reads as a title rather than a switcher (§32).
    //
    // The whitespace between the two parts is not asserted: accessible-name
    // computation normalises it away, so matching on a literal space would be
    // testing jsdom's string joining rather than what a screen reader says.
    const { button } = setup();

    expect(button).toHaveAccessibleName(/^Study:\s*Romans Study$/);
  });

  it('reports its state with aria-expanded', () => {
    const { button } = setup();

    expect(button).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
  });

  it('puts New Workspace last', () => {
    /*
     * The order is the point. It creates rather than selects, so it sits below
     * the choices and below a rule — a create flush among options is easy to
     * hit while scanning for one.
     */
    const { button } = setup();
    fireEvent.click(button);

    const items = screen.getAllByRole('menuitem').concat(screen.getAllByRole('menuitemradio'));
    const labels = screen
      .getAllByRole('menuitem', { name: /New Workspace/ })
      .concat([]);

    expect(labels).toHaveLength(1);
    expect(items.length).toBeGreaterThan(1);

    // The last focusable item in DOM order is the CTA.
    const all = screen.getByRole('menu').querySelectorAll('button');
    expect(all[all.length - 1]).toHaveTextContent('New Workspace');
  });

  it('creates a workspace and closes', () => {
    const { button, onCreate } = setup();
    fireEvent.click(button);

    fireEvent.click(screen.getByRole('menuitem', { name: /New Workspace/ }));

    expect(onCreate).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('selects a Study and closes', () => {
    const { button, onSelect } = setup();
    fireEvent.click(button);

    fireEvent.click(screen.getByRole('menuitemradio', { name: /Advent teaching/ }));

    expect(onSelect).toHaveBeenCalledWith('s2');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('marks the open Study as checked, not by colour alone', () => {
    const { button } = setup();
    fireEvent.click(button);

    expect(screen.getByRole('menuitemradio', { name: /Romans Study/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('closes on Escape and returns focus to the button', () => {
    const { button } = setup();
    fireEvent.click(button);

    // Focus has moved into the menu, so this cannot pass by accident.
    expect(screen.getByRole('menuitemradio', { name: /Romans Study/ })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('closes on an outside press', () => {
    const { button } = setup();
    fireEvent.click(button);

    // pointerdown, not click: a click fires after the press, leaving the menu
    // open under the reader's finger for the length of it.
    fireEvent.pointerDown(document.body);

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('stays open when the press is inside it', () => {
    const { button } = setup();
    fireEvent.click(button);

    fireEvent.pointerDown(screen.getByRole('menu'));

    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('does not listen for Escape while closed', () => {
    // Otherwise a closed menu swallows Escape from a dialog added later.
    setup();

    // No menu is open; nothing should throw and nothing should change.
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('moves through items with the arrow keys', () => {
    const { button } = setup();
    fireEvent.click(button);

    const first = screen.getByRole('menuitemradio', { name: /Romans Study/ });
    const second = screen.getByRole('menuitemradio', { name: /Advent teaching/ });

    fireEvent.keyDown(first, { key: 'ArrowDown' });
    expect(second).toHaveFocus();

    fireEvent.keyDown(second, { key: 'ArrowUp' });
    expect(first).toHaveFocus();
  });

  it('wraps from the last item to the first', () => {
    // Down from "New Workspace" reaches the top rather than dead-ending.
    const { button } = setup();
    fireEvent.click(button);

    const cta = screen.getByRole('menuitem', { name: /New Workspace/ });
    cta.focus();
    fireEvent.keyDown(cta, { key: 'ArrowDown' });

    expect(screen.getByRole('menuitemradio', { name: /Romans Study/ })).toHaveFocus();
  });

  it('still offers New Workspace when there are no Studies', () => {
    // §44's empty state. A reader with no workspace needs the one control that
    // gets them out of it.
    const { button } = setup({ studies: [], noActiveStudy: true });
    fireEvent.click(button);

    expect(screen.getByText('No workspaces yet')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /New Workspace/ })).toBeInTheDocument();
  });

  it('says so when no Study is open', () => {
    const { button } = setup({ studies: [], noActiveStudy: true });

    expect(button).toHaveAccessibleName(/No Study/);
  });
});
