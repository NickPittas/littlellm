'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { useTransparencyAwareStyles } from '@/contexts/TransparencyContext';

interface FloatingContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  level?: 1 | 2 | 3 | 4 | 'modal';
  variant?: 'container' | 'card' | 'toolbar' | 'dropdown' | 'message';
  responsive?: boolean;
  enterAnimation?: boolean;
}

export const FloatingContainer = React.forwardRef<HTMLDivElement, FloatingContainerProps>(
  ({ className, level = 1, variant = 'container', responsive = false, enterAnimation = false, ...props }, ref) => {
    const { getFloatingClass } = useTransparencyAwareStyles();
    
    const baseClass = `floating-${variant}`;
    const layerClass = getFloatingClass(level);
    const responsiveClass = responsive ? 'floating-responsive' : '';
    const animationClass = enterAnimation ? 'floating-enter' : '';
    
    return (
      <div
        ref={ref}
        className={cn(baseClass, layerClass, responsiveClass, animationClass, className)}
        {...props}
      />
    );
  }
);

FloatingContainer.displayName = 'FloatingContainer';

interface FloatingTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'muted' | 'accent';
}

export const FloatingText = React.forwardRef<HTMLSpanElement, FloatingTextProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const { textClass, mutedTextClass, accentTextClass } = useTransparencyAwareStyles();
    
    const variantClass = {
      default: textClass,
      muted: mutedTextClass,
      accent: accentTextClass,
    }[variant];
    
    return (
      <span
        ref={ref}
        className={cn(variantClass, className)}
        {...props}
      />
    );
  }
);

FloatingText.displayName = 'FloatingText';

interface FloatingCardProps extends React.HTMLAttributes<HTMLDivElement> {
  level?: 1 | 2 | 3 | 4;
  blur?: 'light' | 'medium' | 'heavy';
}

export const FloatingCard = React.forwardRef<HTMLDivElement, FloatingCardProps>(
  ({ className, level = 1, blur = 'medium', ...props }, ref) => {
    const { getFloatingClass } = useTransparencyAwareStyles();
    
    const layerClass = getFloatingClass(level);
    const blurClass = `floating-blur-${blur}`;
    
    return (
      <div
        ref={ref}
        className={cn('floating-card', layerClass, blurClass, className)}
        {...props}
      />
    );
  }
);

FloatingCard.displayName = 'FloatingCard';

interface FloatingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'secondary';
}

export const FloatingButton = React.forwardRef<HTMLButtonElement, FloatingButtonProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variantClass = `floating-button-${variant}`;
    
    return (
      <button
        ref={ref}
        className={cn('floating-button', variantClass, className)}
        {...props}
      />
    );
  }
);

FloatingButton.displayName = 'FloatingButton';

interface FloatingInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'search';
}

export const FloatingInput = React.forwardRef<HTMLInputElement, FloatingInputProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variantClass = `floating-input-${variant}`;
    
    return (
      <input
        ref={ref}
        className={cn('floating-input', variantClass, className)}
        {...props}
      />
    );
  }
);

FloatingInput.displayName = 'FloatingInput';

interface FloatingTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: 'default' | 'message';
}

export const FloatingTextarea = React.forwardRef<HTMLTextAreaElement, FloatingTextareaProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variantClass = `floating-input-${variant}`;

    return (
      <textarea
        ref={ref}
        className={cn('floating-input', variantClass, className)}
        {...props}
      />
    );
  }
);

FloatingTextarea.displayName = 'FloatingTextarea';
