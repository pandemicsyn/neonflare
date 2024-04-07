import { type PlatformProxy } from "wrangler";

interface Env {
  SESSION_SECRET: string;
  DB: D1Database;
}

type Cloudflare = Omit<PlatformProxy<Env>, "dispose">;

declare module "@remix-run/cloudflare" {
  interface AppLoadContext {
    cloudflare: Cloudflare;
  }
}
