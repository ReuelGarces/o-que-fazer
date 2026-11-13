import { ProfilePicker } from "@/components/account-screens";
import { authenticated } from "@/lib/server/auth";
import { listProfiles } from "@/lib/server/store";
import { AppError } from "@/lib/server/errors";
import { redirect } from "next/navigation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Profiles() {
  let current;
  try {
    current = await authenticated();
  } catch (error) {
    if (error instanceof AppError) redirect("/login");
    throw error;
  }
  return <ProfilePicker initialProfiles={listProfiles(current.accountId)} />;
}
