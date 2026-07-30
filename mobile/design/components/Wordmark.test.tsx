import { Wordmark } from './Wordmark';
import { renderWithTheme } from '../../test/render';

describe('Wordmark', () => {
  /**
   * The generated art ships colour placeholders that the theme fills in. If a
   * token rename ever breaks that substitution the component still renders,
   * just with `__TEXT__` as a fill value and nothing visible, so assert on the
   * substituted output rather than on it rendering at all.
   */
  it('substitutes theme colours into the generated art', async () => {
    const { toJSON } = await renderWithTheme(<Wordmark />);
    const xml = JSON.stringify(toJSON());

    expect(xml).toContain('<svg');
    for (const placeholder of ['__TEXT__', '__AMBER__', '__STONE__']) {
      expect(xml).not.toContain(placeholder);
    }
    expect(xml).toContain('#ffbb1b');
  });

  /** It replaced a screen title, so it has to announce as one. */
  it('announces as a header named Camp List', async () => {
    const { getByLabelText } = await renderWithTheme(<Wordmark />);
    expect(getByLabelText('Camp List')).toBeTruthy();
  });
});
