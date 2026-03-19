"use client";

import { Authenticated, Unauthenticated } from "convex/react";
import { SignInPrompt } from "@/components/sign-in-prompt";
import { HeaderActionLink } from "@/components/header-action-link";
import { CurrentlyReadingSection } from "@/components/currently-reading-section";
import { ReadingHistorySection } from "@/components/reading-history-section";

function ReadingContent() {
  return (
    <>
      <CurrentlyReadingSection />
      <ReadingHistorySection />
    </>
  );
}

export default function CurrentlyReadingPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="section-kicker mb-3">Progress</div>
          <h1 className="font-serif text-[2rem] font-semibold tracking-[-0.01em]">
            Currently Reading
          </h1>
          <p className="mt-1.5 text-[0.875rem] text-muted-foreground">
            Track your progress and see your reading history
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 text-[0.8125rem]">
          <HeaderActionLink href="/reading-goals">
            Goals
          </HeaderActionLink>
          <HeaderActionLink href="/reading-streaks">
            Streaks
          </HeaderActionLink>
        </div>
      </div>

      {/* Content */}
      <Authenticated>
        <ReadingContent />
      </Authenticated>
      <Unauthenticated>
        <SignInPrompt message="Sign in to track your reading progress." />
      </Unauthenticated>
    </main>
  );
}
