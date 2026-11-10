import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/brand-mark";
import { readSession } from "@/lib/discord";

export const metadata = { robots: { index: false, follow: false } };

const reasons: Record<string, string> = {
  setup: "Discord sign-in is not ready yet. Configure the server credentials and database in the environment first.",
  oauth: "Discord sign-in could not be completed. Start again and approve the requested access.",
  "invite-setup": "The Discord application ID has not been configured yet.",
  "access-denied": "Discord access was not granted. You can retry whenever you are ready."
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  if (await readSession()) redirect("/dashboard");
  const { reason } = await searchParams;
  return (
    <main className="auth-page">
      <Link className="wordmark auth-wordmark" href="/"><BrandMark /><span>JAILBOT<span className="wordmark-dot">.</span></span></Link>
      <div className="auth-card">
        <div className="auth-index">IDENTITY / 01</div>
        <span className="auth-symbol"><BrandMark /></span>
        <p className="eyebrow"><span className="eyebrow-dot"></span> SERVER CONTROL</p>
        <h1>Sign in<br /><em>with Discord.</em></h1>
        <p className="auth-copy">Use your Discord account to find the servers you can manage. Jailbot requests only your identity and server list.</p>
        {reason && reasons[reason] && <p className="auth-message" role="status">{reasons[reason]}</p>}
        <Link className="button button--lime auth-submit" href="/api/auth/discord"><span className="discord-mark">◈</span> Continue with Discord <span>↗</span></Link>
        <p className="auth-footnote">SESSION STORED IN AN HTTP-ONLY COOKIE<br />ACCESS TOKENS ENCRYPTED AT REST</p>
      </div>
      <Link className="auth-back" href="/">← Back to Jailbot</Link>
    </main>
  );
}
