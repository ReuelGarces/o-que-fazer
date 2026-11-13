import { ActivitiesApp } from "@/components/activities-app";
import { SmoothScroll } from "@/components/ui/smooth-scroll";
import { selectedProfile } from "@/lib/server/auth";
import { ownedProfile } from "@/lib/server/store";
import { AppError } from "@/lib/server/errors";
import { redirect } from "next/navigation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export default async function Home() {
  let current;
  try {
    current = await selectedProfile();
  } catch (error) {
    if (error instanceof AppError)
      redirect(error.status === 401 ? "/login" : "/profiles");
    throw error;
  }
  const profile = ownedProfile(current.accountId, current.profileId);
  return (
    <SmoothScroll>
      <ActivitiesApp
        key={profile.id}
        profile={{ id: profile.id, name: profile.name, avatar: profile.avatar }}
      />
    </SmoothScroll>
  );
}
