import { fieldFontSize } from './Input';

/**
 * Mobile Safari zooms the page to focus any field under 16px and never zooms back out, so
 * tapping into an input left the app oversized with its edges cut off until it was pinched back
 * by hand. Body text is 15, which is one pixel into the trap.
 *
 * Tested as a function because the suite runs on the android preset — the web branch is
 * unreachable from a rendered component here, and a screenshot would never show it either.
 */
describe('fieldFontSize', () => {
  it('lifts a sub-16 field to 16 on the web, where the browser is watching', () => {
    expect(fieldFontSize(15, 'web')).toBe(16);
  });

  it('leaves the field alone on a phone, which has no such rule', () => {
    expect(fieldFontSize(15, 'ios')).toBe(15);
    expect(fieldFontSize(15, 'android')).toBe(15);
  });

  // A floor, not a size. A field that was deliberately made bigger stays bigger.
  it('never shrinks a field that was already large enough', () => {
    expect(fieldFontSize(20, 'web')).toBe(20);
  });
});
