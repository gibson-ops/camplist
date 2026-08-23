import { fireEvent } from '@testing-library/react-native';
import { renderWithTheme } from '../test/render';
import { TagPickerSheet } from './TagPickerSheet';

const props = {
  visible: true,
  title: "What you'll be doing",
  placeholder: 'Rockhounding',
  pool: ['Fishing', 'Hiking', 'Golf'],
  selected: [] as string[],
  onClose: jest.fn(),
};

/**
 * Free text is what makes the tag set flexible and also what would wreck matching. Everything
 * here is about making the existing spelling easier to reach than typing a new one.
 */
describe('TagPickerSheet', () => {
  it("offers the household's own tags alongside the app's", async () => {
    const view = await renderWithTheme(
      <TagPickerSheet {...props} used={['Rockhounding']} onToggle={jest.fn()} />,
    );

    expect(view.getByLabelText('Rockhounding')).toBeTruthy();
    expect(view.getByLabelText('Fishing')).toBeTruthy();
  });

  it('shows one chip when the household and the app spell a tag differently', async () => {
    const view = await renderWithTheme(
      <TagPickerSheet {...props} used={['FISHING']} onToggle={jest.fn()} />,
    );

    expect(view.getByLabelText('FISHING')).toBeTruthy();
    expect(view.queryByLabelText('Fishing')).toBeNull();
  });

  /**
   * THE DUPLICATE TRAP. Typing "fish" as a search must not offer to create a tag called "fish"
   * while "Fishing" is on screen — and slug-matching can't catch that, because they genuinely
   * are different strings. If the search shows anything, the user is mid-search.
   */
  it('does not offer to create something while a match is on screen', async () => {
    const view = await renderWithTheme(
      <TagPickerSheet {...props} used={[]} onToggle={jest.fn()} />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Rockhounding'), 'fish');

    expect(view.getByLabelText('Fishing')).toBeTruthy();
    expect(view.queryByLabelText('Add "fish"')).toBeNull();
  });

  it('offers to create once nothing matches', async () => {
    const view = await renderWithTheme(
      <TagPickerSheet {...props} used={[]} onToggle={jest.fn()} />,
    );

    await fireEvent.changeText(view.getByPlaceholderText('Rockhounding'), 'Rockhounding');
    expect(view.getByLabelText('Add "Rockhounding"')).toBeTruthy();
  });

  // Starting from an existing tag and typing past it has to end in a create, or "Golf lessons"
  // is unreachable for anyone whose household already uses "Golf".
  it('lets a longer tag through even when it starts with an existing one', async () => {
    const view = await renderWithTheme(
      <TagPickerSheet {...props} used={[]} onToggle={jest.fn()} />,
    );

    const field = view.getByPlaceholderText('Rockhounding');
    await fireEvent.changeText(field, 'Golf');
    expect(view.queryByLabelText('Add "Golf"')).toBeNull();

    await fireEvent.changeText(field, 'Golf lessons');
    expect(view.getByLabelText('Add "Golf lessons"')).toBeTruthy();
  });

  it('hands back the canonical spelling, not what was typed', async () => {
    const onToggle = jest.fn();
    const view = await renderWithTheme(
      <TagPickerSheet {...props} used={['FISHING']} onToggle={onToggle} />,
    );

    await fireEvent.press(view.getByLabelText('FISHING'));
    expect(onToggle).toHaveBeenCalledWith('FISHING');
  });
});
