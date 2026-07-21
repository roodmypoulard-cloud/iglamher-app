// Block + privacy guards. Pure → unit-tested. A block is directional in storage
// but symmetric in effect: if EITHER party blocked the other, all interaction is
// denied. Enforced server-side on message/book/call/view, plus RLS.

export type Interaction = "message" | "book" | "call" | "view_private";

export interface BlockContext {
  /** userIds the viewer has blocked. */
  blockedByViewer: Set<string> | string[];
  /** userIds who have blocked the viewer. */
  blockedViewer: Set<string> | string[];
}

export interface PrivacySettings {
  profileVisibility: "public" | "verified_only" | "private";
  allowMessages: boolean;
  allowCalls: boolean;
}

function has(set: Set<string> | string[], id: string): boolean {
  return Array.isArray(set) ? set.includes(id) : set.has(id);
}

/** True when a block exists in either direction. */
export function isBlocked(ctx: BlockContext, otherUserId: string): boolean {
  return has(ctx.blockedByViewer, otherUserId) || has(ctx.blockedViewer, otherUserId);
}

export function canInteract(
  interaction: Interaction,
  ctx: BlockContext,
  otherUserId: string,
  privacy?: PrivacySettings,
  viewerIsVerified = false,
): boolean {
  if (isBlocked(ctx, otherUserId)) return false;
  if (!privacy) return true;

  switch (interaction) {
    case "message":
      return privacy.allowMessages;
    case "call":
      return privacy.allowCalls;
    case "view_private":
      if (privacy.profileVisibility === "private") return false;
      if (privacy.profileVisibility === "verified_only") return viewerIsVerified;
      return true;
    case "book":
      return privacy.profileVisibility !== "private";
    default:
      return true;
  }
}
