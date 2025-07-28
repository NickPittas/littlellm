import { TextToSpeechSettings } from '../types/settings';

export interface TTSVoice {
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

export class TextToSpeechService {
  private synthesis: SpeechSynthesis;
  private voices: SpeechSynthesisVoice[] = [];
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private settings: TextToSpeechSettings;
  private onVoicesChangedCallback?: () => void;

  constructor(settings: TextToSpeechSettings) {
    this.synthesis = window.speechSynthesis;
    this.settings = settings;

    // Force initial voice loading
    this.forceVoiceLoading();

    // Listen for voices changed event (voices load asynchronously)
    this.synthesis.addEventListener('voiceschanged', () => {
      console.log('🔊 TTS: voiceschanged event fired');
      this.loadVoices();
      this.onVoicesChangedCallback?.();
    });
  }

  private forceVoiceLoading(): void {
    console.log('🔊 TTS: Forcing voice loading...');

    // Multiple attempts to trigger voice loading
    this.loadVoices();

    // Method 1: Call getVoices multiple times
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        this.synthesis.getVoices();
        this.loadVoices();
      }, i * 50);
    }

    // Method 2: Create and cancel a dummy utterance to trigger voice loading
    setTimeout(() => {
      const dummy = new SpeechSynthesisUtterance('');
      dummy.volume = 0;
      this.synthesis.speak(dummy);
      this.synthesis.cancel();
      this.loadVoices();
      this.onVoicesChangedCallback?.();
    }, 200);

    // Method 3: Periodic checks for voice loading
    let attempts = 0;
    const checkVoices = () => {
      attempts++;
      const currentVoices = this.synthesis.getVoices();
      console.log(`🔊 TTS: Voice loading attempt ${attempts}, found ${currentVoices.length} voices`);

      if (currentVoices.length > this.voices.length || attempts >= 10) {
        this.loadVoices();
        this.onVoicesChangedCallback?.();
        if (attempts < 10) {
          console.log('🔊 TTS: Voice loading completed');
        }
      } else {
        setTimeout(checkVoices, 100);
      }
    };
    setTimeout(checkVoices, 300);
  }

  private loadVoices(): void {
    this.voices = this.synthesis.getVoices();
    console.log('🔊 TTS: Loaded voices:', this.voices.length);

    // Detect browser for voice availability info
    const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
    const isEdge = /Edg/.test(navigator.userAgent);
    const isElectron = /Electron/.test(navigator.userAgent);

    console.log('🔊 TTS: Browser detection - Chrome:', isChrome, 'Edge:', isEdge, 'Electron:', isElectron);

    // Log voice details for debugging
    if (this.voices.length > 0) {
      console.log('🔊 TTS: Available voices:', this.voices.map(v => ({
        name: v.name,
        lang: v.lang,
        localService: v.localService,
        default: v.default,
        voiceURI: v.voiceURI
      })));

      // Count different voice types
      const googleVoices = this.voices.filter(v =>
        v.name.toLowerCase().includes('google') ||
        v.voiceURI.toLowerCase().includes('google')
      );
      const remoteVoices = this.voices.filter(v => !v.localService);
      const microsoftVoices = this.voices.filter(v => v.name.toLowerCase().includes('microsoft'));

      console.log('🔊 TTS: Voice breakdown:');
      console.log('  - Google voices:', googleVoices.length);
      console.log('  - Remote voices:', remoteVoices.length);
      console.log('  - Microsoft voices:', microsoftVoices.length);
      console.log('  - Total voices:', this.voices.length);

      if (googleVoices.length === 0 && isElectron) {
        console.log('🔊 TTS: No Google voices found in Electron. Consider using Chrome browser for Google voices.');
      }
    }

    // If no voice is set in settings, prefer Google voices, then any available voice
    if (!this.settings.voice && this.voices.length > 0) {
      // Try to find a Google voice first
      const googleVoice = this.voices.find(v =>
        v.name.toLowerCase().includes('google') && v.lang.startsWith('en')
      );

      // If no Google voice, try any remote (non-local) voice
      const remoteVoice = this.voices.find(v => !v.localService && v.lang.startsWith('en'));

      // Otherwise use the first available voice
      const selectedVoice = googleVoice || remoteVoice || this.voices[0];
      this.settings.voice = selectedVoice.name;
      console.log('🔊 TTS: Auto-selected voice:', selectedVoice.name);
    }
  }

  public getAvailableVoices(): TTSVoice[] {
    return this.voices.map(voice => ({
      name: voice.name,
      lang: voice.lang,
      localService: voice.localService,
      default: voice.default
    }));
  }

  public getGoogleVoices(): TTSVoice[] {
    return this.getAvailableVoices().filter(voice =>
      voice.name.toLowerCase().includes('google') ||
      voice.name.toLowerCase().includes('chrome') ||
      (!voice.localService && (
        voice.name.toLowerCase().includes('en') ||
        voice.lang.startsWith('en') ||
        voice.name.toLowerCase().includes('neural') ||
        voice.name.toLowerCase().includes('wavenet')
      ))
    );
  }

  public getHighQualityVoices(): TTSVoice[] {
    const allVoices = this.getAvailableVoices();
    console.log('🔊 TTS: Filtering high-quality voices from', allVoices.length, 'total voices');

    // More inclusive filtering - include more voice types
    const highQuality = allVoices.filter(voice => {
      const name = voice.name.toLowerCase();
      const isHighQuality =
        name.includes('google') ||
        name.includes('neural') ||
        name.includes('wavenet') ||
        name.includes('premium') ||
        name.includes('enhanced') ||
        name.includes('natural') ||
        name.includes('studio') ||
        name.includes('journey') ||
        name.includes('news') ||
        name.includes('polyglot') ||
        (!voice.localService && voice.lang.startsWith('en')) ||
        // Include Microsoft voices that are often high quality
        (name.includes('microsoft') && (
          name.includes('aria') ||
          name.includes('guy') ||
          name.includes('jenny') ||
          name.includes('davis') ||
          name.includes('jane') ||
          name.includes('jason') ||
          name.includes('nancy') ||
          name.includes('tony')
        ));

      if (isHighQuality) {
        console.log('🔊 TTS: High-quality voice found:', voice.name, '(local:', voice.localService, ')');
      }

      return isHighQuality;
    });

    console.log('🔊 TTS: Found', highQuality.length, 'high-quality voices');

    return highQuality.sort((a, b) => {
      // Sort by quality preference
      const getQualityScore = (voice: TTSVoice) => {
        const name = voice.name.toLowerCase();
        if (name.includes('google')) return 100;
        if (name.includes('neural')) return 90;
        if (name.includes('wavenet')) return 85;
        if (name.includes('premium')) return 80;
        if (name.includes('enhanced')) return 75;
        if (name.includes('natural')) return 70;
        if (name.includes('aria') || name.includes('jenny')) return 65;
        if (!voice.localService) return 60;
        if (name.includes('microsoft')) return 55;
        return 50;
      };
      return getQualityScore(b) - getQualityScore(a);
    });
  }

  public getAllVoicesWithQualityInfo(): TTSVoice[] {
    // Return all voices but sorted by quality
    const allVoices = this.getAvailableVoices();
    return allVoices.sort((a, b) => {
      const getQualityScore = (voice: TTSVoice) => {
        const name = voice.name.toLowerCase();
        if (name.includes('google')) return 100;
        if (name.includes('neural')) return 90;
        if (name.includes('wavenet')) return 85;
        if (name.includes('premium')) return 80;
        if (name.includes('enhanced')) return 75;
        if (name.includes('natural')) return 70;
        if (name.includes('aria') || name.includes('jenny')) return 65;
        if (!voice.localService) return 60;
        if (name.includes('microsoft')) return 55;
        return 50;
      };
      return getQualityScore(b) - getQualityScore(a);
    });
  }

  public updateSettings(newSettings: TextToSpeechSettings): void {
    this.settings = { ...newSettings };
  }

  public speak(text: string, options?: Partial<TextToSpeechSettings>): void {
    if (!this.settings.enabled && !options) {
      return;
    }

    // Stop any current speech
    this.stop();

    // Clean text for better speech synthesis
    const cleanText = this.cleanTextForSpeech(text);
    
    if (!cleanText.trim()) {
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Apply settings
    const effectiveSettings = { ...this.settings, ...options };
    
    // Find and set voice
    const selectedVoice = this.voices.find(voice => voice.name === effectiveSettings.voice);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    utterance.rate = Math.max(0.1, Math.min(10, effectiveSettings.rate));
    utterance.pitch = Math.max(0, Math.min(2, effectiveSettings.pitch));
    utterance.volume = Math.max(0, Math.min(1, effectiveSettings.volume));

    // Event handlers
    utterance.onstart = () => {
      console.log('🔊 TTS: Started speaking');
    };

    utterance.onend = () => {
      console.log('🔊 TTS: Finished speaking');
      this.currentUtterance = null;
    };

    utterance.onerror = (event) => {
      console.error('🔊 TTS: Error occurred:', event.error);
      this.currentUtterance = null;
    };

    this.currentUtterance = utterance;
    this.synthesis.speak(utterance);
  }

  public stop(): void {
    if (this.synthesis.speaking) {
      this.synthesis.cancel();
    }
    this.currentUtterance = null;
  }

  public pause(): void {
    if (this.synthesis.speaking && !this.synthesis.paused) {
      this.synthesis.pause();
    }
  }

  public resume(): void {
    if (this.synthesis.paused) {
      this.synthesis.resume();
    }
  }

  public isSpeaking(): boolean {
    return this.synthesis.speaking;
  }

  public isPaused(): boolean {
    return this.synthesis.paused;
  }

  private cleanTextForSpeech(text: string): string {
    return text
      // Remove markdown formatting
      .replace(/\*\*(.*?)\*\*/g, '$1') // Bold
      .replace(/\*(.*?)\*/g, '$1') // Italic
      .replace(/`(.*?)`/g, '$1') // Inline code
      .replace(/```[\s\S]*?```/g, '[Code block]') // Code blocks
      .replace(/#{1,6}\s/g, '') // Headers
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
      // Remove special characters that might cause issues
      .replace(/[^\w\s.,!?;:'"()-]/g, ' ')
      // Clean up whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  public onVoicesChanged(callback: () => void): void {
    this.onVoicesChangedCallback = callback;
  }

  public destroy(): void {
    this.stop();
    this.onVoicesChangedCallback = undefined;
  }
}

// Singleton instance
let ttsServiceInstance: TextToSpeechService | null = null;

const getDefaultTTSSettings = (): TextToSpeechSettings => ({
  enabled: false,
  voice: '',
  rate: 1.0,
  pitch: 1.0,
  volume: 0.8,
  autoPlay: false,
});

export const getTTSService = (settings?: TextToSpeechSettings): TextToSpeechService => {
  const effectiveSettings = settings || getDefaultTTSSettings();

  if (!ttsServiceInstance) {
    ttsServiceInstance = new TextToSpeechService(effectiveSettings);
  } else {
    ttsServiceInstance.updateSettings(effectiveSettings);
  }

  return ttsServiceInstance;
};

export const destroyTTSService = (): void => {
  if (ttsServiceInstance) {
    ttsServiceInstance.destroy();
    ttsServiceInstance = null;
  }
};
