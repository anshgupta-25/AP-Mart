import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";

export const Route = createFileRoute("/shopkeeper/reviews")({
  component: () => (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-4 md:px-6">
      <h1 className="large-title">Reviews</h1>
      <div className="rounded-xl border border-border/70 bg-card px-4 py-10 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary-ink">
          <Star className="h-6 w-6" />
        </div>
        <div className="mt-3 text-body font-semibold">No reviews yet</div>
        <p className="mt-1 text-meta text-muted-foreground">Customer reviews will appear here soon.</p>
      </div>
    </div>
  ),
});
