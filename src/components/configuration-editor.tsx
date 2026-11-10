"use client";

import { useMemo, useState } from "react";
import type { GuildConfig } from "@/lib/config";

type RoleOption = { id: string; name: string; position: number; managed: boolean };
type ChannelOption = { id: string; name: string; type: number; parentId: string | null };

const moduleInfo: { key: keyof GuildConfig["quarantineModules"]; label: string; note: string }[] = [
  { key: "dangerous_role_add", label: "Dangerous role added", note: "Undo grants of roles carrying moderation permissions." },
  { key: "dangerous_role_remove", label: "Dangerous role removed", note: "Restore dangerous roles removed from a member." },
  { key: "role_permission_escalation", label: "Role permission escalation", note: "Restore a role's previous permission set." },
  { key: "channel_permission_escalation", label: "Channel permission escalation", note: "Restore the previous channel overwrite." },
  { key: "jailed_role_changes", label: "Changes to a jailed member", note: "Queue jail repair and quarantine the actor." },
  { key: "channel_deletion", label: "Channel deletion", note: "Quarantine and log the actor; deleted content cannot be recovered." },
  { key: "webhook_raid", label: "Webhook raid containment", note: "Contain webhook bursts and mass-mention activity." }
];

function Switch({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: (value: boolean) => void; label: string; disabled?: boolean }) {
  return <label className={`setting-switch${disabled ? " setting-switch--disabled" : ""}`}><span className="sr-only">{label}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><span className="switch-track" aria-hidden="true"><span></span></span></label>;
}

function SelectField({ label, hint, value, onChange, options, emptyLabel, disabled = false, clearable = true }: { label: string; hint: string; value: string | null; onChange: (value: string | null) => void; options: { id: string; name: string }[]; emptyLabel: string; disabled?: boolean; clearable?: boolean }) {
  return <label className={`select-field${disabled ? " select-field--disabled" : ""}`}><span className="field-label">{label}</span><span className="field-hint">{hint}</span><select value={value ?? ""} disabled={disabled} onChange={(event) => onChange(event.target.value || null)}>{(clearable || value === null) && <option value="">{emptyLabel}</option>}{options.map((option) => <option value={option.id} key={option.id}>{option.name}</option>)}</select></label>;
}

export function ConfigurationEditor({ guildId, initialConfig, initialRevision, roles, channels }: { guildId: string; initialConfig: GuildConfig; initialRevision: number; roles: RoleOption[]; channels: ChannelOption[] }) {
  const [config, setConfig] = useState(initialConfig);
  const [revision, setRevision] = useState(initialRevision);
  const [savedConfig, setSavedConfig] = useState(initialConfig);
  const [status, setStatus] = useState<{ kind: "success" | "error" | "conflict"; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(savedConfig), [config, savedConfig]);
  const textChannels = channels.filter((channel) => channel.type === 0).map(({ id, name }) => ({ id, name: `# ${name}` }));
  const roleOptions = roles.filter((role) => !role.managed).sort((a, b) => b.position - a.position).map(({ id, name }) => ({ id, name }));

  function update<K extends keyof GuildConfig>(key: K, value: GuildConfig[K]) {
    setConfig((current) => ({ ...current, [key]: value }));
    setStatus(null);
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch(`/api/guilds/${guildId}/config`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ schemaVersion: 1, expectedRevision: revision, config })
      });
      const result = await response.json() as { error?: string; revision?: number; config?: GuildConfig };
      if (response.status === 409) {
        setStatus({ kind: "conflict", message: "A newer change exists. Your edits are still here; reload to review the current revision before saving again." });
        return;
      }
      if (!response.ok || !result.config || typeof result.revision !== "number") {
        setStatus({ kind: "error", message: result.error ?? "The configuration could not be saved." });
        return;
      }
      setRevision(result.revision);
      setConfig(result.config);
      setSavedConfig(result.config);
      setStatus({ kind: "success", message: `Saved as revision ${result.revision}. The web service recorded the change; the Rust adapter must acknowledge applying it.` });
    } catch {
      setStatus({ kind: "error", message: "Could not reach the control plane. Your unsaved edits are still on this page." });
    } finally {
      setSaving(false);
    }
  }

  return <section className="configuration-section" id="jail-setup" aria-label="Guild configuration">
    <div className="config-header"><div><p className="dash-kicker"><span className="eyebrow-dot"></span> GUILD SETTINGS</p><h2>Jail configuration</h2><p>Choose only roles and channels reported for this server by the bot.</p></div><div className={`unsaved-indicator${dirty ? " unsaved-indicator--dirty" : ""}`}><i></i>{dirty ? "UNSAVED CHANGES" : "ALL CHANGES SAVED"}</div></div>
    <div className="config-card">
      <div className="config-group-heading"><span>01</span><div><h3>Jail setup</h3><p>These values match the bot&apos;s existing <code>guild_configs</code> fields.</p></div></div>
      <div className="field-grid">
        <SelectField label="Prisoner role" hint="Role added while a member is jailed." value={config.prisonerRoleId} onChange={(value) => update("prisonerRoleId", value)} options={roleOptions} emptyLabel="Select a role" clearable={config.prisonerRoleId === null} />
        <SelectField label="Moderator role" hint="Can jail members below its highest role." value={config.moderatorRoleId} onChange={(value) => update("moderatorRoleId", value)} options={roleOptions} emptyLabel="Select a role" />
        <SelectField label="Jail channel" hint="Text channel prisoners may access." value={config.jailChannelId} onChange={(value) => update("jailChannelId", value)} options={textChannels} emptyLabel="Select a text channel" clearable={config.jailChannelId === null} />
        <SelectField label="Moderation log channel" hint="Destination for jail and release logs." value={config.logsChannelId} onChange={(value) => update("logsChannelId", value)} options={textChannels} emptyLabel="No log channel selected" />
      </div>
      <div className="setting-row"><div><h4>Automatic sentence expiry</h4><p>Release members when their configured jail duration ends.</p></div><Switch label="Automatic sentence expiry" checked={config.autoReleaseEnabled} onChange={(value) => update("autoReleaseEnabled", value)} /></div>
    </div>
    <div className="config-card" id="quarantine">
      <div className="config-group-heading"><span>02</span><div><h3>Quarantine</h3><p>The service and module switches already supported by the Rust bot.</p></div></div>
      <div className="setting-row setting-row--primary"><div><h4>Enable quarantine service</h4><p>Starts or pauses the bot&apos;s quarantine system for this server.</p></div><Switch label="Enable quarantine service" checked={config.quarantineEnabled} onChange={(value) => update("quarantineEnabled", value)} /></div>
      <fieldset className="module-fieldset" disabled={!config.quarantineEnabled}>
        <legend>MODULES / {moduleInfo.length} AVAILABLE</legend>
        {moduleInfo.map((item, index) => <div className="module-row" key={item.key}><span className="module-number">{String(index + 1).padStart(2, "0")}</span><div><h4>{item.label}</h4><p>{item.note}</p></div><Switch label={item.label} checked={config.quarantineModules[item.key]} disabled={!config.quarantineEnabled} onChange={(value) => { setConfig((current) => ({ ...current, quarantineModules: { ...current.quarantineModules, [item.key]: value } })); setStatus(null); }} /></div>)}
      </fieldset>
    </div>
    {status && <div className={`save-feedback save-feedback--${status.kind}`} role={status.kind === "error" ? "alert" : "status"}><span>{status.message}</span>{status.kind === "conflict" && <button type="button" onClick={() => window.location.reload()}>Reload latest revision ↗</button>}</div>}
    <div className="save-bar"><div><span className="save-revision">REVISION / {String(revision).padStart(4, "0")}</span><span className="save-hint">{dirty ? "Changes will be recorded in the configuration audit." : "No pending changes."}</span></div><button className="button button--lime save-button" type="button" disabled={!dirty || saving} onClick={save}>{saving ? "Saving…" : "Save configuration"}<span>↗</span></button></div>
  </section>;
}
