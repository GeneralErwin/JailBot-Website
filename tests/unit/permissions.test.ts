import { describe, expect, it } from "vitest";
import { canManageGuild, getBotPermissionString } from "../../src/lib/permissions";

describe("Discord permission bitfields", () => {
  it("allows owners even when the permission field is malformed", () => {
    expect(canManageGuild(true, "not-a-number")).toBe(true);
  });

  it("accepts Administrator and Manage Server using BigInt", () => {
    expect(canManageGuild(false, "8")).toBe(true);
    expect(canManageGuild(false, "32")).toBe(true);
    expect(canManageGuild(false, (8n | (1n << 53n)).toString())).toBe(true);
  });

  it("rejects a member with unrelated permissions or malformed data", () => {
    expect(canManageGuild(false, "1")).toBe(false);
    expect(canManageGuild(false, "9007199254740993x")).toBe(false);
  });

  it("requests the bot's observed capabilities without Administrator", () => {
    const bits = BigInt(getBotPermissionString());
    expect((bits & (1n << 3n)) === 0n).toBe(true);
    for (const bit of [4n, 7n, 10n, 11n, 14n, 27n, 28n, 29n]) expect((bits & (1n << bit)) !== 0n).toBe(true);
  });
});
