export function getMessageFromContext(ctx) {
  const msg = ctx.message.text || "";
  return msg.split(" ").slice(1).join(" ");
}
