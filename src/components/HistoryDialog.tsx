'use client';

import { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { ScrollArea } from './ui/scroll-area';
import { Trash2, MessageSquare } from 'lucide-react';
import { conversationHistoryService, type Conversation } from '../services/conversationHistoryService';

interface HistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadConversation: (conversation: Conversation) => void;
}

export function HistoryDialog({ open, onOpenChange, onLoadConversation }: HistoryDialogProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);

  const loadConversations = async () => {
    setLoading(true);
    try {
      const allConversations = await conversationHistoryService.getAllConversations();
      setConversations(allConversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadConversations();
    }
  }, [open]);

  const handleDeleteConversation = async (conversationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await conversationHistoryService.deleteConversation(conversationId);
      await loadConversations(); // Refresh the list
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const handleClearAllHistory = async () => {
    if (confirm('Are you sure you want to clear all chat history? This cannot be undone.')) {
      try {
        await conversationHistoryService.clearAllHistory();
        setConversations([]);
      } catch (error) {
        console.error('Failed to clear history:', error);
      }
    }
  };

  const handleLoadConversation = (conversation: Conversation) => {
    onLoadConversation(conversation);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md max-h-[80vh]"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Chat History</span>
            {conversations.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAllHistory}
                className="text-xs"
              >
                Clear All
              </Button>
            )}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh]">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading conversations...
            </div>
          ) : conversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No chat history yet</p>
              <p className="text-sm">Start a conversation to see it here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer group"
                  onClick={() => handleLoadConversation(conversation)}
                  style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate">
                        {conversation.title}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        {conversation.messages.length} messages • {conversation.updatedAt.toLocaleDateString()}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 ml-2"
                      onClick={(e) => handleDeleteConversation(conversation.id, e)}
                      title="Delete conversation"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
