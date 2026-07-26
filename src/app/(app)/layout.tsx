import { redirect } from "next/navigation";
import { Shell } from "@/components/layout/Shell";
import { currentUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  return <Shell user={user}>{children}</Shell>;
}
