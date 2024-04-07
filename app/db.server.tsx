/* eslint-disable @typescript-eslint/no-explicit-any */
import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { AppLoadContext } from "@remix-run/cloudflare";

export function getDB(ctx: AppLoadContext) {
  const env = ctx.cloudflare.env;
  const adapter = new PrismaD1(env.DB);
  const prisma = new PrismaClient({ adapter });
  return prisma;
}
