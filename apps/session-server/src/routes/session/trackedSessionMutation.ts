import { readTrackedMutation, type SessionMutationResult } from "../../../../../packages/session-protocol/src/sessionMutation";
export { readTrackedMutation };

export async function handleTrackedSessionMutation(
  webSocket: WebSocket,
  tracked: NonNullable<ReturnType<typeof readTrackedMutation>>,
  dispatch: (socket: WebSocket, payload: string) => Promise<void>,
): Promise<void> {
  const response: SessionMutationResult = { type: "session.mutation.result", requestId: tracked.requestId };
  // Existing domain handlers report validation failures to the originating socket.
  // Capture those failures for this request while leaving normal broadcasts intact.
  const replySocket = new Proxy(webSocket, {
    get(target, property) {
      if (property === "send") return (payload: string) => {
        if (typeof payload === "string") {
          const reply = JSON.parse(payload);
          if (reply.type === "session.error") {
            response.error = { code: reply.code, message: reply.message };
            return;
          }
        }
        target.send(payload);
      };
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
  try {
    await dispatch(replySocket, tracked.raw);
  } catch (error) {
    console.error("Tracked session mutation failed", error);
    response.error = { code: "SESSION_MUTATION_FAILED", message: "Não foi possível concluir a alteração na sessão." };
  }
  webSocket.send(JSON.stringify(response));
}
