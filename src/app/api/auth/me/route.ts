import { json } from "@/lib/api";
import { currentUser } from "@/lib/auth";

export async function GET() {
  const user = await currentUser();
  return json({ user });
}
