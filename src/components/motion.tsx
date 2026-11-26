"use client";

import { useEffect, type ReactNode } from "react";
import {
  MotionConfig,
  animate,
  motion,
  useInView,
  useMotionValue,
  useTransform,
  type Variants,
} from "motion/react";
import { useRef } from "react";

/** Respects the OS "reduce motion" setting for every animation in the app. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

export const ease = [0.22, 1, 0.36, 1] as const; // smooth "out-quint"

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease } },
};

export const stagger = (gap = 0.08, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

/** Container that staggers its <Item> children in on mount. */
export function Stagger({
  children,
  className,
  gap = 0.08,
  delay = 0,
  inView = false,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
  delay?: number;
  inView?: boolean;
}) {
  return (
    <motion.div
      className={className}
      variants={stagger(gap, delay)}
      initial="hidden"
      {...(inView ? { whileInView: "show", viewport: { once: true, amount: 0.25 } } : { animate: "show" })}
    >
      {children}
    </motion.div>
  );
}

export function Item({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} variants={fadeUp}>
      {children}
    </motion.div>
  );
}

/** Number that counts up from 0 when it scrolls into view. */
export function CountUp({ value, className, duration = 1.1 }: { value: number; className?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, { duration, ease });
    return () => controls.stop();
  }, [inView, value, duration, mv]);

  return (
    <motion.span ref={ref} className={className}>
      {text}
    </motion.span>
  );
}
