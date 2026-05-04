'use client';

/**
 * ShinyText — a horizontal sheen sweeps across the text every few seconds.
 * No animation when prefers-reduced-motion. Inspired by reactbits.dev/shiny-text.
 */
import type { ReactNode } from 'react';

interface ShinyTextProps {
  children: ReactNode;
  className?: string;
  /** Sweep duration in seconds (default 4s) */
  duration?: number;
}

export default function ShinyText({ children, className = '', duration = 4 }: ShinyTextProps) {
  return (
    <span
      className={`inline-block bg-clip-text text-transparent ${className}`}
      style={{
        backgroundImage: 'linear-gradient(110deg,currentColor 40%,#fff 50%,currentColor 60%)',
        backgroundSize: '250% 100%',
        animation: `shinySweep ${duration}s ease-in-out infinite`,
      }}
    >
      {children}
    </span>
  );
}
