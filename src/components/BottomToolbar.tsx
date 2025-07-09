'use client';

import { useState } from 'react';
import { Button } from './ui/button';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from './ui/select';
import { 
  Camera, 
  Paperclip, 
  History, 
  Settings, 
  ChevronDown,
  Zap,
  Brain,
  Cpu
} from 'lucide-react';
import { Badge } from './ui/badge';
import { SettingsDialog } from './SettingsDialog';

const models = [
  { 
    id: 'deepseek-r1', 
    name: 'DeepSeek R1', 
    provider: 'DeepSeek',
    icon: <Brain className="h-4 w-4" />,
    badge: 'Reasoning'
  },
  { 
    id: 'gpt-4', 
    name: 'GPT-4', 
    provider: 'OpenAI',
    icon: <Zap className="h-4 w-4" />,
    badge: 'Premium'
  },
  { 
    id: 'claude-3-sonnet', 
    name: 'Claude 3 Sonnet', 
    provider: 'Anthropic',
    icon: <Cpu className="h-4 w-4" />,
    badge: 'Fast'
  },
  { 
    id: 'mistral-7b', 
    name: 'Mistral 7B', 
    provider: 'Mistral',
    icon: <Zap className="h-4 w-4" />,
    badge: 'Free'
  }
];

interface BottomToolbarProps {
  onFileUpload?: (files: FileList) => void;
}

export function BottomToolbar({ onFileUpload }: BottomToolbarProps) {
  const [selectedModel, setSelectedModel] = useState('deepseek-r1');
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const currentModel = models.find(m => m.id === selectedModel) || models[0];

  const handleScreenshot = async () => {
    try {
      if (typeof window !== 'undefined' && window.electronAPI) {
        // Call electron screenshot API
        await window.electronAPI.takeScreenshot();
      } else {
        // Fallback for web version
        console.log('Screenshot functionality not available in web version');
      }
    } catch (error) {
      console.error('Failed to take screenshot:', error);
    }
  };

  const handleFileUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*,.pdf,.txt,.doc,.docx';
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && onFileUpload) {
        onFileUpload(files);
      }
    };
    input.click();
  };

  return (
    <div className="flex items-center justify-between p-3 border-t border-border bg-muted/30">
      {/* Left side - Model selector */}
      <div className="flex items-center gap-2">
        <Select value={selectedModel} onValueChange={setSelectedModel}>
          <SelectTrigger className="w-auto min-w-[180px] h-8">
            <div className="flex items-center gap-2">
              {currentModel.icon}
              <span className="font-medium">{currentModel.name}</span>
              <Badge variant="secondary" className="text-xs">
                {currentModel.badge}
              </Badge>
            </div>
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                <div className="flex items-center gap-2">
                  {model.icon}
                  <div className="flex flex-col">
                    <span className="font-medium">{model.name}</span>
                    <span className="text-xs text-muted-foreground">{model.provider}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {model.badge}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Right side - Action buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleScreenshot}
          title="Take screenshot"
          className="h-8 w-8 p-0"
        >
          <Camera className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={handleFileUpload}
          title="Upload file"
          className="h-8 w-8 p-0"
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowHistory(!showHistory)}
          title="Chat history"
          className="h-8 w-8 p-0"
        >
          <History className="h-4 w-4" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
          title="Settings"
          className="h-8 w-8 p-0"
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Settings Dialog */}
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}
