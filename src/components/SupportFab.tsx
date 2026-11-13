import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SupportTicketForm } from "./SupportTicketForm";

/** Floating Help & Support entry point — mount on role dashboards. */
export function SupportFab({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const nav = useNavigate();

  return (
    <>
      <div
        className={
          "fixed right-4 bottom-[calc(84px+env(safe-area-inset-bottom))] md:bottom-6 z-40 flex flex-col items-end gap-2 " +
          className
        }
      >
        <Button
          onClick={() => nav({ to: "/support/my-tickets" as any })}
          variant="secondary"
          size="sm"
          className="rounded-full border border-border/70 bg-card text-small shadow-soft"
        >
          My tickets
        </Button>
        <Button
          onClick={() => setOpen(true)}
          aria-label="Help and Support"
          className="h-12 w-12 rounded-full p-0 shadow-float"
        >
          <LifeBuoy className="h-5 w-5" />
        </Button>
      </div>
      <SupportTicketForm open={open} onOpenChange={setOpen} />
    </>
  );
}
