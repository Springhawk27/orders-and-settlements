'use client';

import { formatMinor, type Currency } from '@crossval/shared';
import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

type AnimatedMoneyProps = {
  minorUnits: number;
  currency?: Currency;
  className?: string;
};

const DURATION_SECONDS = 0.7;

/**
 * Counts up to the figure once it arrives, which makes a dashboard feel like it
 * is reporting rather than just rendering. The animation always finishes on the
 * exact value, and the real figure is rendered directly when the reader has
 * asked for less motion.
 */
export const AnimatedMoney = ({ minorUnits, currency, className }: AnimatedMoneyProps) => {
  const prefersReducedMotion = useReducedMotion() ?? false;
  const [animatedValue, setAnimatedValue] = useState(0);
  const previous = useRef(0);

  useEffect(() => {
    if (prefersReducedMotion) {
      return;
    }

    const controls = animate(previous.current, minorUnits, {
      duration: DURATION_SECONDS,
      ease: 'easeOut',
      onUpdate: (value) => setAnimatedValue(Math.round(value)),
    });

    previous.current = minorUnits;

    return () => controls.stop();
  }, [minorUnits, prefersReducedMotion]);

  const displayed = prefersReducedMotion ? minorUnits : animatedValue;

  return <span className={cn('tabular-nums', className)}>{formatMinor(displayed, currency)}</span>;
};
