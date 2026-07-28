import { fireEvent } from '@testing-library/react-native';
import { renderWithTheme } from '../test/render';
import { TagField } from './TagField';

const props = {
  label: "What you'll be doing",
  kind: 'activities' as const,
  used: [] as string[],
};

/**
 * The behaviour that makes a short chip row workable: it stays short, it never hides an answer
 * already given, and the long tail behind the `+` is easier to reach than typing a duplicate.
 */
describe('TagField', () => {
  it('shows the seeds for the trip type, not every tag it knows', async () => {
    const view = await renderWithTheme(
      <TagField {...props} trip={{ tripType: 'Work' }} selected={[]} onChange={jest.fn()} />,
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
      <TagField {...props} trip={{ tripType: 'Work' }} selected={['Rockhounding']} onChange={jest.fn()} />,
    );

    expect(view.getByLabelText('Rockhounding')).toBeTruthy();
  });

  it('adds a tag on tap and removes it on a second tap', async () => {
    const onChange = jest.fn();
    const view = await renderWithTheme(
      <TagField {...props} trip={{ tripType: 'Camping' }} selected={[]} onChange={onChange} />,
    );

    await fireEvent.press(view.getByLabelText('Fishing'));
    expect(onChange).toHaveBeenCalledWith(['Fishing']);

    const picked = await renderWithTheme(
      <TagField {...props} trip={{ tripType: 'Camping' }} selected={['Fishing']} onChange={onChange} />,
    );
    await fireEvent.press(picked.getByLabelText('Fishing'));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });

  it('offers a way to the rest', async () => {
    const view = await renderWithTheme(
      <TagField {...props} trip={{ tripType: 'Camping' }} selected={[]} onChange={jest.fn()} />,
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
        trip={{ tripType: 'Camping' }}
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

/**
 * Every axis is the same component now, single-value ones included. Type, travel and lodging
 * were briefly closed sets of ids justified as "structural" — but nothing branched on them, and
 * the travel axis shipped with "Train or boat" as a catch-all, which is what an unfinished list
 * looks like when you won't admit it's unfinished.
 */
describe('TagField, single-value axes', () => {
  it('replaces the choice rather than accumulating', async () => {
    const onChange = jest.fn();
    const view = await renderWithTheme(
      <TagField label="Getting there" kind="travel" single selected={['Driving']} onChange={onChange} />,
    );

    await fireEvent.press(view.getByLabelText('Flying'));
    expect(onChange).toHaveBeenCalledWith(['Flying']);
  });

  it('clears when the chosen chip is tapped again', async () => {
    const onChange = jest.fn();
    const view = await renderWithTheme(
      <TagField label="Getting there" kind="travel" single selected={['Driving']} onChange={onChange} />,
    );

    await fireEvent.press(view.getByLabelText('Driving'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  // The reason these opened up: there is no complete list of ways to sleep somewhere.
  it('lets a single-value axis take something nobody seeded', async () => {
    const view = await renderWithTheme(
      <TagField label="Where you're sleeping" kind="lodging" single selected={['Yurt']} onChange={jest.fn()} />,
    );

    expect(view.getByLabelText('Yurt')).toBeTruthy();
  });

  it('offers the way out on every axis', async () => {
    for (const kind of ['tripType', 'travel', 'lodging'] as const) {
      const view = await renderWithTheme(
        <TagField label={kind} kind={kind} single selected={[]} onChange={jest.fn()} />,
      );
      expect(view.getByLabelText('More')).toBeTruthy();
    }
  });

  // `closed` exists so an axis can be locked down without inventing a second component.
  it('drops the way out when the axis is closed', async () => {
    const view = await renderWithTheme(
      <TagField label="What kind of trip" kind="tripType" single closed selected={[]} onChange={jest.fn()} />,
    );

    expect(view.queryByLabelText('More')).toBeNull();
    expect(view.getByLabelText('Camping')).toBeTruthy();
  });
});
