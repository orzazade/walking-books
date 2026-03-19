import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  message: string;
  children?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, message, children }: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 px-6 py-16 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <h2 className="font-serif text-lg font-semibold">{title}</h2>
      <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
        {message}
      </p>
      {children}
    </div>
  );
}
