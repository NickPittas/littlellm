'use client';

import { VoilaInterfaceEnhanced } from '../../components/VoilaInterfaceEnhanced';

export default function TestEnhancedPage() {
  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-foreground mb-4">
          Enhanced LittleLLM Interface Test
        </h1>
        <p className="text-muted-foreground mb-6">
          Testing the new Magic UI enhanced interface with animations and improved UX.
        </p>
        
        <div className="border rounded-lg overflow-hidden">
          <VoilaInterfaceEnhanced />
        </div>
        
        <div className="mt-6 text-sm text-muted-foreground">
          <h2 className="font-semibold mb-2">New Features:</h2>
          <ul className="list-disc list-inside space-y-1">
            <li>Magic Card components with mouse-following gradients</li>
            <li>Blur Fade animations for smooth content appearance</li>
            <li>Border Beam effects for active states and loading</li>
            <li>Enhanced file attachment previews with animations</li>
            <li>Improved visual hierarchy and spacing</li>
            <li>Smooth transitions and micro-interactions</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
