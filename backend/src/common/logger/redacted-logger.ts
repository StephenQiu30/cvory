/**
 * Redacts email addresses so logs never expose raw PII.
 */
export function redactEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex <= 1) {
    return '***';
  }
  const domain = email.slice(atIndex + 1);
  return `${email.slice(0, 1)}***@${domain}`;
}
