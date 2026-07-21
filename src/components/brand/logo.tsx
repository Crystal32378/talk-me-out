"use client";

import { motion } from "framer-motion";

interface LogoProps {
  size?: number;
  showTagline?: boolean;
  className?: string;
}

/**
 * Brand mark for Talk Me Out of It.
 * A red "pause" stamp — the product asks you to slow down.
 */
export function Logo({ size = 40, showTagline = false, className = "" }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <motion.div
        initial={{ rotate: -8, scale: 0.9 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        style={{ width: size, height: size }}
        className="relative flex items-center justify-center"
      >
        <svg
          viewBox="0 0 48 48"
          width={size}
          height={size}
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <rect
            x="3"
            y="3"
            width="42"
            height="42"
            rx="6"
            fill="#0a0a0a"
            stroke="#ff3b30"
            strokeWidth="2.5"
          />
          <rect x="14" y="13" width="6" height="22" rx="1" fill="#ff3b30" />
          <rect x="28" y="13" width="6" height="22" rx="1" fill="#ff3b30" />
        </svg>
      </motion.div>
      <div className="flex flex-col leading-tight">
        <span className="font-display text-base font-bold tracking-tight text-foreground">
          Talk Me Out of It
        </span>
        {showTagline && (
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Your brutally honest fitting-room friend
          </span>
        )}
      </div>
    </div>
  );
}
