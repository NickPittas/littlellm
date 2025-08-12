'use client';

import React from 'react';
import { Brain } from 'lucide-react';
import { debugLogger } from '../services/debugLogger';

interface ThinkingIndicatorProps {
  className?: string;
}

export function ThinkingIndicator({ className = '' }: ThinkingIndicatorProps) {
  return (
    <div
      className={`flex items-center gap-3 p-4 rounded-lg border-2 ${className}`}
      style={{
        backgroundColor: 'rgba(55, 65, 81, 0.9)',
        borderColor: 'rgb(75, 85, 99)',
        color: 'white'
      }}
    >
      <Brain className="h-5 w-5 animate-pulse" style={{ color: 'rgb(59, 130, 246)' }} />
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium" style={{ color: 'white' }}>Thinking</span>
        <div className="flex gap-1">
          <div
            className="w-2 h-2 rounded-full thinking-dot"
            style={{ backgroundColor: 'rgb(59, 130, 246)' }}
          />
          <div
            className="w-2 h-2 rounded-full thinking-dot"
            style={{ backgroundColor: 'rgb(59, 130, 246)' }}
          />
          <div
            className="w-2 h-2 rounded-full thinking-dot"
            style={{ backgroundColor: 'rgb(59, 130, 246)' }}
          />
        </div>
      </div>
    </div>
  );
}
