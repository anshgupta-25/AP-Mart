import { motion } from "framer-motion";

/**
 * Lightweight mobile "3D" hero visual — no WebGL.
 * Animated gradient blobs + floating grocery stickers with depth,
 * tilt, and parallax-style float. Looks alive without taxing the device.
 */
export function MobileHeroScene() {
  return (
    <div className="relative h-[280px] w-full overflow-hidden rounded-[2rem]">
      {/* Aurora blobs */}
      <motion.div
        aria-hidden
        className="absolute -top-10 -left-10 h-56 w-56 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, #84CC16 0%, transparent 70%)" }}
        animate={{ x: [0, 30, 0], y: [0, 20, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="absolute -bottom-12 -right-8 h-64 w-64 rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, #F59E0B 0%, transparent 70%)" }}
        animate={{ x: [0, -25, 0], y: [0, -15, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
      />
      <motion.div
        aria-hidden
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-40 w-40 rounded-full blur-3xl opacity-60"
        style={{ background: "radial-gradient(circle, #EC4899 0%, transparent 70%)" }}
        animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Soft dot grid overlay */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #0F172A 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      />

      {/* Central tilted basket card */}
      <motion.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        initial={{ rotate: -10, y: 20, opacity: 0 }}
        animate={{ rotate: -10, y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        style={{ perspective: 800 }}
      >
        <motion.div
          animate={{ y: [0, -8, 0], rotateZ: [-10, -8, -10] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="relative h-36 w-36 rounded-[2rem] grid place-items-center text-[88px] shadow-float"
          style={{
            background: "linear-gradient(135deg, #84CC16 0%, #65A30D 100%)",
            boxShadow:
              "0 30px 60px -20px rgb(132 204 22 / 0.55), inset 0 -8px 16px rgb(0 0 0 / 0.15), inset 0 8px 16px rgb(255 255 255 / 0.25)",
            transform: "rotateX(8deg) rotateY(-6deg)",
          }}
        >
          <span className="drop-shadow-lg">🛒</span>
          {/* Reflection */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[2rem]"
            style={{
              background:
                "linear-gradient(160deg, rgba(255,255,255,0.45) 0%, transparent 40%)",
            }}
          />
        </motion.div>
      </motion.div>

      {/* Floating grocery stickers */}
      <FloatSticker emoji="🍎" className="top-4 left-6" delay={0} duration={3.6} />
      <FloatSticker emoji="🥑" className="top-8 right-8" delay={0.4} duration={4.2} scale={0.9} />
      <FloatSticker emoji="🥛" className="bottom-10 left-4" delay={0.8} duration={4.8} />
      <FloatSticker emoji="🍞" className="bottom-6 right-6" delay={0.2} duration={4} scale={0.95} />
      <FloatSticker emoji="🥕" className="top-1/2 -translate-y-1/2 left-1" delay={0.6} duration={3.4} scale={0.85} />
      <FloatSticker emoji="🍌" className="top-1/2 -translate-y-1/2 right-2" delay={1.0} duration={3.8} scale={0.85} />
      <FloatSticker emoji="🍓" className="top-2 left-1/2 -translate-x-1/2" delay={1.2} duration={4.5} scale={0.8} />
      <FloatSticker emoji="🧀" className="bottom-2 left-1/2 -translate-x-1/2" delay={0.5} duration={4.1} scale={0.8} />
    </div>
  );
}

function FloatSticker({
  emoji,
  className,
  delay = 0,
  duration = 4,
  scale = 1,
}: {
  emoji: string;
  className?: string;
  delay?: number;
  duration?: number;
  scale?: number;
}) {
  return (
    <motion.div
      className={`absolute ${className ?? ""}`}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{
        opacity: 1,
        scale,
        y: [0, -10, 0],
        rotate: [-6, 6, -6],
      }}
      transition={{
        opacity: { duration: 0.5, delay },
        scale: { duration: 0.5, delay },
        y: { duration, repeat: Infinity, ease: "easeInOut", delay },
        rotate: { duration: duration * 1.3, repeat: Infinity, ease: "easeInOut", delay },
      }}
    >
      <div
        className="h-12 w-12 rounded-2xl bg-white grid place-items-center text-2xl"
        style={{
          boxShadow:
            "0 10px 25px -8px rgb(15 23 42 / 0.25), inset 0 -3px 6px rgb(15 23 42 / 0.06), inset 0 3px 6px rgb(255 255 255 / 0.9)",
        }}
      >
        <span className="drop-shadow-sm">{emoji}</span>
      </div>
    </motion.div>
  );
}
