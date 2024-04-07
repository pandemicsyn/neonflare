import { AppLoadContext } from "@remix-run/cloudflare";
import { z } from "zod";

const schema = z.object({
  SESSION_SECRET: z.string(),
  RESEND_API_KEY: z.string().default("MOCK_RESEND_API_KEY"),
  GITHUB_CLIENT_ID: z.string().default("MOCK_GITHUB_CLIENT_ID"),
  GITHUB_CLIENT_SECRET: z.string().default("MOCK_GITHUB_CLIENT_SECRET"),
  GITHUB_TOKEN: z.string().default("MOCK_GITHUB_TOKEN"),
});

export function validateEnv(loadContext: AppLoadContext) {
  const parsed = schema.safeParse(loadContext.cloudflare.env);

  if (parsed.success === false) {
    console.error(
      "❌ Invalid environment variables:",
      parsed.error.flatten().fieldErrors
    );

    throw new Error("Invalid environment variables");
  }
  return parsed.data;
}
