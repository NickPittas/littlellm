'use client';

import React, { useState } from 'react';
import { parseTextWithContent } from '../lib/contentParser';
import { ContentItem } from '../services/chatService';
import { ImageViewer } from './ImageViewer';

interface MessageContentProps {
  content: string | ContentItem[];
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Component to render message content with proper image support
 * Handles both string content and ContentItem arrays
 */
export function MessageContent({ content, className, style }: MessageContentProps) {
  const [imageViewerSrc, setImageViewerSrc] = useState<string | null>(null);
  // Handle string content (simple text)
  if (typeof content === 'string') {
    // Clean up excessive line breaks and normalize spacing
    const cleanContent = content
      .replace(/\n{3,}/g, '\n\n') // Replace 3+ consecutive newlines with 2
      .replace(/^\s+|\s+$/g, '') // Trim leading/trailing whitespace
      .replace(/[ \t]+/g, ' '); // Replace multiple spaces/tabs with single space

    return (
      <>
        {parseTextWithContent(cleanContent, className, style)}

        {/* Image Viewer Modal */}
        {imageViewerSrc && (
          <ImageViewer
            src={imageViewerSrc}
            alt="Image"
            isOpen={!!imageViewerSrc}
            onClose={() => setImageViewerSrc(null)}
          />
        )}
      </>
    );
  }

  // Handle ContentItem array (mixed content with images)
  if (Array.isArray(content)) {
    return (
      <>
        <div className={className} style={style}>
          {content.map((item, index) => {
          switch (item.type) {
            case 'text':
              return (
                <div key={`text-${index}`} className="inline">
                  {parseTextWithContent(item.text || '', '', {})}
                </div>
              );
            
            case 'image_url': {
              const imageUrl = typeof item.image_url === 'string'
                ? item.image_url
                : item.image_url?.url;
              
              if (!imageUrl) return null;
              
              // Handle base64 data URLs
              if (imageUrl.startsWith('data:image/')) {
                return (
                  <div key={`image-${index}`} className="my-2">
                    <img
                      src={imageUrl}
                      alt={`User uploaded image ${index + 1}`}
                      className="max-w-full h-auto rounded-lg border border-border cursor-pointer hover:opacity-80 transition-opacity"
                      style={{
                        maxHeight: '400px',
                        objectFit: 'contain',
                        WebkitAppRegion: 'no-drag'
                      } as React.CSSProperties & { WebkitAppRegion?: string }}
                      onClick={() => setImageViewerSrc(imageUrl)}
                      title="Click to view full size"
                    />
                  </div>
                );
              }
              
              // Handle regular URLs
              return (
                <div key={`image-${index}`} className="my-2">
                  <img
                    src={imageUrl}
                    alt={`Image ${index + 1}`}
                    className="max-w-full h-auto rounded-lg border border-border cursor-pointer hover:opacity-80 transition-opacity"
                    style={{
                      maxHeight: '400px',
                      objectFit: 'contain',
                      WebkitAppRegion: 'no-drag'
                    } as React.CSSProperties & { WebkitAppRegion?: string }}
                    onClick={() => setImageViewerSrc(imageUrl)}
                    onError={(e) => {
                      // Fallback to link if image fails to load
                      const target = e.target as HTMLImageElement;
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `
                          <a href="#" 
                             class="text-blue-500 hover:text-blue-700 underline cursor-pointer inline-block p-2 border border-border rounded" 
                             onclick="event.preventDefault(); ${typeof window !== 'undefined' && window.electronAPI ? 'window.electronAPI.openExternal' : 'window.open'}('${imageUrl}', '_blank')" 
                             title="Open ${imageUrl} in browser">
                            📷 Image: ${imageUrl}
                          </a>
                        `;
                      }
                    }}
                    title={`Click to open ${imageUrl} in browser`}
                  />
                </div>
              );
            }

            default: {
              // Handle other content types as text
              return (
                <div key={`content-${index}`} className="inline">
                  {JSON.stringify(item)}
                </div>
              );
            }
          }
        })}
        </div>

        {/* Image Viewer Modal */}
        {imageViewerSrc && (
          <ImageViewer
            src={imageViewerSrc}
            alt="Image"
            isOpen={!!imageViewerSrc}
            onClose={() => setImageViewerSrc(null)}
          />
        )}
      </>
    );
  }

  // Fallback for other content types
  return (
    <>
      <div className={className} style={style}>
        {String(content)}
      </div>

      {/* Image Viewer Modal */}
      {imageViewerSrc && (
        <ImageViewer
          src={imageViewerSrc}
          alt="Image"
          isOpen={!!imageViewerSrc}
          onClose={() => setImageViewerSrc(null)}
        />
      )}
    </>
  );
}
