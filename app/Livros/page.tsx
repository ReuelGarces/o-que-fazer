import { BooksApp } from "@/components/books-app";
import { selectedProfile } from "@/lib/server/auth";
import { ownedProfile } from "@/lib/server/store";
import { AppError } from "@/lib/server/errors";
import { redirect } from "next/navigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata = { title: "Livros | O que fazer?" };

export default async function BooksPage() {
  let current;
  try {
    current = await selectedProfile();
  } catch (error) {
    if (error instanceof AppError)
      redirect(error.status === 401 ? "/login" : "/profiles");
    throw error;
  }
  const profile = ownedProfile(current.accountId, current.profileId);
  return <BooksApp key={profile.id} profile={{ id: profile.id, name: profile.name, avatar: profile.avatar }} />;
}