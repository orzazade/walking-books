"use client";

import { SignInButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";

export function SignInPrompt({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
      <p className="text-[0.875rem] text-muted-foreground">{message}</p>
      <SignInButton mode="modal">
        <Button className="mt-4 rounded-xl">Sign In</Button>
      </SignInButton>
    </div>
  );
}
