export type EmailMessage = { to: string; subject: string; text: string };

/** Every email goes through this (BLUEPRINT §4, §12). A real provider is added in milestone 9. */
export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}
