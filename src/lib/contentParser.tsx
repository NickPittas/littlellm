import React from 'react';
import { CodeBlock, InlineCode } from '../components/CodeBlock';

/**
 * Regular expressions for different content types
 */
const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;
const DOMAIN_REGEX = /(^|[\s\(\[\{])((?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.(?:[a-zA-Z]{2,6}|localhost)(?::\d+)?(?:[-a-zA-Z0-9()@:%_\+.~#?&//=]*)?)/g;
const CODE_BLOCK_REGEX = /```(\w+)?\n?([\s\S]*?)```/g;
const INLINE_CODE_REGEX = /`([^`\n]+)`/g;

/**
 * Interface for parsed content segments
 */
interface ContentSegment {
  type: 'text' | 'link' | 'code-block' | 'inline-code';
  content: string;
  url?: string;
  language?: string;
  index: number;
  length: number;
}

/**
 * Handles clicking on external links
 */
function handleLinkClick(url: string) {
  if (typeof window !== 'undefined' && window.electronAPI?.openExternalLink) {
    window.electronAPI.openExternalLink(url);
  } else {
    console.log('Would open URL:', url);
  }
}

/**
 * Parses text and identifies all content segments (code blocks, inline code, links, text)
 * @param text - The input text to parse
 * @returns Array of content segments
 */
function parseContentSegments(text: string): ContentSegment[] {
  const segments: ContentSegment[] = [];

  // Find all code blocks first (highest priority)
  CODE_BLOCK_REGEX.lastIndex = 0;
  let match;
  while ((match = CODE_BLOCK_REGEX.exec(text)) !== null) {
    segments.push({
      type: 'code-block',
      content: match[2].trim(),
      language: match[1] || undefined,
      index: match.index,
      length: match[0].length
    });
  }

  // Find all inline code (second priority)
  INLINE_CODE_REGEX.lastIndex = 0;
  while ((match = INLINE_CODE_REGEX.exec(text)) !== null) {
    // Skip if this inline code is inside a code block
    const isInsideCodeBlock = segments.some(segment => 
      segment.type === 'code-block' &&
      match.index >= segment.index && 
      match.index < segment.index + segment.length
    );
    
    if (!isInsideCodeBlock) {
      segments.push({
        type: 'inline-code',
        content: match[1],
        index: match.index,
        length: match[0].length
      });
    }
  }

  // Find all HTTP/HTTPS URLs
  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    // Skip if this URL is inside a code block or inline code
    const isInsideCode = segments.some(segment => 
      (segment.type === 'code-block' || segment.type === 'inline-code') &&
      match.index >= segment.index && 
      match.index < segment.index + segment.length
    );
    
    if (!isInsideCode) {
      segments.push({
        type: 'link',
        content: match[0],
        url: match[0],
        index: match.index,
        length: match[0].length
      });
    }
  }

  // Find all domain-only URLs
  DOMAIN_REGEX.lastIndex = 0;
  while ((match = DOMAIN_REGEX.exec(text)) !== null) {
    const domainMatch = match[2];
    const domainIndex = match.index + match[1].length;
    
    // Remove trailing punctuation
    const cleanDomain = domainMatch.replace(/[\)\]\}\.,:;!?]*$/, '');
    
    // Skip if this domain is inside code or already covered by a full URL
    const isInsideCodeOrCovered = segments.some(segment => 
      ((segment.type === 'code-block' || segment.type === 'inline-code') &&
       domainIndex >= segment.index && domainIndex < segment.index + segment.length) ||
      (segment.type === 'link' &&
       domainIndex >= segment.index && domainIndex < segment.index + segment.length)
    );
    
    if (!isInsideCodeOrCovered && cleanDomain) {
      const fullUrl = cleanDomain.startsWith('http') ? cleanDomain : `https://${cleanDomain}`;
      segments.push({
        type: 'link',
        content: cleanDomain,
        url: fullUrl,
        index: domainIndex,
        length: cleanDomain.length
      });
    }
  }

  // Sort segments by index to process them in order
  segments.sort((a, b) => a.index - b.index);

  return segments;
}

/**
 * Renders parsed content segments as JSX
 * @param text - The original text
 * @param segments - The parsed content segments
 * @returns JSX elements
 */
function renderContentSegments(text: string, segments: ContentSegment[]): JSX.Element[] {
  const elements: JSX.Element[] = [];
  let lastIndex = 0;

  segments.forEach((segment, index) => {
    // Add text before this segment if any
    if (segment.index > lastIndex) {
      const textContent = text.slice(lastIndex, segment.index);
      if (textContent) {
        elements.push(
          <span key={`text-${index}-${lastIndex}`}>
            {textContent}
          </span>
        );
      }
    }

    // Add the segment
    switch (segment.type) {
      case 'code-block':
        elements.push(
          <CodeBlock
            key={`code-block-${index}`}
            code={segment.content}
            language={segment.language}
            className="my-2"
          />
        );
        break;
      
      case 'inline-code':
        elements.push(
          <InlineCode
            key={`inline-code-${index}`}
            code={segment.content}
          />
        );
        break;
      
      case 'link':
        elements.push(
          <a
            key={`link-${index}`}
            href="#"
            onClick={(e) => {
              e.preventDefault();
              handleLinkClick(segment.url!);
            }}
            className="text-blue-500 hover:text-blue-700 underline cursor-pointer"
            style={{
              WebkitAppRegion: 'no-drag',
              textDecoration: 'underline',
              color: 'rgb(59 130 246)',
            } as React.CSSProperties & { WebkitAppRegion?: string }}
            title={`Open ${segment.url} in browser`}
          >
            {segment.content}
          </a>
        );
        break;
    }

    lastIndex = segment.index + segment.length;
  });

  // Add remaining text after the last segment
  if (lastIndex < text.length) {
    const textContent = text.slice(lastIndex);
    if (textContent) {
      elements.push(
        <span key={`text-final-${lastIndex}`}>
          {textContent}
        </span>
      );
    }
  }

  return elements;
}

/**
 * Props for the ParsedContent component
 */
interface ParsedContentProps {
  children: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Component that renders text with code blocks, inline code, and clickable links
 * @param children - The text content to parse and render
 * @param className - CSS classes to apply to the container
 * @param style - Inline styles to apply to the container
 */
export function ParsedContent({ children, className, style }: ParsedContentProps) {
  const segments = parseContentSegments(children);
  const elements = renderContentSegments(children, segments);

  return (
    <div className={className} style={style}>
      {elements.length > 0 ? elements : children}
    </div>
  );
}

/**
 * Utility function to parse text with all content types
 * @param text - The text to parse
 * @param className - Optional CSS classes for the container
 * @param style - Optional inline styles for the container
 * @returns JSX element with parsed content
 */
export function parseTextWithContent(
  text: string, 
  className?: string, 
  style?: React.CSSProperties
): JSX.Element {
  return (
    <ParsedContent className={className} style={style}>
      {text}
    </ParsedContent>
  );
}
