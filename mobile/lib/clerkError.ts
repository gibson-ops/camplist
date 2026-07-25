/**
 * Clerk v4's "future" API RETURNS errors rather than throwing them, and the shape varies
 * (ClerkAPIResponseError vs a plain runtime error). This normalizes both to a display string.
 *
 * @param error the `error` field from any `signIn.*` / `signUp.*` call
 * @param fallback message to show when Clerk gives us nothing useful
 */
export function clerkErrorMessage(error: unknown, fallback: string): string {
  if (!error) return fallback;
  const anyErr = error as {
    errors?: Array<{ longMessage?: string; message?: string }>;
    message?: string;
  };
  return (
    anyErr.errors?.[0]?.longMessage ?? anyErr.errors?.[0]?.message ?? anyErr.message ?? fallback
  );
}

/**
 * True when a failed `signIn.create()` means "no such user" — our cue to switch to sign-up.
 */
export function isUserNotFound(error: unknown): boolean {
  const anyErr = error as { errors?: Array<{ code?: string }> };
  return Boolean(
    anyErr?.errors?.some(
      (e) => e.code === 'form_identifier_not_found' || e.code === 'identifier_not_found',
    ),
  );
}
