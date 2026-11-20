import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  { ignores: [".next/**", ".open-next/**", ".wrangler/**", "dist/**", "node_modules/**", "drizzle/**", "coverage/**", "cloudflare-env.d.ts"] }
];

export default eslintConfig;
