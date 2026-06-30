import { redirect } from "next/navigation";

// Middleware redirects unauthenticated users to /login and authenticated
// users away from "/"; this is the fallback for the root route.
export default function Home() {
  redirect("/launchpad");
}
