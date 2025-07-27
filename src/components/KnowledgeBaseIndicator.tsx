import React from 'react';
import { Search, Database, BookOpen } from 'lucide-react';

interface KnowledgeBaseIndicatorProps {
  isSearching: boolean;
  searchQuery?: string;
  className?: string;
}

export const KnowledgeBaseIndicator: React.FC<KnowledgeBaseIndicatorProps> = ({
  isSearching,
  searchQuery,
  className = ''
}) => {
  if (!isSearching) return null;

  return (
    <div className={`flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg border border-border/50 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Database className="h-4 w-4" />
          <div className="absolute -top-1 -right-1">
            <Search className="h-3 w-3 animate-pulse text-blue-500" />
          </div>
        </div>
        <div className="flex items-center gap-1">
          <BookOpen className="h-3 w-3" />
          <span className="font-medium">Searching knowledge base...</span>
        </div>
      </div>
      
      {searchQuery && (
        <div className="text-xs text-muted-foreground/70 truncate max-w-[200px]">
          "{searchQuery.length > 50 ? searchQuery.substring(0, 50) + '...' : searchQuery}"
        </div>
      )}
      
      {/* Animated dots */}
      <div className="flex gap-1">
        <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  );
};
