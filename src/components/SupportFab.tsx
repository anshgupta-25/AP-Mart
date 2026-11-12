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
      <div className={"fixed right-4 bottom-24 md:bottom-6 z-40 flex flex-col items-end gap-2 " + className}>
        <Button
          onClick={() => nav({ to: "/support/my-tickets" as any })}
          variant="secondary"
          size="sm"
          className="rounded-full shadow-card text-xs"
        >
          My tickets
        </Button>
        <Button
          onClick={() => setOpen(true)}
          aria-label="Help and Support"
          className="rounded-full h-14 w-14 p-0 gradient-primary text-primary-foreground shadow-glow"
        >
          <LifeBuoy className="h-6 w-6" />
        </Button>
      </div>
      <SupportTicketForm open={open} onOpenChange={setOpen} />
    </>
  );
}
