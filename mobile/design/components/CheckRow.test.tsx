import { CheckRow } from './CheckRow';
import { renderWithTheme } from '../../test/render';

describe('CheckRow', () => {
  /**
   * React Native Web doesn't translate `accessibilityState` into an attribute, so for a while this
   * row announced itself as a checkbox and then said nothing about whether it was ticked. On the
   * suggestion review screen, where every row starts ticked, that reads as "nothing is selected" —
   * the exact opposite of the truth.
   *
   * StateBox escapes the same bug only because it spells the state into its own label, and it's
   * marked decorative inside this row, so nothing else here can cover for it.
   *
   * This asserts the NATIVE half. React Native normalizes `aria-checked` back into
   * `accessibilityState` before it reaches a host node, so the web-only prop that fixes the bug
   * can't be seen from the android preset — that half is verified in a browser.
   */
  it('announces whether it is ticked', async () => {
    const { getByRole, rerender } = await renderWithTheme(
      <CheckRow label="Tent" checked onChange={() => {}} />,
    );
    const state = () => getByRole('checkbox', { name: 'Tent' }).props.accessibilityState;

    expect(state()).toMatchObject({ checked: true });

    await rerender(<CheckRow label="Tent" checked={false} onChange={() => {}} />);
    expect(state()).toMatchObject({ checked: false });
  });

  // One node, not two: the box inside is decorative so a screen reader doesn't read the same
  // control twice, once with the hint and once without.
  it('is a single control even though it draws a box and a label', async () => {
    const { getAllByRole } = await renderWithTheme(
      <CheckRow label="Tent" hint="Sleeps four" checked={false} onChange={() => {}} />,
    );

    expect(getAllByRole('checkbox')).toHaveLength(1);
  });
});
