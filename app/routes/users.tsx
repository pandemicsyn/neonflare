import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { json } from "@remix-run/cloudflare";
import { useLoaderData } from "@remix-run/react";
import { getDB } from "~/db.server";

export const loader = async ({ context }: LoaderFunctionArgs) => {
  const prisma = getDB(context);

  const count = await prisma.user.count();
  return json({ count });
};

export default function Users() {
  const data = useLoaderData<typeof loader>();
  return (
    <div>
      <h1>Users</h1>
      <ul>
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </ul>
    </div>
  );
}
