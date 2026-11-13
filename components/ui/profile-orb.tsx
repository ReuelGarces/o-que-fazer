"use client";

import { LiveOrb } from "@/components/ui/live-orb";

const colors: Record<string, string> = {
  compass: "#7d6eb7",
  book: "#45897b",
  mountain: "#bd758c",
  star: "#a77c32",
};

export function ProfileOrb({ avatar, size = 42 }: { avatar: string; size?: number }) {
  return (
    <span className="profile-orb" aria-hidden="true">
      <LiveOrb size={size} variant="custom" color={colors[avatar] ?? colors.compass} eyeColor="#ffffff" />
    </span>
  );
}
