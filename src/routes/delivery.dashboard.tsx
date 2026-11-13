import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PackageOpen, Check, MapPin, Zap, Timer, AlertTriangle } from "lucide-react";
import { rupees } from "@/lib/format";
import { RouteMap } from "@/components/maps/RouteMap";
import { MessageCustomerDialog } from "@/components/MessageCustomerDialog";
import { FastDeliveryBadge, PriorityDot, useCountdown } from "@/components/FastDeliveryBadge";
import { cn } from "@/lib/utils";
import { runOptimistic, removeRow } from "@/lib/optimistic";





export const Route = createFileRoute("/delivery/dashboard")({
  head: () => ({ meta: [{ title: "Delivery Dashboard — AP Mart" }] }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [partner, setPartner] = useState<any>(null);
  const [myPos, setMyPos] = useState<{ lat: number; lng: number } | null>(null);
  const watchRef = useRef<number | null>(null);

  const ensurePartner = async () => {
    if (!user) return null;
    const { data, error } = await supabase.from("delivery_partners").select("*").eq("user_id", user.id).maybeSingle();
    if (error) { console.error("load partner:", error); toast.error(error.message); return null; }
    if (data) {
      setPartner(data);
      if (data.current_lat && data.current_lng) setMyPos({ lat: data.current_lat, lng: data.current_lng });
      return data;
    }
    const { data: created, error: insErr } = await supabase
      .from("delivery_partners")
      .insert({ user_id: user.id, name: user.email ?? "Partner", is_online: false })
      .select()
      .single();
    if (insErr) { console.error("create partner:", insErr); toast.error(insErr.message); return null; }
    setPartner(created);
    return created;
  };

  useEffect(() => { ensurePartner(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user]);

  useEffect(() => {
    const beep = () => {
      try {
        const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = "square";
        o.frequency.value = 880;
        o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        o.start();
        o.stop(ctx.currentTime + 0.4);
      } catch { /* ignore */ }
    };
    const ch = supabase
      .channel("delivery-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        const n: any = payload.new ?? {};
        const o: any = payload.old ?? {};
        qc.invalidateQueries({ queryKey: ["my-deliveries"] });
        qc.invalidateQueries({ queryKey: ["assigned-to-me"] });
        qc.invalidateQueries({ queryKey: ["dashboard-available-orders"] });
        const becameMine = partner?.id && n.partner_id === partner.id && o.partner_id !== partner.id;
        if (becameMine && n.delivery_type === "fast_delivery") {
          beep();
          toast.error("Fast Delivery — Priority order", {
            description: `${n.order_number ?? "New order"} · Deliver within 15–30 min`,
            duration: 8000,
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, partner?.id]);

  // Live geolocation broadcast while online
  useEffect(() => {
    if (!partner?.is_online || !navigator.geolocation) {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
        watchRef.current = null;
      }
      return;
    }
    let lastPush = 0;
    let lastUiUpdate = 0;
    let lastLat = myPos?.lat ?? null;
    let lastLng = myPos?.lng ?? null;
    watchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude, lng = pos.coords.longitude;
        const now = Date.now();
        // Throttle UI updates: only re-render if moved >~15m or 4s elapsed.
        const moved =
          lastLat == null || lastLng == null
            ? Infinity
            : Math.hypot(lat - lastLat, lng - lastLng) * 111000; // deg→m approx
        if (moved > 15 || now - lastUiUpdate > 4000) {
          lastUiUpdate = now;
          lastLat = lat; lastLng = lng;
          setMyPos({ lat, lng });
        }
        if (now - lastPush > 5000) {
          lastPush = now;
          await supabase.from("delivery_partners").update({ current_lat: lat, current_lng: lng }).eq("id", partner.id);
        }
      },
      (err) => console.warn("geolocation:", err.message),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
    );

    return () => {
      if (watchRef.current != null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    };
  }, [partner?.is_online, partner?.id]);

  const sortFastFirst = <T extends { delivery_type?: string | null; placed_at?: string }>(rows: T[]) =>
    [...rows].sort((a, b) => {
      const ap = a.delivery_type === "fast_delivery" ? 0 : 1;
      const bp = b.delivery_type === "fast_delivery" ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return new Date(a.placed_at ?? 0).getTime() - new Date(b.placed_at ?? 0).getTime();
    });

  const myDeliveries = useQuery({
    queryKey: ["my-deliveries", partner?.id],
    queryFn: async () => {
      if (!partner) return [];
      const { data: orders } = await supabase
        .from("orders")
        .select("id, order_number, total, status, address, shop_id, delivery_lat, delivery_lng, delivery_type, fast_delivery_fee, placed_at")
        .eq("partner_id", partner.id)
        .in("status", ["out_for_delivery"])
        .neq("delivery_type", "pickup")
        .order("placed_at", { ascending: false });
      const list = sortFastFirst(orders ?? []);
      const shopIds = Array.from(new Set(list.map((o: any) => o.shop_id).filter(Boolean)));
      let shopMap: Record<string, any> = {};
      if (shopIds.length > 0) {
        const { data: shops } = await supabase.from("shops").select("id,name,latitude,longitude").in("id", shopIds);
        shopMap = Object.fromEntries((shops ?? []).map((s: any) => [s.id, s]));
      }
      return list.map((o: any) => ({ ...o, shop: shopMap[o.shop_id] }));
    },
    enabled: !!partner,
    refetchInterval: 30000,
  });

  const toggleOnline = async (v: boolean) => {
    let p = partner;
    if (!p?.id) {
      p = await ensurePartner();
      if (!p?.id) return;
    }
    const { error } = await supabase.from("delivery_partners").update({ is_online: v }).eq("id", p.id);
    if (error) toast.error(error.message);
    else setPartner({ ...p, is_online: v });
  };

  const markDelivered = async (id: string) => {
    const { error } = await supabase.rpc("partner_mark_delivered", { _order_id: id });
    if (error) toast.error(error.message); else toast.success("Delivered!");
  };

  const available = useQuery({
    queryKey: ["dashboard-available-orders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total, address, delivery_type, fast_delivery_fee, placed_at")
        .eq("status", "packed")
        .is("partner_id", null)
        .neq("delivery_type", "pickup")
        .limit(20);
      return sortFastFirst(data ?? []);
    },
    refetchInterval: 30000,
  });

  const assigned = useQuery({
    queryKey: ["assigned-to-me", partner?.id],
    queryFn: async () => {
      if (!partner) return [];
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total, address, shop_id, delivery_type, fast_delivery_fee, placed_at")
        .eq("partner_id", partner.id)
        .eq("status", "packed")
        .neq("delivery_type", "pickup");
      return sortFastFirst(data ?? []);
    },
    enabled: !!partner,
    refetchInterval: 30000,
  });

  const acceptAvailable = async (id: string) => {
    await runOptimistic({
      qc,
      keys: [["dashboard-available-orders"], ["assigned-to-me", partner?.id], ["my-deliveries"]],
      // the order leaves the "available" pool instantly
      updater: removeRow(id),
      request: () => supabase.rpc("partner_accept_order", { _order_id: id }),
      success: "Accepted! Start delivery.",
    });
  };

  const declineAssignment = async (id: string) => {
    const ok = await runOptimistic({
      qc,
      keys: [["assigned-to-me", partner?.id]],
      updater: removeRow(id),
      request: () => supabase.rpc("partner_decline_assignment", { _order_id: id }),
    });
    if (ok) toast.message("Declined. Reassigning…");
  };


  // Attendance
  const attendance = useQuery({
    queryKey: ["partner-attendance", partner?.id],
    queryFn: async () => {
      if (!partner) return { rows: [], hours: 0, open: null };
      const { data: rows } = await supabase
        .from("partner_attendance")
        .select("id, check_in_at, check_out_at")
        .eq("partner_id", partner.id)
        .order("check_in_at", { ascending: false })
        .limit(7);
      const { data: hours } = await supabase.rpc("partner_today_hours", { _partner_id: partner.id });
      const open = (rows ?? []).find((r: any) => !r.check_out_at) ?? null;
      return { rows: rows ?? [], hours: Number(hours ?? 0), open };
    },
    enabled: !!partner,
    refetchInterval: 30000,
  });

  const checkIn = async () => {
    const { error } = await supabase.rpc("partner_check_in");
    if (error) toast.error(error.message);
    else { toast.success("Checked in"); attendance.refetch(); }
  };
  const checkOut = async () => {
    const { error } = await supabase.rpc("partner_check_out");
    if (error) toast.error(error.message);
    else { toast.success("Checked out"); attendance.refetch(); setPartner((p: any) => p ? { ...p, is_online: false } : p); }
  };

  const assignedCount = assigned.data?.length ?? 0;
  const availableCount = available.data?.length ?? 0;
  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  })();

  return (
    <>
      <div className="space-y-5 px-4 py-4 md:px-6">
        <div>
          <div className="text-small text-muted-foreground">{greeting}</div>
          <h1 className="large-title mt-0.5">{partner?.name && partner.name !== user?.email ? partner.name : "Your deliveries"}</h1>
        </div>

        <div className="rounded-xl border border-border/70 bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-subtitle font-semibold">
                <span className={cn("h-2 w-2 rounded-full", partner?.is_online ? "bg-primary" : "bg-muted-foreground/40")} />
                {partner?.is_online ? "You're online" : "You're offline"}
              </div>
              <div className="mt-1 flex items-center gap-1 text-small text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {partner?.is_online
                    ? myPos
                      ? `Live location on (${myPos.lat.toFixed(3)}, ${myPos.lng.toFixed(3)})`
                      : "Waiting for GPS…"
                    : "Go online to receive orders"}
                </span>
              </div>
            </div>
            <Switch checked={partner?.is_online ?? false} onCheckedChange={toggleOnline} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-tint-mint p-3.5">
            <div className="text-small text-foreground/60">Hours today</div>
            <div className="mt-1 text-page font-bold leading-none tracking-tight">
              {attendance.data?.hours.toFixed(1) ?? "0.0"}<span className="ml-0.5 text-small font-semibold text-foreground/60">h</span>
            </div>
          </div>
          <div className="rounded-xl bg-tint-sky p-3.5">
            <div className="text-small text-foreground/60">Active now</div>
            <div className="mt-1 text-page font-bold leading-none tracking-tight">{myDeliveries.data?.length ?? 0}</div>
          </div>
        </div>

        <section className="space-y-2.5">
          <h2 className="section-title">Active deliveries</h2>
          {(myDeliveries.data ?? []).map((o: any) => {
            const points = [
              myPos ? { lat: myPos.lat, lng: myPos.lng, label: "You" } : null,
              o.shop ? { lat: o.shop.latitude, lng: o.shop.longitude, label: `Shop: ${o.shop.name}` } : null,
              o.delivery_lat && o.delivery_lng ? { lat: o.delivery_lat, lng: o.delivery_lng, label: `Drop: ${(o.address as any)?.name ?? "Customer"}` } : null,
            ].filter(Boolean) as { lat: number; lng: number; label: string }[];
            const isFast = o.delivery_type === "fast_delivery";
            return (
              <div key={o.id} className="space-y-3 rounded-xl border border-border/70 bg-card p-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-body font-semibold">{o.order_number}</div>
                      {isFast && <FastDeliveryBadge />}
                    </div>
                  </div>
                  <div className="text-body font-semibold">{rupees(o.total)}</div>
                </div>
                <RouteStops shop={o.shop?.name} address={o.address} />
                <RouteMap points={points} height="h-44" />
                <div className="flex items-center gap-2">
                  <MessageCustomerDialog orderId={o.id} orderNumber={o.order_number} />
                  <Button onClick={() => markDelivered(o.id)} className="h-12 flex-1 rounded-xl">
                    <Check className="h-4 w-4" />Mark delivered
                  </Button>
                </div>
              </div>
            );
          })}
          {(myDeliveries.data?.length ?? 0) === 0 && (
            <div className="rounded-xl border border-border/70 bg-card p-5 text-center">
              <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-tint-mint text-primary-ink">
                <PackageOpen className="h-5 w-5" />
              </div>
              <div className="mt-2.5 text-body font-semibold">No active deliveries</div>
              <p className="mt-0.5 text-small text-muted-foreground">Pick up a new order to get started.</p>
              <a
                href="/delivery/available-orders"
                className="press mt-3 inline-flex h-9 items-center rounded-xl bg-primary-soft px-4 text-small font-semibold text-primary-ink"
              >
                Browse available orders
              </a>
            </div>
          )}
        </section>

        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <h2 className="section-title">Assigned to you</h2>
            {assignedCount > 0 && (
              <span className="rounded-full bg-tint-sun px-2 py-0.5 text-caption font-semibold">{assignedCount}</span>
            )}
          </div>
          {(assigned.data ?? []).map((o: any) => (
            <PriorityOrderRow
              key={o.id}
              o={o}
              partnerOnline={!!partner?.is_online}
              onAccept={() => acceptAvailable(o.id)}
              onDecline={() => declineAssignment(o.id)}
              assignedMode
            />
          ))}
          {assignedCount === 0 && (
            <div className="rounded-xl border border-border/70 bg-card p-4 text-center text-small text-muted-foreground">
              Nothing assigned right now.
            </div>
          )}
        </section>

        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <h2 className="section-title">Available orders</h2>
            {availableCount > 0 && (
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-caption font-semibold text-primary-ink">{availableCount} new</span>
            )}
          </div>
          {(available.data ?? []).map((o: any) => (
            <PriorityOrderRow
              key={o.id}
              o={o}
              partnerOnline={!!partner?.is_online}
              onAccept={() => acceptAvailable(o.id)}
            />
          ))}
          {availableCount === 0 && (
            <div className="rounded-xl border border-border/70 bg-card p-4 text-center text-small text-muted-foreground">
              No available orders right now.
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border/70 bg-card p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="section-title">Attendance</h2>
              <p className="mt-0.5 text-small text-muted-foreground">
                {attendance.data?.open ? <span className="font-medium text-primary-ink">Checked in</span> : "Not checked in"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={checkIn} disabled={!!attendance.data?.open}>Check in</Button>
              <Button size="sm" variant="secondary" onClick={checkOut} disabled={!attendance.data?.open}>Check out</Button>
            </div>
          </div>
          {(attendance.data?.rows.length ?? 0) > 0 && (
            <div className="mt-3 divide-y divide-border/60 border-t border-border/60">
              {(attendance.data?.rows ?? []).map((r: any) => {
                const inT = new Date(r.check_in_at);
                const outT = r.check_out_at ? new Date(r.check_out_at) : null;
                const hrs = ((outT ?? new Date()).getTime() - inT.getTime()) / 3.6e6;
                const t = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                return (
                  <div key={r.id} className="flex min-h-10 items-center justify-between text-small">
                    <span className="text-muted-foreground">
                      {inT.toLocaleDateString()} · {t(inT)} – {outT ? t(outT) : "now"}
                    </span>
                    <span className="font-semibold">{hrs.toFixed(2)}h</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function RouteStops({ shop, address }: { shop?: string; address: any }) {
  return (
    <div className="space-y-0">
      {shop && (
        <div className="flex gap-2.5">
          <div className="flex flex-col items-center">
            <span className="mt-1 h-2 w-2 rounded-full bg-primary" />
            <span className="my-0.5 w-px flex-1 border-l border-dashed border-border" />
          </div>
          <div className="min-w-0 pb-2">
            <div className="text-caption text-muted-foreground">Pickup</div>
            <div className="truncate text-small font-medium">{shop}</div>
          </div>
        </div>
      )}
      <div className="flex gap-2.5">
        <div className="flex flex-col items-center">
          <span className="mt-1 h-2 w-2 rounded-sm bg-foreground" />
        </div>
        <div className="min-w-0">
          <div className="text-caption text-muted-foreground">Drop</div>
          <div className="text-small font-medium leading-snug">
            {address?.line1}, {address?.city}
          </div>
        </div>
      </div>
    </div>
  );
}

function PriorityOrderRow({
  o, partnerOnline, onAccept, onDecline, assignedMode,
}: {
  o: any; partnerOnline: boolean; onAccept: () => void; onDecline?: () => void; assignedMode?: boolean;
}) {
  const isFast = o.delivery_type === "fast_delivery";
  const deadline = isFast && o.placed_at ? new Date(new Date(o.placed_at).getTime() + 30 * 60 * 1000) : null;
  const countdown = useCountdown(deadline);
  const addr = o.address as any;

  return (
    <div className={cn("space-y-3 rounded-xl border bg-card p-3.5", isFast ? "border-destructive/30" : "border-border/70")}>
      {isFast && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <PriorityDot />
            <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-caption font-semibold text-destructive">
              <AlertTriangle className="h-3 w-3" />
              Priority delivery
            </span>
          </div>
          {deadline && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-caption font-semibold text-destructive">
              <Timer className="h-3 w-3" />
              {countdown}
            </span>
          )}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-body font-semibold leading-tight">{o.order_number}</div>
          <div className="mt-1 flex items-start gap-1 text-small leading-snug text-muted-foreground">
            <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
            <span>{addr?.line1}, {addr?.city}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-body font-semibold">{rupees(o.total)}</div>
          {o.fast_delivery_fee ? (
            <div className="text-caption text-muted-foreground">+{rupees(o.fast_delivery_fee)} priority</div>
          ) : null}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={onAccept}
          disabled={!partnerOnline}
          className={cn(
            "h-11 flex-1 rounded-xl",
            isFast && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
          )}
        >
          {isFast && <Zap className="h-4 w-4" />}
          {partnerOnline ? (isFast ? "Accept now" : "Accept") : "Go online to accept"}
        </Button>
        {assignedMode && onDecline && (
          <Button variant="secondary" onClick={onDecline} className="h-11 rounded-xl px-4">
            Decline
          </Button>
        )}
      </div>
    </div>
  );
}

