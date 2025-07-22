import React from 'react';

/**
 * Regular expression to detect HTTP and HTTPS URLs in text
 * Matches URLs with or without www, with various TLDs, paths, query parameters, and fragments
 */
const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;

/**
 * Regular expression to detect domain names without protocol (e.g., example.com, www.google.com)
 * More conservative pattern to avoid false positives
 * Handles domains in parentheses and other punctuation contexts
 */
const DOMAIN_REGEX = /(^|[\s([{])((?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.(?:[a-zA-Z]{2,6}|localhost)(?::\d+)?(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*)?)/g;

/**
 * Interface for parsed text segments
 */
interface TextSegment {
  type: 'text' | 'link';
  content: string;
  url?: string;
}

/**
 * Parses text and splits it into segments of regular text and URLs
 * @param text - The input text to parse
 * @returns Array of text segments
 */
function parseTextSegments(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const allMatches: Array<{ index: number; length: number; content: string; url: string }> = [];

  // Find all HTTP/HTTPS URLs
  URL_REGEX.lastIndex = 0;
  let match;
  while ((match = URL_REGEX.exec(text)) !== null) {
    allMatches.push({
      index: match.index,
      length: match[0].length,
      content: match[0],
      url: match[0]
    });
  }

  // Find all domain-only URLs (like example.com)
  DOMAIN_REGEX.lastIndex = 0;
  while ((match = DOMAIN_REGEX.exec(text)) !== null) {
    let domainMatch = match[2]; // The domain part (without leading whitespace)
    const domainIndex = match.index + match[1].length; // Adjust for leading whitespace

    // Remove trailing punctuation that shouldn't be part of the URL
    const trailingPunctuationMatch = domainMatch.match(/^(.+?)[)\]}.:,;!?]*$/);
    if (trailingPunctuationMatch) {
      domainMatch = trailingPunctuationMatch[1];
    }

    // Skip if this domain is already covered by a full URL
    const isAlreadyCovered = allMatches.some(existing =>
      domainIndex >= existing.index &&
      domainIndex < existing.index + existing.length
    );

    if (!isAlreadyCovered && domainMatch) {
      // Add https:// prefix for the URL
      const fullUrl = domainMatch.startsWith('http') ? domainMatch : `https://${domainMatch}`;
      allMatches.push({
        index: domainIndex,
        length: domainMatch.length,
        content: domainMatch,
        url: fullUrl
      });
    }
  }

  // Sort matches by index to process them in order
  allMatches.sort((a, b) => a.index - b.index);

  let lastIndex = 0;
  for (const urlMatch of allMatches) {
    // Add text before the URL if any
    if (urlMatch.index > lastIndex) {
      const textContent = text.slice(lastIndex, urlMatch.index);
      if (textContent) {
        segments.push({
          type: 'text',
          content: textContent
        });
      }
    }

    // Add the URL segment
    segments.push({
      type: 'link',
      content: urlMatch.content,
      url: urlMatch.url
    });

    lastIndex = urlMatch.index + urlMatch.length;
  }

  // Add remaining text after the last URL if any
  if (lastIndex < text.length) {
    const textContent = text.slice(lastIndex);
    if (textContent) {
      segments.push({
        type: 'text',
        content: textContent
      });
    }
  }

  // If no URLs were found, return the entire text as a single segment
  if (segments.length === 0) {
    segments.push({
      type: 'text',
      content: text
    });
  }

  return segments;
}

/**
 * Handles clicking on external links
 * Opens the URL in the user's default browser via Electron's shell.openExternal
 * @param url - The URL to open
 */
function handleLinkClick(url: string) {
  // Prevent default link behavior
  if (typeof window !== 'undefined' && window.electronAPI?.openExternalLink) {
    // Use Electron API to open in external browser
    window.electronAPI.openExternalLink(url);
  } else {
    // Fallback for non-Electron environments (development)
    console.log('Would open URL:', url);
    // In a web environment, we could use window.open
    // window.open(url, '_blank', 'noopener,noreferrer');
  }
}

/**
 * Props for the ParsedTextWithLinks component
 */
interface ParsedTextWithLinksProps {
  children: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Component that renders text with clickable links
 * Preserves whitespace and formatting while making URLs clickable
 * @param children - The text content to parse and render
 * @param className - CSS classes to apply to the container
 * @param style - Inline styles to apply to the container
 */
export function ParsedTextWithLinks({ children, className, style }: ParsedTextWithLinksProps) {
  const segments = parseTextSegments(children);

  return (
    <span className={className} style={style}>
      {segments.map((segment, index) => {
        if (segment.type === 'link' && segment.url) {
          return (
            <a
              key={index}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                handleLinkClick(segment.url!);
              }}
              className="text-blue-500 hover:text-blue-700 underline cursor-pointer"
              style={{
                WebkitAppRegion: 'no-drag',
                textDecoration: 'underline',
                color: 'rgb(59 130 246)', // blue-500
              } as React.CSSProperties & { WebkitAppRegion?: string }}
              title={`Open ${segment.url} in browser`}
            >
              {segment.content}
            </a>
          );
        } else {
          return (
            <span key={index}>
              {segment.content}
            </span>
          );
        }
      })}
    </span>
  );
}

/**
 * Utility function to parse text with links (for use in other components)
 * @param text - The text to parse
 * @param className - Optional CSS classes for the container
 * @param style - Optional inline styles for the container
 * @returns JSX element with parsed text and clickable links
 */
export function parseTextWithLinks(
  text: string, 
  className?: string, 
  style?: React.CSSProperties
): JSX.Element {
  return (
    <ParsedTextWithLinks className={className} style={style}>
      {text}
    </ParsedTextWithLinks>
  );
}


