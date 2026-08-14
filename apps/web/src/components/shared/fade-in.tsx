'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

type FadeInProps = {
  children: ReactNode;
  /** Staggers siblings when they mount together, e.g. a row of cards. */
  delay?: number;
  className?: string;
};

/**
 * A short rise on mount. Deliberately small — enough to signal that content
 * arrived, not enough to make a person wait for it.
 */
export const FadeIn = ({ children, delay = 0, className }: FadeInProps) => {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease: 'easeOut' }}
      className={className}
    >
      {children}
    </motion.div>
  );
};
