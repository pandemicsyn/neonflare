import type { MetaFunction } from "@remix-run/cloudflare";
import { v0index } from "~/components/v0index";

export const meta: MetaFunction = () => {
  return [
    { title: "neonflare.dev" },
    {
      name: "description",
      content: "neonflare.dev",
    },
  ];
};

export default function Index() {
  return v0index();
}
