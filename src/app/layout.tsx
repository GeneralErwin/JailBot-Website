import type { Metadata } from "next";
import "./globals.css";

const siteUrl = process.env.APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Jailbot — moderation, under control",
    template: "%s · Jailbot"
  },
  description: "A considered control panel for the Discord Jailbot Rust moderation bot. Manage each server with a clear, permission-aware setup.",
  applicationName: "Jailbot",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Jailbot",
    title: "Jailbot — moderation, under control",
    description: "A focused control panel for your Discord jail workflow.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Jailbot control panel" }]
  },
  twitter: {
    card: "summary_large_image",
    title: "Jailbot — moderation, under control",
    description: "A focused control panel for your Discord jail workflow."
  },
  robots: { index: true, follow: true }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
