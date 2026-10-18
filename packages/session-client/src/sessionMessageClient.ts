import { SessionTransport, type SessionTransportOptions } from "./sessionTransport"

export type SessionMessageDecoder<TServerMessage> = (raw: string) => TServerMessage | null

/** Typed transport boundary. The decoder is supplied by the consuming application,
 * so this package does not depend on React or any website-specific models.
 */
export class SessionMessageClient<TClientMessage, TServerMessage> {
  private readonly transport: SessionTransport

  constructor(
    options: Omit<SessionTransportOptions, "onMessage">,
    decoder: SessionMessageDecoder<TServerMessage>,
    onMessage: (message: TServerMessage) => void,
  ) {
    this.transport = new SessionTransport({
      ...options,
      onMessage: (raw) => {
        const message = decoder(raw)
        if (message !== null) onMessage(message)
      },
    })
  }

  get connected(): boolean {
    return this.transport.connected
  }

  connect(): void {
    this.transport.connect()
  }

  disconnect(): void {
    this.transport.disconnect()
  }

  send(message: TClientMessage): boolean {
    return this.transport.sendRaw(JSON.stringify(message))
  }

  /** For wire batching envelopes whose shape is not a public single-operation type. */
  sendRaw(raw: string): boolean {
    return this.transport.sendRaw(raw)
  }
}
