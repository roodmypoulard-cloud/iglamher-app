import { describe, it, expect } from "vitest";
import { isBlocked, canInteract } from "../blocks";

const OTHER = "user-2";

describe("block guards", () => {
  it("blocks are symmetric — either direction denies interaction", () => {
    expect(isBlocked({ blockedByViewer: [OTHER], blockedViewer: [] }, OTHER)).toBe(true);
    expect(isBlocked({ blockedByViewer: [], blockedViewer: [OTHER] }, OTHER)).toBe(true);
    expect(isBlocked({ blockedByViewer: [], blockedViewer: [] }, OTHER)).toBe(false);
  });

  it("a blocked user cannot message, book, call, or view private content", () => {
    const ctx = { blockedByViewer: new Set([OTHER]), blockedViewer: new Set<string>() };
    for (const i of ["message", "book", "call", "view_private"] as const) {
      expect(canInteract(i, ctx, OTHER)).toBe(false);
    }
  });

  it("respects privacy settings when not blocked", () => {
    const ctx = { blockedByViewer: [], blockedViewer: [] };
    const priv = { profileVisibility: "verified_only" as const, allowMessages: false, allowCalls: true };
    expect(canInteract("message", ctx, OTHER, priv)).toBe(false);
    expect(canInteract("call", ctx, OTHER, priv)).toBe(true);
    expect(canInteract("view_private", ctx, OTHER, priv, false)).toBe(false); // unverified viewer
    expect(canInteract("view_private", ctx, OTHER, priv, true)).toBe(true); // verified viewer
  });

  it("private profiles cannot be booked or viewed", () => {
    const ctx = { blockedByViewer: [], blockedViewer: [] };
    const priv = { profileVisibility: "private" as const, allowMessages: true, allowCalls: true };
    expect(canInteract("book", ctx, OTHER, priv)).toBe(false);
    expect(canInteract("view_private", ctx, OTHER, priv, true)).toBe(false);
  });
});
