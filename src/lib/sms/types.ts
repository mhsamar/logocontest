export interface SmsSender {
  send(to: string, message: string): Promise<void>;
}
