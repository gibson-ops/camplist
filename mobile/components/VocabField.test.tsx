import { fireEvent } from '@testing-library/react-native';
import { renderWithTheme } from '../test/render';
import { VocabField } from './VocabField';
import { SETTINGS, ACTIVITIES } from '../lib/tripMeta';

/**
 * The selection rules, not the chips. What matters here is that a pick-one field can be UNPICKED
 * (a trip that stopped being a backpacking trip has to be able to say so), and that the stored
 * order of a multi-select is the vocabulary's order rather than the order chips were tapped —
 * otherwise two identical trips serialize differently and stop matching each other.
 */
describe('VocabField', () => {
  it('replaces the choice in a single-select rather than adding to it', async () => {
    const onChange = jest.fn();
    const view = await renderWithTheme(
      <VocabField label="Setting" vocab={SETTINGS} single selected={['car']} onChange={onChange} />,
    );

    await fireEvent.press(view.getByLabelText('Backpacking'));
    expect(onChange).toHaveBeenCalledWith(['backpacking']);
  });

  // A misfired tap has to be undoable, and there's no other affordance to undo it with.
  it('clears a single-select when the chosen chip is tapped again', async () => {
    const onChange = jest.fn();
    const view = await renderWithTheme(
      <VocabField label="Setting" vocab={SETTINGS} single selected={['car']} onChange={onChange} />,
    );

    await fireEvent.press(view.getByLabelText('Car camping'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('accumulates a multi-select and toggles a chosen one back off', async () => {
    const onChange = jest.fn();
    const view = await renderWithTheme(
      <VocabField
        label="Activities"
        vocab={ACTIVITIES}
        selected={['hiking']}
        onChange={onChange}
      />,
    );

    await fireEvent.press(view.getByLabelText('Fishing'));
    expect(onChange).toHaveBeenCalledWith(['hiking', 'fishing']);

    await fireEvent.press(view.getByLabelText('Hiking'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  /**
   * Stored in the vocabulary's order, never in tap order. Two trips described with the same
   * facts have to serialize identically or they won't match each other later.
   */
  it('stores a multi-select in vocabulary order however it was tapped', async () => {
    const onChange = jest.fn();
    const view = await renderWithTheme(
      <VocabField
        label="Activities"
        vocab={ACTIVITIES}
        // 'fishing' precedes 'biking' in ACTIVITIES; tapping the later one first must not win.
        selected={['biking']}
        onChange={onChange}
      />,
    );

    await fireEvent.press(view.getByLabelText('Fishing'));
    expect(onChange).toHaveBeenCalledWith(['fishing', 'biking']);
  });

  it('announces pick-one as a radio and pick-many as a checkbox', async () => {
    const single = await renderWithTheme(
      <VocabField label="Setting" vocab={SETTINGS} single selected={[]} onChange={jest.fn()} />,
    );
    expect(single.getByLabelText('Car camping').props.accessibilityRole).toBe('radio');

    const multi = await renderWithTheme(
      <VocabField label="Activities" vocab={ACTIVITIES} selected={[]} onChange={jest.fn()} />,
    );
    expect(multi.getByLabelText('Hiking').props.accessibilityRole).toBe('checkbox');
  });
});
