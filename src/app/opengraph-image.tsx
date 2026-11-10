import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, color: "#f0f1eb", background: "#101311", fontFamily: "Arial, sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, color: "#d5fb70", fontSize: 24, letterSpacing: 5 }}>
          <div style={{ width: 54, height: 54, border: "1px solid #d5fb70", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 25, fontWeight: 700 }}>J</div>
          JAILBOT
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 72, fontWeight: 700, lineHeight: 1.04, letterSpacing: -3 }}><span>Moderation,</span><span>under control.</span></div>
          <div style={{ color: "#a2aaa1", fontSize: 24, letterSpacing: 1 }}>A focused control panel for Discord jail management.</div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", color: "#7c857d", fontSize: 15, letterSpacing: 3 }}>
          <span>GUILD CONTROL PLANE</span><span>DISCORD · RUST</span>
        </div>
      </div>
    ),
    size
  );
}
