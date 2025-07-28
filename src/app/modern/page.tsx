'use client';

import { ModernChatInterface } from '../../components/modern-ui/ModernChatInterface';

export default function ModernPage() {
  return (
    <div className="h-screen w-screen bg-gray-950 overflow-hidden modern-chat-interface">
      <ModernChatInterface />
    </div>
  );
}
