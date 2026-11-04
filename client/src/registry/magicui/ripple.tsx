import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface RippleProps {
  className?: string;
  mainCircleSize?: number;
  mainCircleOpacity?: number;
  numCircles?: number;
}

export function Ripple({
  className,
  mainCircleSize = 220,
  mainCircleOpacity = 0.22,
  numCircles = 9,
}: RippleProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 flex items-center justify-center [mask-image:radial-gradient(ellipse_at_center,white_20%,transparent_72%)]",
        className,
      )}
    >
      {Array.from({ length: numCircles }, (_, i) => {
        const size = mainCircleSize + i * 140;
        const opacity = Math.max(mainCircleOpacity - i * 0.02, 0.04);

        return (
          <motion.div
            key={i}
            className="absolute rounded-full border border-white/25 bg-transparent shadow-[0_0_80px_rgba(148,163,184,0.08)]"
            style={{ width: size, height: size }}
            initial={{ scale: 0.84, opacity }}
            animate={{ scale: 1.15, opacity: [opacity, opacity * 0.45, opacity] }}
            transition={{
              duration: 7,
              repeat: Number.POSITIVE_INFINITY,
              ease: "easeInOut",
              delay: i * 0.45,
            }}
          />
        );
      })}
    </div>
  );
}
