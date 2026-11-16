import { useQuery } from "@tanstack/react-query";
import type { User } from "firebase/auth";
import { fetchUserProfile, syncUserProfile, type UserProfileDoc } from "@/lib/firebase";

export function profileInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function useMemberProfile(user: User) {
  return useQuery<UserProfileDoc>({
    queryKey: ["profile", user.uid],
    queryFn: async () => {
      let profile = await fetchUserProfile(user.uid);
      if (!profile && user.emailVerified) {
        await syncUserProfile(user);
        profile = await fetchUserProfile(user.uid);
      }
      return (
        profile ?? {
          uid: user.uid,
          email: user.email ?? "",
          ...(user.displayName ? { fullName: user.displayName } : {}),
          ...(user.photoURL ? { avatarUrl: user.photoURL } : {}),
          createdAt: user.metadata.creationTime ?? "",
          updatedAt: user.metadata.lastSignInTime ?? "",
        }
      );
    },
  });
}
