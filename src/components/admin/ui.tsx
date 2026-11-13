import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto w-full max-w-7xl space-y-5 px-4 py-4 md:px-6 md:py-6", className)}>{children}</div>;
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="large-title">{title}</h1>
        {subtitle && <p className="mt-0.5 text-meta text-muted-foreground">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Section({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2.5", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3">
          {title && <h2 className="section-title">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const TINTS = {
  mint: "bg-tint-mint text-primary-ink",
  sun: "bg-tint-sun text-[oklch(0.45_0.1_75)]",
  sky: "bg-tint-sky text-[oklch(0.42_0.1_235)]",
  rose: "bg-tint-rose text-[oklch(0.45_0.12_15)]",
  violet: "bg-tint-violet text-[oklch(0.42_0.1_290)]",
  peach: "bg-tint-peach text-[oklch(0.45_0.1_50)]",
} as const;
export type Tint = keyof typeof TINTS;

export function StatTile({
  label,
  value,
  icon,
  tint = "mint",
  hint,
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  tint?: Tint;
  hint?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3">
      {icon && (
        <div className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg [&_svg]:h-[17px] [&_svg]:w-[17px]", TINTS[tint])}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <div className="truncate text-small text-muted-foreground">{label}</div>
        <div className="truncate text-xl font-semibold leading-tight tracking-tight">{value}</div>
        {hint && <div className="mt-0.5 text-caption text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-2 gap-2.5 md:gap-4 lg:grid-cols-4", className)}>{children}</div>;
}

const PILL = {
  neutral: "bg-secondary text-muted-foreground",
  success: "bg-primary-soft text-primary-ink",
  warning: "bg-tint-sun text-[oklch(0.45_0.1_75)]",
  danger: "bg-tint-rose text-[oklch(0.45_0.12_15)]",
  info: "bg-tint-sky text-[oklch(0.42_0.1_235)]",
} as const;

export function Pill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: keyof typeof PILL;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-caption font-semibold", PILL[tone], className)}>
      {children}
    </span>
  );
}

export function orderTone(status: string): keyof typeof PILL {
  if (["delivered", "completed", "paid", "approved", "active", "resolved"].includes(status)) return "success";
  if (["cancelled", "failed", "rejected", "refunded", "no_shop_available"].includes(status)) return "danger";
  if (["awaiting_shop", "pending", "open", "in_progress"].includes(status)) return "warning";
  return "info";
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("overflow-hidden rounded-xl border border-border/70 bg-card", className)}>{children}</div>;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {icon && (
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-tint-mint text-primary-ink [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>
      )}
      <div className="text-subtitle font-semibold">{title}</div>
      {description && <p className="mt-1 max-w-xs text-meta text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "press h-8 whitespace-nowrap rounded-full px-3.5 text-meta font-medium transition-colors",
        active ? "bg-foreground text-background" : "bg-secondary text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export const rowLink =
  "press flex items-center justify-between gap-3 px-4 py-3 text-body transition-colors hover:bg-secondary/50 border-b border-border/70 last:border-0";
