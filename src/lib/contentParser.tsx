import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock, InlineCode } from '../components/CodeBlock';

/**
 * Regular expressions for different content types
 */
const URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/g;
const DOMAIN_REGEX = /(^|[\s([{])((?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.(?:[a-zA-Z]{2,6}|localhost)(?::\d+)?(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*)?)/g;
const CODE_BLOCK_REGEX = /```(\w+)?\n?([\s\S]*?)```/g;
const INLINE_CODE_REGEX = /`([^`\n]+)`/g;
const IMAGE_URL_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?[^)\s]*)?/gi;

/**
 * Interface for parsed content segments
 */
interface ContentSegment {
  type: 'text' | 'link' | 'code-block' | 'inline-code' | 'image';
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
  let match: RegExpExecArray | null;
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
      match!.index >= segment.index &&
      match!.index < segment.index + segment.length
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

  // Find all image URLs first (higher priority than regular links)
  IMAGE_URL_REGEX.lastIndex = 0;
  while ((match = IMAGE_URL_REGEX.exec(text)) !== null) {
    // Skip if this URL is inside a code block or inline code
    const isInsideCode = segments.some(segment =>
      (segment.type === 'code-block' || segment.type === 'inline-code') &&
      match!.index >= segment.index &&
      match!.index < segment.index + segment.length
    );

    if (!isInsideCode) {
      segments.push({
        type: 'image',
        content: match[0],
        url: match[0],
        index: match.index,
        length: match[0].length
      });
    }
  }

  // Find all HTTP/HTTPS URLs (excluding images already found)
  URL_REGEX.lastIndex = 0;
  while ((match = URL_REGEX.exec(text)) !== null) {
    // Skip if this URL is inside a code block, inline code, or already covered by an image
    const isInsideCodeOrImage = segments.some(segment =>
      ((segment.type === 'code-block' || segment.type === 'inline-code' || segment.type === 'image') &&
       match!.index >= segment.index &&
       match!.index < segment.index + segment.length)
    );

    if (!isInsideCodeOrImage) {
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
    const cleanDomain = domainMatch.replace(/[)\]}.,:;!?]*$/, '');
    
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
      
      case 'image':
        elements.push(
          <div key={`image-${index}`} className="my-2">
            <img
              src={segment.url!}
              alt="Image"
              className="max-w-full h-auto rounded-lg border border-border cursor-pointer hover:opacity-80 transition-opacity"
              style={{
                maxHeight: '400px',
                objectFit: 'contain',
                WebkitAppRegion: 'no-drag'
              } as React.CSSProperties & { WebkitAppRegion?: string }}
              onClick={() => {
                // Open image in new window/tab
                if (typeof window !== 'undefined' && window.electronAPI) {
                  window.electronAPI.openExternal(segment.url!);
                } else {
                  window.open(segment.url!, '_blank');
                }
              }}
              onError={(e) => {
                // Fallback to link if image fails to load
                const target = e.target as HTMLImageElement;
                const parent = target.parentElement;
                if (parent) {
                  parent.innerHTML = `<a href="#" class="text-blue-500 hover:text-blue-700 underline cursor-pointer" onclick="event.preventDefault(); ${typeof window !== 'undefined' && window.electronAPI ? 'window.electronAPI.openExternal' : 'window.open'}('${segment.url}', '_blank')" title="Open ${segment.url} in browser">${segment.content}</a>`;
                }
              }}
              title={`Click to open ${segment.url} in browser`}
            />
          </div>
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
/**
 * Enhanced markdown parser using react-markdown
 * @param text - The input text to parse as markdown
 * @returns JSX elements with parsed markdown content
 */
export function parseMarkdownContent(text: string): React.ReactNode {
  if (!text) return null;

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Custom code block component
        // Types for react-markdown renderers kept broad to match library's dynamic nodes
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : undefined;

          if (inline) {
            return <InlineCode code={String(children).replace(/\n$/, '')} />;
          }

          // Block code: render as a block-level container to avoid nesting <pre> within <p>
          return (
            <div className="my-2">
              <CodeBlock
                code={String(children).replace(/\n$/, '')}
                language={language}
              />
            </div>
          );
        },
        // Custom link component
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
        a({ href, children, ...props }: any) {
          return (
            <button
              onClick={() => href && handleLinkClick(href)}
              className="text-blue-400 hover:text-blue-300 underline cursor-pointer bg-transparent border-none p-0 font-inherit"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties & { WebkitAppRegion?: string }}
            >
              {children}
            </button>
          );
        },
        // Style headers
        h1: ({ children }: any) => <h1 className="text-2xl font-bold mb-4 mt-6">{children}</h1>,
        h2: ({ children }: any) => <h2 className="text-xl font-bold mb-3 mt-5">{children}</h2>,
        h3: ({ children }: any) => <h3 className="text-lg font-bold mb-2 mt-4">{children}</h3>,
        h4: ({ children }: any) => <h4 className="text-base font-bold mb-2 mt-3">{children}</h4>,
        h5: ({ children }: any) => <h5 className="text-sm font-bold mb-1 mt-2">{children}</h5>,
        h6: ({ children }: any) => <h6 className="text-xs font-bold mb-1 mt-2">{children}</h6>,
        // Style paragraphs with minimal spacing
        // Avoid placing block elements like <pre> inside <p>
        p: ({ children }: any) => <p className="mb-1 last:mb-0">{children}</p>,
        // Style lists with minimal spacing
        ul: ({ children }: any) => <ul className="list-disc list-inside mb-2 space-y-0">{children}</ul>,
        ol: ({ children }: any) => <ol className="list-decimal list-inside mb-2 space-y-0">{children}</ol>,
        li: ({ children }: any) => <li className="ml-4">{children}</li>,
        // Style blockquotes with minimal spacing
        blockquote: ({ children }: any) => (
          <blockquote className="border-l-4 border-gray-500 pl-4 italic my-2 text-gray-300">
            {children}
          </blockquote>
        ),
        // Style tables
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        table: ({ children }: any) => (
          <div className="overflow-x-auto my-4">
            <table className="min-w-full border-collapse border border-gray-600">
              {children}
            </table>
          </div>
        ),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        th: ({ children }: any) => (
          <th className="border border-gray-600 px-3 py-2 bg-gray-700 font-semibold text-left">
            {children}
          </th>
        ),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        td: ({ children }: any) => (
          <td className="border border-gray-600 px-3 py-2">
            {children}
          </td>
        ),
        // Style horizontal rules with minimal spacing
        hr: () => <hr className="my-3 border-gray-600" />,
        // Style strong and emphasis
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        strong: ({ children }: any) => <strong className="font-bold">{children}</strong>,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        em: ({ children }: any) => <em className="italic">{children}</em>,
      }}
    >
      {text}
    </ReactMarkdown>
  );
}

export function parseTextWithContent(
  text: string,
  className?: string,
  style?: React.CSSProperties
): JSX.Element {
  // Clean up excessive line breaks and normalize spacing
  const cleanText = text
    .replace(/\n{3,}/g, '\n\n') // Replace 3+ consecutive newlines with 2
    .replace(/[ \t]+/g, ' '); // Replace multiple spaces/tabs with single space

  // Check if the text contains markdown elements
  const hasMarkdown = /^#{1,6}\s|^\*\s|^\d+\.\s|^>\s|^\|.*\||```|`[^`]+`|\*\*.*\*\*|\*.*\*|_.*_|\[.*\]\(.*\)/m.test(cleanText);

  if (hasMarkdown) {
    return (
      <div className={className} style={style}>
        {parseMarkdownContent(cleanText)}
      </div>
    );
  }

  // Fallback to the original parser for simple text
  return (
    <ParsedContent className={className} style={style}>
      {cleanText}
    </ParsedContent>
  );
}
