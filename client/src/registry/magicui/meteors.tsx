import { cn } from "@/lib/utils";

interface MeteorsProps {
  number?: number;
  className?: string;
}

export function Meteors({ number = 20, className }: MeteorsProps) {
  return (
    <div className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      {Array.from({ length: number }).map((_, index) => {
        const size = Math.random() * 1.2 + 0.5;
        const x = Math.random() * 100;
        const y = Math.random() * 45;
        const delay = Math.random() * 12;
        const duration = Math.random() * 5 + 8;

        return (
          <span
            key={`${index}-${x}`}
            className="meteor absolute"
            style={{
              left: `${x}%`,
              top: `${y}%`,
              width: `${size}px`,
              height: `${size * 28}px`,
              animationDelay: `${delay}s`,
              animationDuration: `${duration}s`,
            }}
          />
        );
      })}
    </div>
  );
}
