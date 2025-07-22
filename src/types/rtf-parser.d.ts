declare module 'rtf-parser' {
  interface RTFDocument {
    content?: unknown;
    text?: string;
    [key: string]: unknown;
  }

  interface RTFParser {
    parseRTF(rtfContent: string): Promise<RTFDocument>;
  }

  const rtfParser: RTFParser;
  export = rtfParser;
}
