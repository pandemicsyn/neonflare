import type { LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/cloudflare";
import { getDB } from "~/db.server";

export const loader = async ({ context }: LoaderFunctionArgs) => {
  const prisma = getDB(context);

  const created = await prisma.user.create({
    data: {
      email: "syn@neonflare.dev",
      password: "plaint text temp",
      name: "syn",
    },
  });
  console.log(created);

  return redirect("/users");
};
