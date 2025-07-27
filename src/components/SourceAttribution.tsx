import React, { useState } from 'react';
import { ExternalLink, FileText, Database, ChevronDown, ChevronRight, Globe } from 'lucide-react';
import { Button } from './ui/button';

interface Source {
  type: 'knowledge_base' | 'web' | 'document';
  title: string;
  url?: string;
  score?: number;
  snippet?: string;
}

interface SourceAttributionProps {
  sources: Source[];
  className?: string;
}

export const SourceAttribution: React.FC<SourceAttributionProps> = ({
  sources,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!sources || sources.length === 0) {
    return null;
  }

  const getSourceIcon = (type: Source['type']) => {
    switch (type) {
      case 'knowledge_base':
        return <Database className="h-3 w-3" />;
      case 'web':
        return <Globe className="h-3 w-3" />;
      case 'document':
        return <FileText className="h-3 w-3" />;
      default:
        return <FileText className="h-3 w-3" />;
    }
  };

  const getSourceTypeLabel = (type: Source['type']) => {
    switch (type) {
      case 'knowledge_base':
        return 'Knowledge Base';
      case 'web':
        return 'Web';
      case 'document':
        return 'Document';
      default:
        return 'Source';
    }
  };

  const handleSourceClick = (source: Source) => {
    if (source.url) {
      // For web URLs, open in external browser
      if (source.type === 'web' && typeof window !== 'undefined' && window.electronAPI) {
        window.electronAPI.openExternal?.(source.url);
      } else {
        // For other URLs, open in default browser
        window.open(source.url, '_blank', 'noopener,noreferrer');
      }
    }
  };

  const groupedSources = sources.reduce((acc, source) => {
    if (!acc[source.type]) {
      acc[source.type] = [];
    }
    acc[source.type].push(source);
    return acc;
  }, {} as Record<Source['type'], Source[]>);

  return (
    <div className={`mt-3 border-t border-border/50 pt-3 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">Sources ({sources.length})</span>
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </Button>
      </div>

      {/* Compact view - show first few sources */}
      {!isExpanded && (
        <div className="mt-2 flex flex-wrap gap-1">
          {sources.slice(0, 3).map((source, index) => (
            <button
              key={index}
              onClick={() => handleSourceClick(source)}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs bg-muted/50 hover:bg-muted transition-colors ${
                source.url ? 'cursor-pointer hover:text-primary' : 'cursor-default'
              }`}
              disabled={!source.url}
            >
              {getSourceIcon(source.type)}
              <span className="truncate max-w-[120px]">{source.title}</span>
              {source.url && <ExternalLink className="h-2 w-2" />}
            </button>
          ))}
          {sources.length > 3 && (
            <span className="inline-flex items-center px-2 py-1 text-xs text-muted-foreground">
              +{sources.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Expanded view - show all sources grouped by type */}
      {isExpanded && (
        <div className="mt-2 space-y-3">
          {Object.entries(groupedSources).map(([type, typeSources]) => (
            <div key={type}>
              <div className="flex items-center gap-2 mb-2">
                {getSourceIcon(type as Source['type'])}
                <span className="text-xs font-medium text-muted-foreground">
                  {getSourceTypeLabel(type as Source['type'])} ({typeSources.length})
                </span>
              </div>
              
              <div className="space-y-1 ml-5">
                {typeSources.map((source, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-2 p-2 rounded bg-muted/30 hover:bg-muted/50 transition-colors ${
                      source.url ? 'cursor-pointer' : ''
                    }`}
                    onClick={() => handleSourceClick(source)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground truncate">
                          {source.title}
                        </span>
                        {source.url && <ExternalLink className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                        {source.score && (
                          <span className="text-xs text-muted-foreground bg-muted px-1 rounded">
                            {Math.round(source.score * 100)}%
                          </span>
                        )}
                      </div>
                      
                      {source.snippet && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {source.snippet}
                        </p>
                      )}
                      
                      {source.url && source.type === 'web' && (
                        <p className="text-xs text-muted-foreground/70 mt-1 truncate">
                          {source.url}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
