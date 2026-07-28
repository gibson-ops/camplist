import { fireEvent } from '@testing-library/react-native';
import { renderWithTheme } from '../test/render';
import { TagField } from './TagField';
import { ACTIVITY_POOL } from '../lib/tripMeta';

const props = {
  label: "What you'll be doing",
  kind: 'activities' as const,
  used: [] as string[],
  pool: ACTIVITY_POOL,
};

/**
 * The behaviour that makes a short chip row workable: it stays short, it never hides an answer
 * already given, and the long tail behind the `+` is easier to reach than typing a duplicate.
 */
describe('TagField', () => {
  it('shows the defaults for the trip type, not every tag it knows', async () => {
    const view = await renderWithTheme(
      <TagField {...props} tripType="work" selected={[]} onChange={jest.fn()} />,
    );

    expect(view.getByLabelText('Presenting')).toBeTruthy();
    expect(view.queryByLabelText('Fishing')).toBeNull();
  });

  /**
   * Changing the trip type may change what ELSE is offered, but a tag already picked has to
   * stay on screen — otherwise correcting the type silently drops an answer.
   */
  it('keeps a selected tag visible even when the type would not suggest it', async () => {
    const view = await renderWithTheme(
      <TagField {...props} tripType="work" selected={['Rockhounding']} onChange={jest.fn()} />,
    );

    expect(view.getByLabelText('Rockhounding')).toBeTruthy();
  });

  it('adds a tag on tap and removes it on a second tap', async () => {
    const onChange = jest.fn();
    const view = await renderWithTheme(
      <TagField {...props} tripType="camping" selected={[]} onChange={onChange} />,
    );

    await fireEvent.press(view.getByLabelText('Fishing'));
    expect(onChange).toHaveBeenCalledWith(['Fishing']);

    const picked = await renderWithTheme(
      <TagField {...props} tripType="camping" selected={['Fishing']} onChange={onChange} />,
    );
    await fireEvent.press(picked.getByLabelText('Fishing'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('offers a way to the rest', async () => {
    const view = await renderWithTheme(
      <TagField {...props} tripType="camping" selected={[]} onChange={jest.fn()} />,
    );

    expect(view.getByLabelText('More')).toBeTruthy();
  });

  /**
   * The household's own spelling outranks the one the app ships with — on screen AND in
   * storage. Showing "Fishing" while quietly saving "FISHING" is a mismatch they'd notice,
   * and it's what stops free text from splitting one tag into three.
   */
  it("renders and stores the household's spelling, not the app's", async () => {
    const onChange = jest.fn();
    const view = await renderWithTheme(
      <TagField
        {...props}
        tripType="camping"
        used={['FISHING']}
        selected={[]}
        onChange={onChange}
      />,
    );

    expect(view.queryByLabelText('Fishing')).toBeNull();
    await fireEvent.press(view.getByLabelText('FISHING'));
    expect(onChange).toHaveBeenCalledWith(['FISHING']);
  });
});
