'use client';

import { useState } from 'react';
import {
  Server,
  FileText,
  Settings,
  History,
  Terminal,
  Bot
} from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
  onClick?: () => void;
  providers?: string[]; // For provider sections
}

interface LeftSidebarProps {
  className?: string;
  onItemClick?: (itemId: string) => void;
}

export function LeftSidebar({
  className,
  onItemClick
}: LeftSidebarProps) {
  const [activeItem, setActiveItem] = useState<string>('');

  const sidebarItems: SidebarItem[] = [
    {
      id: 'agents',
      label: 'CUSTOM AGENTS',
      icon: Bot,
      onClick: () => handleItemClick('agents')
    },
    {
      id: 'mcp-servers',
      label: 'MCP SERVERS',
      icon: Server,
      onClick: () => handleItemClick('mcp-servers')
    },
    {
      id: 'prompts',
      label: 'PROMPTS',
      icon: FileText,
      onClick: () => handleItemClick('prompts')
    },
    {
      id: 'history',
      label: 'HISTORY',
      icon: History,
      onClick: () => handleItemClick('history')
    },
    {
      id: 'console',
      label: 'CONSOLE',
      icon: Terminal,
      onClick: () => handleItemClick('console')
    },
    {
      id: 'settings',
      label: 'SETTINGS',
      icon: Settings,
      onClick: () => handleItemClick('settings')
    }
  ];

  const handleItemClick = (itemId: string) => {
    setActiveItem(itemId);
    onItemClick?.(itemId);
  };

  return (
    <div
      className={cn(
        "flex flex-col w-12 h-full bg-gray-900/50 border-r border-gray-800/50",
        className
      )}
    >
      {/* Spacer to push buttons to bottom */}
      <div className="flex-1"></div>

      {/* Navigation Items - At bottom */}
      <div className="p-1 space-y-1">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;

          return (
            <Button
              key={item.id}
              variant="ghost"
              className={cn(
                "w-10 h-10 p-0",
                "hover:bg-gray-800/50 transition-colors duration-200",
                isActive && "bg-gray-800/70 text-white",
                !isActive && "text-gray-400 hover:text-white"
              )}
              onClick={item.onClick}
              title={item.label}
            >
              <Icon className="w-4 h-4" />
            </Button>
          );
        })}
      </div>
    </div>
  );
}
