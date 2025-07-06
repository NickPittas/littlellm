interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  attachments?: Array<{
    type: 'image' | 'document';
    url: string;
    name?: string;
  }>;
}

interface ChatSettings {
  temperature: number;
  maxTokens: number;
  stopSequences: string[];
}

export const chatService = {
  async sendMessage(
    message: string,
    files: File[] | undefined,
    model: string,
    settings: ChatSettings
  ): Promise<Message> {
    // First, handle file uploads if any
    const attachments = files ? await Promise.all(
      files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        
        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Failed to upload file');
        }
        
        const { url } = await response.json();
        return {
          type: file.type.startsWith('image/') ? 'image' : 'document',
          url,
          name: file.name,
        };
      })
    ) : undefined;

    // Send the message to the API
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        attachments,
        model,
        settings,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    return response.json();
  },
};
