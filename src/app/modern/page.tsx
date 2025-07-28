'use client';

import dynamic from 'next/dynamic';

const ModernChatInterface = dynamic(
  () => import('../../components/modern-ui/ModernChatInterface').then(mod => ({ default: mod.ModernChatInterface })),
  {
    ssr: false,
    loading: () => <div className="h-screen w-screen bg-gray-950 flex items-center justify-center text-white">Loading...</div>
  }
);

export default function ModernPage() {
  return (
    <div className="h-screen w-screen bg-gray-950 overflow-hidden modern-chat-interface">
      <ModernChatInterface />
    </div>
  );
}
