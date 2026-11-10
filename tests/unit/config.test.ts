import { describe, expect, it } from "vitest";
import { emptyGuildConfig, guildConfigSchema, validateConfigAgainstInventory } from "../../src/lib/config";

const inventory = {
  roles: [{ id: "12345678901234567" }],
  channels: [{ id: "22345678901234567", type: 0 }, { id: "32345678901234567", type: 2 }]
};

describe("guild configuration validation", () => {
  it("matches only the current Rust configuration fields", () => {
    expect(guildConfigSchema.safeParse(emptyGuildConfig).success).toBe(true);
    expect(guildConfigSchema.safeParse({ ...emptyGuildConfig, administratorEnabled: true }).success).toBe(false);
  });

  it("rejects a role that is not part of this guild inventory", () => {
    expect(() => validateConfigAgainstInventory({ ...emptyGuildConfig, prisonerRoleId: "42345678901234567" }, inventory)).toThrow("does not belong to this server");
  });

  it("rejects non-text jail channels", () => {
    expect(() => validateConfigAgainstInventory({ ...emptyGuildConfig, jailChannelId: "32345678901234567" }, inventory)).toThrow("must be a text channel");
  });

  it("accepts known guild resources", () => {
    expect(() => validateConfigAgainstInventory({ ...emptyGuildConfig, prisonerRoleId: inventory.roles[0].id, jailChannelId: inventory.channels[0].id }, inventory)).not.toThrow();
  });
});
