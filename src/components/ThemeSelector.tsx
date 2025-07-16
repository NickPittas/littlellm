'use client';

import React, { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { useTheme, type Theme } from '../contexts/ThemeContext';
import { Palette } from 'lucide-react';

export function ThemeSelector() {
  const [showDialog, setShowDialog] = useState(false);
  const { theme, setTheme, themes } = useTheme();

  const handleThemeSelect = (selectedTheme: Theme) => {
    setTheme(selectedTheme);
    setShowDialog(false);
  };

  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          title="Change theme"
        >
          <Palette className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose Theme</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-96 overflow-y-auto">
          {themes.map((themeOption) => (
            <div
              key={themeOption.id}
              className={`p-3 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                theme.id === themeOption.id 
                  ? 'border-primary bg-primary/5 shadow-md' 
                  : 'border-border hover:border-primary/50'
              }`}
              onClick={() => handleThemeSelect(themeOption)}
            >
              <div className="flex flex-col items-center gap-2">
                <div className="text-2xl">
                  {typeof themeOption.icon === 'string'
                    ? themeOption.icon
                    : React.createElement(themeOption.icon, { width: 24, height: 24 })
                  }
                </div>
                <div className="text-sm font-medium text-center">{themeOption.name}</div>
                
                {/* Theme preview */}
                <div className="w-full h-8 rounded flex overflow-hidden">
                  <div 
                    className="flex-1" 
                    style={{ backgroundColor: `hsl(${themeOption.colors.background})` }}
                  />
                  <div 
                    className="flex-1" 
                    style={{ backgroundColor: `hsl(${themeOption.colors.primary})` }}
                  />
                  <div 
                    className="flex-1" 
                    style={{ backgroundColor: `hsl(${themeOption.colors.secondary})` }}
                  />
                  <div 
                    className="flex-1" 
                    style={{ backgroundColor: `hsl(${themeOption.colors.accent})` }}
                  />
                </div>
                
                {theme.id === themeOption.id && (
                  <div className="text-xs text-primary font-medium">✓ Active</div>
                )}
              </div>
            </div>
          ))}
        </div>
        
        <div className="text-xs text-muted-foreground text-center mt-4">
          {themes.length} themes available • Theme preference is saved automatically
        </div>
      </DialogContent>
    </Dialog>
  );
}
