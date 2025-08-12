import React from 'react';
import {
  FileText,
  Edit3,
  MessageSquare,
  Mail,
  Reply,
  Code,
  Bug,
  Lightbulb,
  Sparkles,
  BookOpen,
  PenTool,
  Zap,
  Sun,
  Moon,
  Palette,
  Mountain,
  Star,
  Heart,
  Coffee,
  Clipboard,
  RotateCw,
  Search,
  Settings,
  Terminal,
  Cpu,
  Smartphone,
  Monitor,
  Database,
  Link,
  Clock,
  Calendar,
  MapPin,
  Phone,
  Target,
  TrendingUp,
  BarChart,
  Activity,
  Gift,
  ShoppingCart,
  CreditCard,
  Truck,
  Home,
  Building,
  Car,
  Plane,
  Ship,
  Train,
  Bike,
  Gamepad2,
  Wrench,
  Hammer,
  Key,
  Lock,
  Unlock,
  Eye,
  Volume2,
  VolumeX,
  Battery,
  Power,
  RotateCcw,
  X,
  Check,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  Smile,
  Frown,
  Meh,
  Bot,
  Brain,
  Globe,
  Layers,
  Repeat,
  Server,
  Wind
} from 'lucide-react';

// Mapping of emoji/emoticon strings to Lucide React components
export const iconMapping: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  // Text and writing
  '📝': FileText,
  '✏️': Edit3,
  '📄': FileText,
  '📃': FileText,
  '📋': Clipboard,
  '✍️': PenTool,
  '📖': BookOpen,
  '📚': BookOpen,

  // Communication
  '💬': MessageSquare,
  '✉️': Mail,
  '📧': Mail,
  '📨': Mail,
  '📩': Mail,
  '↩️': Reply,
  '📞': Phone,
  '📱': Smartphone,

  // Code and development
  '💻': Code,
  '🖥️': Monitor,
  '⌨️': Terminal,
  '🐛': Bug,
  '🔧': Wrench,
  '⚙️': Settings,
  '🔨': Hammer,
  '🛠️': Wrench,
  '💾': Database,
  '🖱️': Cpu,

  // Ideas and creativity
  '💡': Lightbulb,
  '✨': Sparkles,
  '🎨': Palette,
  '🖌️': PenTool,
  '🎭': Palette,
  '🎪': Zap,

  // Weather and nature
  '☀️': Sun,
  '🌙': Moon,
  '🌟': Star,
  '⭐': Star,
  '🌈': Palette,
  '🏔️': Mountain,
  '🌅': Sun,
  '🌲': Mountain,
  '🌸': Star,
  '🌺': Star,
  '🌻': Star,
  '🌹': Star,

  // Actions and symbols
  '✅': Check,
  '❌': X,
  '🔍': Search,
  '🔎': Search,
  '📊': BarChart,
  '📈': TrendingUp,
  '📉': Activity,
  '🎯': Target,
  '🔗': Link,
  '📎': Clipboard,
  '📌': MapPin,
  '⏰': Clock,
  '📅': Calendar,
  '🔔': AlertCircle,
  '🔕': VolumeX,
  '🔊': Volume2,
  '🔇': VolumeX,

  // Emotions and reactions
  '😀': Smile,
  '😃': Smile,
  '😄': Smile,
  '😁': Smile,
  '😊': Smile,
  '😍': Heart,
  '😘': Heart,
  '😉': Smile,
  '😢': Frown,
  '😭': Frown,
  '😡': Frown,
  '😠': Frown,
  '😐': Meh,
  '😕': Frown,
  '👍': ThumbsUp,
  '👎': ThumbsDown,
  '❤️': Heart,
  '💖': Heart,
  '💕': Heart,

  // Objects and items
  '🎁': Gift,
  '🛒': ShoppingCart,
  '💳': CreditCard,
  '🚚': Truck,
  '🏠': Home,
  '🏢': Building,
  '🚗': Car,
  '✈️': Plane,
  '🚢': Ship,
  '🚂': Train,
  '🚴': Bike,
  '🎮': Gamepad2,
  '☕': Coffee,
  '🔑': Key,
  '🔒': Lock,
  '🔓': Unlock,
  '👁️': Eye,
  '🔋': Battery,
  '⚡': Power,
  '🔄': RotateCw,
  '🔃': RotateCw,
  '🔁': RotateCcw,

  // Default fallback
  '': FileText
};

// Helper function to get Lucide icon component from emoji string
export const getIconComponent = (emoji: string): React.ComponentType<React.SVGProps<SVGSVGElement>> => {
  return iconMapping[emoji] || FileText;
};

// Helper function to render icon with consistent props
export const renderIcon = (emoji: string, className = "h-4 w-4") => {
  const IconComponent = getIconComponent(emoji);
  return <IconComponent className={className} />;
};

// Provider icons mapping
export const providerIcons: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
  openai: Zap,        // Lightning bolt for OpenAI
  anthropic: Brain,   // Brain for Anthropic Claude
  gemini: Sparkles,   // Sparkles for Google Gemini
  mistral: Wind,      // Wind for Mistral AI
  deepseek: Search,   // Search for DeepSeek
  deepinfra: Server,  // Server for Deepinfra (cloud infrastructure)
  lmstudio: Monitor,  // Monitor for LM Studio (local server)
  ollama: Terminal,   // Terminal for local Ollama
  openrouter: Globe,  // Globe for OpenRouter (routing)
  requesty: Layers,   // Layers for Requesty (smart routing)
  replicate: Repeat,  // Repeat for Replicate (cloud models)
};

// Helper function to get provider icon
export const getProviderIcon = (providerId: string): React.ComponentType<React.SVGProps<SVGSVGElement>> => {
  return providerIcons[providerId] || Bot; // Default to Bot icon
};

// Helper function to render provider icon
export const renderProviderIcon = (providerId: string, className = "h-4 w-4") => {
  const IconComponent = getProviderIcon(providerId);
  return <IconComponent className={className} />;
};