"use client";

import { useUser } from "@clerk/nextjs";
import { useConvexAuth } from "convex/react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useRef } from "react";

export function UserSync() {
  const { isSignedIn } = useUser();
  const { isAuthenticated } = useConvexAuth();
  const ensureUser = useMutation(api.users.ensureUser);
  const synced = useRef(false);

  useEffect(() => {
    if (isSignedIn && isAuthenticated && !synced.current) {
      synced.current = true;
      ensureUser().catch(console.error);
    }
    if (!isSignedIn) {
      synced.current = false;
    }
  }, [isSignedIn, isAuthenticated, ensureUser]);

  return null;
}
