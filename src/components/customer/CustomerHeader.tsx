import { Link } from "@tanstack/react-router";
import { Bell, ChevronDown, MapPin, Search, User as UserIcon } from "lucide-react";
import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { LogoMark } from "@/components/Logo";

export function CustomerHeader() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const initials = (user?.email ?? "U").slice(0, 2).toUpperCase();

  const onImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      toast.success("Image received — finding matches…", { description: e.target.files[0].name });
      // Hook: forward to image-search server fn when implemented
    }
  };

  const placeholders = [
    "Search 'milk'",
    "Search 'mangoes'",
    "Search 'maggi'",
    "Search 'coke'",
    "Search 'eggs'",
  ];
  const [phIdx, setPhIdx] = useState(0);

  return (
    <div className="sticky top-0 z-40">
      {/* Top bar — location + actions */}
      <div className="gradient-location text-primary-foreground">
        <div className="px-4 pt-3 pb-3 flex items-center gap-3">
          <Link to="/customer/home" aria-label="AP Mart home" className="shrink-0">
            <LogoMark size="xs" className="h-8 w-8 rounded-lg bg-white/90 p-0.5 shadow-none" />
          </Link>
          <Link to="/customer/profile" className="flex-1 min-w-0 flex items-start gap-2">
            <MapPin className="h-5 w-5 mt-0.5 shrink-0 fill-white/30" />
            <div className="min-w-0">
              <div className="flex items-center gap-1 font-extrabold text-[15px] leading-tight">
                Delivery in 10 minutes
              </div>
              <div className="flex items-center gap-1 text-[12px] opacity-90 truncate">
                <span className="truncate">Home · 401, Sunshine Apartments, Andheri</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" />
              </div>
            </div>
          </Link>
          <Link
            to="/customer/notifications"
            aria-label="Notifications"
            className="relative grid h-10 w-10 place-items-center rounded-full bg-white/15 backdrop-blur"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent ring-2 ring-primary" />
          </Link>
          <Link
            to="/customer/profile"
            aria-label="Profile"
            className="grid h-10 w-10 place-items-center rounded-full bg-white text-primary font-extrabold text-sm shadow-soft"
          >
            {user ? initials : <UserIcon className="h-5 w-5" />}
          </Link>
        </div>

        {/* Search bar overlapping the bottom of the lime band */}
        <div className="px-4 pb-4">
          <Link
            to="/products"
            className="flex items-center gap-2 rounded-2xl bg-white px-3.5 py-3 shadow-card-premium"
          >
            <Search className="h-5 w-5 text-foreground/70 shrink-0" />
            <div className="flex-1 min-w-0 overflow-hidden">
              <motion.div
                key={phIdx}
                initial={{ y: 14, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -14, opacity: 0 }}
                onAnimationComplete={() => {
                  window.setTimeout(() => setPhIdx((i) => (i + 1) % placeholders.length), 1800);
                }}
                className="text-sm text-muted-foreground truncate"
              >
                {placeholders[phIdx]}
              </motion.div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
