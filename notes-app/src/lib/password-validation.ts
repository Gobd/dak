export interface PasswordValidation {
  minLength: boolean;
  hasLower: boolean;
  hasUpper: boolean;
  hasDigit: boolean;
  hasSymbol: boolean;
}

export function validatePassword(password: string): PasswordValidation {
  return {
    minLength: password.length >= 8,
    hasLower: /[a-z]/.test(password),
    hasUpper: /[A-Z]/.test(password),
    hasDigit: /[0-9]/.test(password),
    hasSymbol: /[^a-zA-Z0-9]/.test(password),
  };
}

export function isPasswordValid(password: string): boolean {
  const v = validatePassword(password);
  return v.minLength && v.hasLower && v.hasUpper && v.hasDigit && v.hasSymbol;
}
