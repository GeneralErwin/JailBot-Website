import Link from "next/link";
import { Arrow } from "@/components/arrow";
import { BrandMark } from "@/components/brand-mark";

const featureItems = [
  {
    number: "01",
    title: "A clear jail setup",
    text: "Choose the Prisoner role, jail channel, moderator role and log destination in one server-specific view.",
    glyph: "⌖"
  },
  {
    number: "02",
    title: "Quarantine, by module",
    text: "See the seven supported quarantine modules and decide which protections are active for your community.",
    glyph: "◈"
  },
  {
    number: "03",
    title: "One server at a time",
    text: "Discord identity and guild permissions are checked on the server before a configuration can be read or changed.",
    glyph: "↗"
  }
];

const faqItems = [
  ["Is this a replacement for the Rust bot?", "No. Jailbot Control is a separate web application. The Rust bot remains responsible for Discord moderation and keeps its own local state and repair loops."],
  ["Which settings can I manage?", "The panel is based on the current bot configuration: jail and log channels, Prisoner and moderator roles, automatic release, quarantine, and its seven modules."],
  ["Can every server member access settings?", "No. Sign-in uses Discord. Each protected request verifies that you own the server or hold Administrator or Manage Server permissions."],
  ["Does the dashboard already sync to my bot?", "Yes. The optional Rust adapter sends signed server inventory and heartbeats, polls website settings, and queues changes made through existing bot commands. Set the matching control-plane keys in both deployments to enable it."]
];

function TopBar() {
  return (
    <header className="topbar">
      <Link className="wordmark" href="/" aria-label="Jailbot home"><BrandMark /><span>JAILBOT<span className="wordmark-dot">.</span></span></Link>
      <nav className="desktop-nav" aria-label="Main navigation">
        <a href="#capabilities">Capabilities</a>
        <a href="#workflow">How it works</a>
        <a href="#questions">FAQ</a>
      </nav>
      <div className="topbar-actions">
        <Link className="nav-login" href="/api/auth/discord">Sign in <Arrow diagonal /></Link>
        <Link className="button button--small button--lime" href="/api/discord/invite">Add to Discord <Arrow diagonal /></Link>
      </div>
      <details className="mobile-menu">
        <summary aria-label="Open navigation"><span></span><span></span></summary>
        <div className="mobile-menu-panel">
          <a href="#capabilities">Capabilities</a><a href="#workflow">How it works</a><a href="#questions">FAQ</a>
          <Link href="/api/auth/discord">Sign in with Discord</Link><Link href="/api/discord/invite">Add to Discord</Link>
        </div>
      </details>
    </header>
  );
}

function ProductPreview() {
  return (
    <div className="preview-shell" aria-label="Jailbot dashboard preview" role="img">
      <div className="preview-topline"><span className="preview-brand"><BrandMark small /> CONTROL / 01</span><span className="preview-ghost">WEB CONSOLE</span></div>
      <div className="preview-window">
        <aside className="preview-rail">
          <div className="rail-server"><span className="rail-glyph">JB</span><span>SERVER<br />CONTROL</span><span className="rail-chevron">⌄</span></div>
          <div className="rail-section">WORKSPACE</div>
          <div className="rail-item rail-item--active"><span className="rail-icon">◫</span>Overview</div>
          <div className="rail-item"><span className="rail-icon">⌖</span>Jail setup</div>
          <div className="rail-item"><span className="rail-icon">◈</span>Quarantine</div>
          <div className="rail-item"><span className="rail-icon">≡</span>Activity</div>
          <div className="rail-bottom"><span className="online-dot"></span>Awaiting bot handshake</div>
        </aside>
        <div className="preview-content">
          <div className="preview-breadcrumb">WORKSPACE <span>/</span> OVERVIEW</div>
          <div className="preview-title-row"><div><div className="preview-eyebrow">SERVER CONTROL</div><div className="preview-title">Your moderation,<br />in one place.</div></div><span className="preview-stamp">SETUP<br />REQUIRED</span></div>
          <div className="preview-rule"></div>
          <div className="preview-cells">
            <div className="preview-cell"><span className="cell-label">BOT CONNECTION</span><span className="cell-value"><i className="status-square"></i>Not paired</span><span className="cell-caption">Connect the Rust service</span></div>
            <div className="preview-cell"><span className="cell-label">CONFIGURATION</span><span className="cell-value">Revision —</span><span className="cell-caption">Guild-scoped settings</span></div>
          </div>
          <div className="preview-callout"><span className="callout-mark">i</span><span>Settings unlock after the bot reports its guild configuration and Discord inventory.</span><Arrow diagonal /></div>
          <div className="preview-footer"><span>JAILBOT CONTROL PLANE</span><span>VERSIONED · SERVER-SCOPED</span></div>
        </div>
      </div>
      <div className="preview-caption"><span>CONTROL PANEL / CONCEPT VIEW</span><span>01 — 04</span></div>
      <span className="preview-coordinate preview-coordinate--top">35°41&apos; N<br />51°25&apos; E</span>
      <span className="preview-coordinate preview-coordinate--bottom">JAILBOT_SYSTEMS<br />FIG. 001</span>
    </div>
  );
}

function SectionLabel({ index, children }: { index: string; children: React.ReactNode }) {
  return <div className="section-label"><span>{index}</span><span className="section-label-line"></span><span>{children}</span></div>;
}

export default function Home() {
  return (
    <>
      <TopBar />
      <main>
        <section className="hero page-frame">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-dot"></span> DISCORD MODERATION SYSTEM <span className="eyebrow-divider">/</span> RUST</div>
            <h1>Moderation,<br /><em>under control.</em></h1>
            <p className="hero-intro">A considered control panel for the work behind a jail workflow. Configure each server with clarity, and keep your Rust bot in command.</p>
            <div className="hero-actions">
              <Link className="button button--lime" href="/api/discord/invite">Add to Discord <Arrow diagonal /></Link>
              <Link className="button button--outline" href="/api/auth/discord"><span className="discord-mark">◈</span> Open dashboard</Link>
            </div>
            <div className="hero-note"><span className="hero-note-line"></span><span>BUILT FOR THE PEOPLE WHO KEEP A SERVER IN ORDER.</span></div>
          </div>
          <ProductPreview />
          <div className="hero-index"><span>01</span><span className="hero-index-rule"></span><span>CONTROL PLANE</span></div>
        </section>

        <section className="signal-strip" aria-label="Platform principles">
          <div className="signal-strip-inner page-frame">
            <span>MADE FOR DISCORD</span><i></i><span>RUST BOT, PRESERVED</span><i></i><span>GUILD BY GUILD</span><i></i><span>PERMISSION CHECKED</span>
          </div>
        </section>

        <section className="section page-frame capabilities" id="capabilities">
          <div className="section-heading">
            <SectionLabel index="01">CAPABILITIES</SectionLabel>
            <div className="section-heading-copy"><h2>The right controls.<br /><span>Nothing in the way.</span></h2><p>Every setting follows the current Rust bot configuration. No mystery switches. No server-wide spillover.</p></div>
          </div>
          <div className="feature-grid">
            {featureItems.map((item) => (
              <article className="feature-item" key={item.number}>
                <div className="feature-meta"><span>{item.number} / 03</span><span className="feature-glyph">{item.glyph}</span></div>
                <h3>{item.title}</h3><p>{item.text}</p>
                <div className="feature-bottom"><span>JAILBOT CONTROL</span><span>↗</span></div>
              </article>
            ))}
          </div>
        </section>

        <section className="showcase" id="workflow">
          <div className="showcase-inner page-frame">
            <div className="showcase-copy">
              <SectionLabel index="02">A BETTER WORKFLOW</SectionLabel>
              <div className="showcase-title"><h2>From server list<br />to <span>set up.</span></h2><p>Sign in, choose a server where you have permission, and make changes against that server’s own configuration.</p></div>
              <ol className="steps-list">
                <li><span>01</span><div><b>Connect with Discord</b><small>Identity and server access stay on the server.</small></div></li>
                <li><span>02</span><div><b>Choose your community</b><small>Only owners and server managers can continue.</small></div></li>
                <li><span>03</span><div><b>Configure with context</b><small>Roles, channels and revisions belong to one guild.</small></div></li>
              </ol>
            </div>
            <div className="blueprint" aria-hidden="true">
              <div className="blueprint-grid"></div>
              <div className="blueprint-ring blueprint-ring--outer"></div><div className="blueprint-ring blueprint-ring--inner"></div>
              <div className="blueprint-axis blueprint-axis--x"></div><div className="blueprint-axis blueprint-axis--y"></div>
              <div className="blueprint-center"><BrandMark /><span>GUILD<br />CONTROL</span></div>
              <div className="blueprint-tag blueprint-tag--a"><i></i> DISCORD IDENTITY</div>
              <div className="blueprint-tag blueprint-tag--b"><i></i> BOT CONFIG</div>
              <div className="blueprint-tag blueprint-tag--c">REVISIONED / GUILD-SCOPED</div>
              <div className="blueprint-coordinate">FIG. 02<br />ACCESS MODEL</div>
              <div className="blueprint-legend"><span><i></i> USER SESSION</span><span><i></i> BOT SYNC</span></div>
            </div>
          </div>
        </section>

        <section className="section page-frame principles">
          <div className="principles-head"><SectionLabel index="03">BUILT WITH INTENT</SectionLabel><h2>Trust is a system<br />you can <span>inspect.</span></h2></div>
          <div className="principle-list">
            <article><span className="principle-index">A / ACCESS</span><div><h3>Permission before panel.</h3><p>Guild permissions are checked again on each protected request—not just when the page loads.</p></div><span className="principle-symbol">↗</span></article>
            <article><span className="principle-index">B / ISOLATION</span><div><h3>One server, one boundary.</h3><p>Configuration, revisions and audit events are tied to a Discord guild ID at every layer.</p></div><span className="principle-symbol">⊙</span></article>
            <article><span className="principle-index">C / INTEGRATION</span><div><h3>Your bot keeps its own engine.</h3><p>The website communicates through a signed API. It never opens the Rust bot’s SQLite database.</p></div><span className="principle-symbol">⌁</span></article>
          </div>
        </section>

        <section className="faq-section" id="questions">
          <div className="faq-inner page-frame"><div className="faq-heading"><SectionLabel index="04">GOOD TO KNOW</SectionLabel><h2>Clear answers<br />before <span>you begin.</span></h2></div>
            <div className="faq-list">{faqItems.map(([question, answer], i) => <details className="faq-item" key={question}><summary><span className="faq-number">0{i + 1}</span><span>{question}</span><span className="faq-toggle">+</span></summary><p>{answer}</p></details>)}</div>
          </div>
        </section>

        <section className="final-cta page-frame">
          <div className="cta-grid" aria-hidden="true"></div><div className="cta-index">JAILBOT / CONTROL SYSTEMS</div>
          <div className="cta-content"><p className="eyebrow"><span className="eyebrow-dot"></span> YOUR SERVER. YOUR RULES.</p><h2>Bring order<br />to the <em>workflow.</em></h2><p>Start with the bot. Then connect your server’s settings in one focused place.</p><div className="hero-actions"><Link className="button button--lime" href="/api/discord/invite">Add to Discord <Arrow diagonal /></Link><Link className="button button--outline" href="/api/auth/discord">Sign in with Discord <Arrow diagonal /></Link></div></div>
          <div className="cta-serial">CONTROL / 001<br />DISCORD MODERATION</div>
        </section>
      </main>
      <footer className="site-footer page-frame"><Link className="wordmark" href="/"><BrandMark /><span>JAILBOT<span className="wordmark-dot">.</span></span></Link><span className="footer-caption">A CONTROL PLANE FOR THE RUST MODERATION BOT.</span><div className="footer-links"><a href="#capabilities">Capabilities</a><a href="#questions">FAQ</a><Link href="/docs">Integration guide <Arrow diagonal /></Link></div><span className="footer-copy">© {new Date().getFullYear()} JAILBOT SYSTEMS</span></footer>
    </>
  );
}
