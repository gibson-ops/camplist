import { fireEvent } from '@testing-library/react-native';
import { renderWithTheme } from '../../test/render';
import { SectionHeader } from './SectionHeader';

describe('SectionHeader', () => {
  it('is inert until given both an expanded state and a toggle', async () => {
    const { queryByRole } = await renderWithTheme(<SectionHeader title="Shared" count="3/8" />);
    expect(queryByRole('button')).toBeNull();
  });

  it('becomes a disclosure control when made collapsible', async () => {
    const onToggle = jest.fn();
    const { getByRole } = await renderWithTheme(
      <SectionHeader title="Shared" count="3/8" expanded onToggle={onToggle} />,
    );

    await fireEvent.press(getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  /**
   * Collapsed means condensed, never hidden. A closed section keeps reporting its own count,
   * so someone else's list stays checkable at a glance — otherwise people stop trusting the
   * screen and expand everything, which defeats collapsing entirely.
   */
  it('keeps showing its count while collapsed', async () => {
    const { getByText } = await renderWithTheme(
      <SectionHeader title="Brooke" count="5/9" expanded={false} onToggle={jest.fn()} />,
    );
    expect(getByText('5/9')).toBeTruthy();
  });

  it('reports open state to a screen reader', async () => {
    const { getByRole, rerender } = await renderWithTheme(
      <SectionHeader title="Walker" expanded={false} onToggle={jest.fn()} />,
    );
    expect(getByRole('button').props.accessibilityState.expanded).toBe(false);

    await rerender(<SectionHeader title="Walker" expanded onToggle={jest.fn()} />);
    expect(getByRole('button').props.accessibilityState.expanded).toBe(true);
  });
});
