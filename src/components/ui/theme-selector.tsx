'use client';

import React, { useState } from 'react';
import { THEME_PRESETS, type ThemePreset } from '../../config/themes';
import { Check } from 'lucide-react';

interface ThemeSelectorProps {
  selectedThemeId: string;
  onThemeSelect: (theme: ThemePreset) => void;
  className?: string;
}

export function ThemeSelector({ selectedThemeId, onThemeSelect, className }: ThemeSelectorProps) {
  const [hoveredTheme, setHoveredTheme] = useState<string | null>(null);

  return (
    <div className={`space-y-4 ${className || ''}`}>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {THEME_PRESETS.map((theme) => {
          const isSelected = selectedThemeId === theme.id;
          const isHovered = hoveredTheme === theme.id;

          return (
            <div
              key={theme.id}
              className="relative cursor-pointer group"
              onClick={() => onThemeSelect(theme)}
              onMouseEnter={() => setHoveredTheme(theme.id)}
              onMouseLeave={() => setHoveredTheme(null)}
            >
              {/* Theme Preview Card */}
              <div
                className={`
                  relative p-4 rounded-lg border-2 transition-all duration-200
                  ${isSelected 
                    ? 'border-primary shadow-lg scale-105' 
                    : 'border-border hover:border-primary/50 hover:scale-102'
                  }
                `}
                style={{
                  backgroundColor: theme.colors.card,
                  borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                }}
              >
                {/* Selected Indicator */}
                {isSelected && (
                  <div
                    className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: theme.colors.primary }}
                  >
                    <Check size={14} style={{ color: theme.colors.primaryForeground }} />
                  </div>
                )}

                {/* Theme Icon and Name */}
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{theme.icon}</span>
                  <div>
                    <h3 
                      className="font-medium text-sm"
                      style={{ color: theme.colors.cardForeground }}
                    >
                      {theme.name}
                    </h3>
                    <p 
                      className="text-xs opacity-75"
                      style={{ color: theme.colors.mutedForeground }}
                    >
                      {theme.description}
                    </p>
                  </div>
                </div>

                {/* Color Palette Preview */}
                <div className="flex gap-1 mb-3">
                  <div
                    className="w-4 h-4 rounded-sm"
                    style={{ backgroundColor: theme.colors.background }}
                    title="Background"
                  />
                  <div
                    className="w-4 h-4 rounded-sm"
                    style={{ backgroundColor: theme.colors.primary }}
                    title="Primary"
                  />
                  <div
                    className="w-4 h-4 rounded-sm"
                    style={{ backgroundColor: theme.colors.secondary }}
                    title="Secondary"
                  />
                  <div
                    className="w-4 h-4 rounded-sm"
                    style={{ backgroundColor: theme.colors.accent }}
                    title="Accent"
                  />
                  <div
                    className="w-4 h-4 rounded-sm"
                    style={{ backgroundColor: theme.colors.muted }}
                    title="Muted"
                  />
                </div>

                {/* Mini UI Preview */}
                <div 
                  className="p-2 rounded border"
                  style={{ 
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border 
                  }}
                >
                  {/* Mini Button */}
                  <div
                    className="inline-block px-2 py-1 rounded text-xs mb-1"
                    style={{
                      backgroundColor: theme.colors.primary,
                      color: theme.colors.primaryForeground,
                    }}
                  >
                    Button
                  </div>
                  
                  {/* Mini Text */}
                  <div 
                    className="text-xs"
                    style={{ color: theme.colors.foreground }}
                  >
                    Sample text
                  </div>
                </div>

                {/* Hover Effect Overlay */}
                {isHovered && !isSelected && (
                  <div 
                    className="absolute inset-0 rounded-lg opacity-10"
                    style={{ backgroundColor: theme.colors.primary }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Custom Theme Option */}
      <div className="pt-4 border-t border-border">
        <div className="text-sm text-muted-foreground">
          Want more control? You can still create a custom theme by selecting "Custom Colors" below.
        </div>
      </div>
    </div>
  );
}
