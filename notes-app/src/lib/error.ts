/**
 * Extracts error message from unknown error type
 * Use this in catch blocks: catch (err) { const message = getErrorMessage(err); }
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'An unexpected error occurred';
}
