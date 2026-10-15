export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  /** The designed email (owner, 2026-10-15); the text above is its plain-text version. */
  html?: string;
  replyTo?: string;
  /** Extra headers, e.g. List-Unsubscribe for one-click unsubscribe in Gmail. */
  headers?: Record<string, string>;
};

/** What the provider answered: its id for the message, kept in the email log. */
export type EmailReceipt = { id: string | null };

/** Every email goes through this (BLUEPRINT §4, §12). */
export interface EmailSender {
  send(message: EmailMessage): Promise<EmailReceipt>;
}

/** A send that failed. `retry` is false when trying again cannot help (a bad address, a refused key). */
export class EmailSendError extends Error {
  constructor(
    message: string,
    readonly retry: boolean,
  ) {
    super(message);
  }
}
