export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');

export interface SendOtpMailInput {
  readonly to: string;
  readonly code: string;
  readonly expiresInMinutes: number;
}

export interface MailProvider {
  sendOtpCode(input: SendOtpMailInput): Promise<void>;
}
