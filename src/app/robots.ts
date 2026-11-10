import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const site = process.env.APP_URL || "http://localhost:3000";
  return { rules: [{ userAgent: "*", allow: ["/", "/docs"], disallow: ["/dashboard", "/api", "/login"] }], sitemap: `${site}/sitemap.xml` };
}
