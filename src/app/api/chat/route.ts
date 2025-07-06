import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { message, attachments, model, settings } = await req.json();

    // Process attachments if any
    let prompt = message;
    if (attachments?.length > 0) {
      const attachmentDescriptions = attachments
        .map(attachment => `[Attached ${attachment.type}: ${attachment.name}]`)
        .join('\n');
      prompt = `${message}\n\n${attachmentDescriptions}`;
    }

    // Here we would typically call LittleLLM API
    // For now, we'll return a mock response
    const response = `I received your message: "${prompt}"
I am using model: ${model}
With settings: temperature=${settings.temperature}, maxTokens=${settings.maxTokens}`;

    return NextResponse.json({
      id: Date.now().toString(),
      content: response,
      role: 'assistant',
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
