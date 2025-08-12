"use client";

import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import React, { forwardRef, useRef } from "react";
import { debugLogger } from '../../services/debugLogger';

export interface AnimatedBeamProps {
  className?: string;
  containerRef: React.RefObject<HTMLElement>;
  fromRef: React.RefObject<HTMLElement>;
  toRef: React.RefObject<HTMLElement>;
  curvature?: number;
  reverse?: boolean;
  pathColor?: string;
  pathWidth?: number;
  pathOpacity?: number;
  gradientStartColor?: string;
  gradientStopColor?: string;
  delay?: number;
  duration?: number;
  startXOffset?: number;
  startYOffset?: number;
  endXOffset?: number;
  endYOffset?: number;
}

export const AnimatedBeam = forwardRef<SVGSVGElement, AnimatedBeamProps>(
  (
    {
      className,
      containerRef,
      fromRef,
      toRef,
      curvature = 0,
      reverse = false,
      duration = Math.random() * 3 + 4,
      delay = 0,
      pathColor = "gray",
      pathWidth = 2,
      pathOpacity = 0.2,
      gradientStartColor = "#ffaa40",
      gradientStopColor = "#9c40ff",
      startXOffset = 0,
      startYOffset = 0,
      endXOffset = 0,
      endYOffset = 0,
    },
    ref,
  ) => {
    const id = React.useId();
    const svgRef = useRef<SVGSVGElement>(null);
    const pathRef = useRef<SVGPathElement>(null);

    React.useEffect(() => {
      const updatePath = () => {
        if (
          containerRef.current &&
          fromRef.current &&
          toRef.current &&
          pathRef.current
        ) {
          const containerRect = containerRef.current.getBoundingClientRect();
          const rectA = fromRef.current.getBoundingClientRect();
          const rectB = toRef.current.getBoundingClientRect();

          const svgWidth = containerRect.width;
          const svgHeight = containerRect.height;
          const svgX = containerRect.left;
          const svgY = containerRect.top;

          const startX =
            rectA.left - svgX + rectA.width / 2 + startXOffset;
          const startY =
            rectA.top - svgY + rectA.height / 2 + startYOffset;
          const endX = rectB.left - svgX + rectB.width / 2 + endXOffset;
          const endY = rectB.top - svgY + rectB.height / 2 + endYOffset;

          const controlPointX = startX + (endX - startX) / 2;
          const controlPointY = startY - curvature;

          const d = `M ${startX},${startY} Q ${controlPointX},${controlPointY} ${endX},${endY}`;
          pathRef.current.setAttribute("d", d);
        }
      };

      // Set up ResizeObserver
      const resizeObserver = new ResizeObserver((entries) => {
        // On the next frame (to ensure elements are rendered)
        requestAnimationFrame(updatePath);
      });

      // Observe the container element
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      // Call the updatePath initially
      updatePath();

      // Clean up the observer on component unmount
      return () => {
        resizeObserver.disconnect();
      };
    }, [
      containerRef,
      fromRef,
      toRef,
      curvature,
      startXOffset,
      startYOffset,
      endXOffset,
      endYOffset,
    ]);

    return (
      <svg
        ref={svgRef}
        fill="none"
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          "pointer-events-none absolute left-0 top-0 transform-gpu stroke-2",
          className,
        )}
        viewBox={`0 0 ${containerRef.current?.getBoundingClientRect().width || 0} ${
          containerRef.current?.getBoundingClientRect().height || 0
        }`}
      >
        <defs>
          <linearGradient
            className={`transform-gpu ${reverse ? "rotate-180" : ""}`}
            id={`${id}`}
            x1="0%"
            x2="100%"
            y1="0%"
            y2="0%"
          >
            <stop offset="0%" stopColor={gradientStartColor} stopOpacity="0" />
            <stop offset="32.5%" stopColor={gradientStartColor} />
            <stop offset="67.5%" stopColor={gradientStopColor} />
            <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        <motion.path
          ref={pathRef}
          stroke={pathColor}
          strokeWidth={pathWidth}
          strokeOpacity={pathOpacity}
          fill="none"
        />
        <motion.path
          stroke={`url(#${id})`}
          strokeWidth={pathWidth}
          strokeOpacity="1"
          fill="none"
          pathLength="1"
          initial={{
            strokeDasharray: "0 1",
          }}
          animate={{
            strokeDasharray: ["0 1", "1 1", "0 1"],
          }}
          transition={{
            duration,
            repeat: Infinity,
            delay,
            ease: "linear",
          }}
        />
      </svg>
    );
  },
);

AnimatedBeam.displayName = "AnimatedBeam";
