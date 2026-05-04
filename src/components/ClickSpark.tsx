'use client';

/**
 * ClickSpark — wraps a button-like child and emits a 6-particle radial burst
 * at click time. Particles are absolutely positioned divs animated via
 * Web Animations API; respects prefers-reduced-motion.
 *
 * Inspired by reactbits.dev/click-spark.
 */
import { useRef, type ReactNode } from 'react';
import { reducedMotion } from '@/lib/feedback';

interface ClickSparkProps {
  children: ReactNode;
  /** Tailwind text class for spark color, defaults to text-accent */
  color?: string;
  /** Number of particles, default 8 */
  count?: number;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLSpanElement>) => void;
}

export default function ClickSpark({ children, color = 'currentColor', count = 8, className = '', onClick }: ClickSparkProps) {
  const ref = useRef<HTMLSpanElement>(null);

  const burst = (e: React.MouseEvent<HTMLSpanElement>) => {
    onClick?.(e);
    if (reducedMotion()) return;
    const host = ref.current;
    if (!host) return;
    const rect = host.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const distance = 22 + Math.random() * 10;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const dot = document.createElement('span');
      dot.style.cssText = `position:absolute;left:${cx}px;top:${cy}px;width:4px;height:4px;border-radius:9999px;background:${color};pointer-events:none;`;
      host.appendChild(dot);
      const anim = dot.animate(
        [
          { transform: 'translate(-50%, -50%) scale(0.8)', opacity: 0.95 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.2)`, opacity: 0 },
        ],
        { duration: 420 + Math.random() * 160, easing: 'cubic-bezier(.2,.6,.2,1)' },
      );
      anim.onfinish = () => dot.remove();
    }
  };

  return (
    <span ref={ref} onClick={burst} className={`relative inline-block ${className}`}>
      {children}
    </span>
  );
}
