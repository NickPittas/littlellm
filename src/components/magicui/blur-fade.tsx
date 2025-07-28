"use client";

import { motion } from "framer-motion";
import React from "react";

interface BlurFadeProps {
  children: React.ReactNode;
  className?: string;
  variant?: {
    hidden: { y: number; opacity: number; filter: string };
    visible: { y: number; opacity: number; filter: string };
  };
  duration?: number;
  delay?: number;
  yOffset?: number;
  inView?: boolean;
  inViewMargin?: string;
  blur?: string;
}

const defaultVariant = {
  hidden: { y: 6, opacity: 0, filter: "blur(6px)" },
  visible: { y: -6, opacity: 1, filter: "blur(0px)" },
};

export function BlurFade({
  children,
  className,
  variant = defaultVariant,
  duration = 0.4,
  delay = 0,
  yOffset = 6,
  inView = false,
  inViewMargin = "-50px",
  blur = "6px",
}: BlurFadeProps) {
  const customVariant = {
    hidden: {
      y: yOffset,
      opacity: 0,
      filter: `blur(${blur})`,
    },
    visible: {
      y: -yOffset,
      opacity: 1,
      filter: "blur(0px)",
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={variant || customVariant}
      transition={{
        delay: 0.04 + delay,
        duration,
        ease: "easeOut",
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function BlurFadeText({
  text,
  className,
  variant,
  characterDelay = 0.03,
  delay = 0,
  yOffset = 8,
  animateByCharacter = false,
}: {
  text: string;
  className?: string;
  variant?: {
    hidden: { y: number; opacity: number; filter: string };
    visible: { y: number; opacity: number; filter: string };
  };
  characterDelay?: number;
  delay?: number;
  yOffset?: number;
  animateByCharacter?: boolean;
}) {
  const defaultVariants = {
    hidden: { y: yOffset, opacity: 0, filter: "blur(8px)" },
    visible: { y: -yOffset, opacity: 1, filter: "blur(0px)" },
  };
  const selectedVariant = variant || defaultVariants;
  
  if (animateByCharacter) {
    return (
      <div className={className}>
        {text.split("").map((char, i) => (
          <motion.span
            key={i}
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={selectedVariant}
            transition={{
              delay: delay + i * characterDelay,
              duration: 0.2,
              ease: "easeOut",
            }}
            style={{ display: "inline-block" }}
          >
            {char === " " ? "\u00A0" : char}
          </motion.span>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="hidden"
      variants={selectedVariant}
      transition={{
        delay,
        duration: 0.4,
        ease: "easeOut",
      }}
      className={className}
    >
      {text}
    </motion.div>
  );
}
