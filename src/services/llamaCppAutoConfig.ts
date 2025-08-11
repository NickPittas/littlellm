// Auto-configuration service for Llama.cpp models based on system capabilities

export interface SystemCapabilities {
  totalRAM: number; // in GB
  availableRAM: number; // in GB
  cpuCores: number;
  hasGPU: boolean;
  gpuVRAM?: number; // in GB
  gpuName?: string;
  platform: 'windows' | 'mac' | 'linux' | 'unknown';
  architecture: 'x64' | 'arm64' | 'unknown';
}

export interface ModelRequirements {
  minRAM: number; // in GB
  recommendedRAM: number; // in GB
  parameters: string; // e.g., "3.8B", "7B", "13B"
  quantization: string;
  estimatedSize: number; // in GB
}

export interface OptimalConfiguration {
  contextSize: number;
  threads: number;
  gpuLayers: number;
  batchSize: number;
  temperature: number;
  topK: number;
  topP: number;
  repeatPenalty: number;
  reasoning: string[];
  warnings: string[];
  performance: 'high' | 'medium' | 'low';
}

class LlamaCppAutoConfig {
  private systemCapabilities: SystemCapabilities | null = null;

  // Model requirements database
  private modelRequirements: Record<string, ModelRequirements> = {
    'qwen2.5-0.5b': {
      minRAM: 1,
      recommendedRAM: 2,
      parameters: '0.5B',
      quantization: 'Q4_K_M',
      estimatedSize: 0.35
    },
    'llama-3.2-1b': {
      minRAM: 2,
      recommendedRAM: 3,
      parameters: '1B',
      quantization: 'Q4_K_M',
      estimatedSize: 0.7
    },
    'phi-3-mini': {
      minRAM: 3,
      recommendedRAM: 4,
      parameters: '3.8B',
      quantization: 'Q4_K_M',
      estimatedSize: 2.3
    },
    'llama-3.2-3b': {
      minRAM: 4,
      recommendedRAM: 6,
      parameters: '3B',
      quantization: 'Q4_K_M',
      estimatedSize: 1.9
    },
    'llama-3.1-7b': {
      minRAM: 8,
      recommendedRAM: 12,
      parameters: '7B',
      quantization: 'Q4_K_M',
      estimatedSize: 4.1
    },
    'llama-3.1-13b': {
      minRAM: 16,
      recommendedRAM: 24,
      parameters: '13B',
      quantization: 'Q4_K_M',
      estimatedSize: 7.3
    }
  };

  async detectSystemCapabilities(): Promise<SystemCapabilities> {
    if (this.systemCapabilities) {
      return this.systemCapabilities;
    }

    try {
      // Try to get system info from Electron if available
      if (typeof window !== 'undefined' && window.electronAPI) {
        const systemInfo = await this.getElectronSystemInfo();
        if (systemInfo) {
          this.systemCapabilities = systemInfo;
          return systemInfo;
        }
      }

      // Fallback to browser-based detection
      const capabilities = await this.getBrowserSystemInfo();
      this.systemCapabilities = capabilities;
      return capabilities;
    } catch (error) {
      console.warn('Failed to detect system capabilities:', error);
      return this.getDefaultCapabilities();
    }
  }

  private async getElectronSystemInfo(): Promise<SystemCapabilities | null> {
    try {
      console.log('🔍 Detecting system capabilities via Electron...');

      if (window.electronAPI?.llamaCppGetSystemCapabilities) {
        const systemInfo = await window.electronAPI.llamaCppGetSystemCapabilities();

        return {
          totalRAM: systemInfo.totalRAM,
          availableRAM: systemInfo.availableRAM,
          cpuCores: systemInfo.cpuCores,
          hasGPU: systemInfo.hasGPU,
          gpuVRAM: systemInfo.gpuVRAM,
          gpuName: systemInfo.gpuName,
          platform: systemInfo.platform as SystemCapabilities['platform'],
          architecture: systemInfo.architecture as SystemCapabilities['architecture']
        };
      }

      return null;
    } catch (error) {
      console.warn('Electron system detection failed:', error);
      return null;
    }
  }

  private async getBrowserSystemInfo(): Promise<SystemCapabilities> {
    console.log('🔍 Detecting system capabilities via browser...');
    
    // Browser-based detection (limited)
    const capabilities: SystemCapabilities = {
      totalRAM: this.estimateRAMFromBrowser(),
      availableRAM: this.estimateRAMFromBrowser() * 0.7, // Assume 70% available
      cpuCores: navigator.hardwareConcurrency || 4,
      hasGPU: await this.detectGPUSupport(),
      platform: this.detectPlatform(),
      architecture: this.detectArchitecture()
    };

    if (capabilities.hasGPU) {
      capabilities.gpuVRAM = await this.estimateGPUMemory();
      capabilities.gpuName = await this.detectGPUName();
    }

    return capabilities;
  }

  private getDefaultCapabilities(): SystemCapabilities {
    return {
      totalRAM: 8,
      availableRAM: 6,
      cpuCores: 4,
      hasGPU: false,
      platform: 'unknown',
      architecture: 'unknown'
    };
  }

  private estimateRAMFromBrowser(): number {
    // Use device memory API if available
    if ('deviceMemory' in navigator) {
      return (navigator as any).deviceMemory;
    }
    
    // Fallback estimation based on user agent and other factors
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('mobile') || userAgent.includes('android')) {
      return 4; // Mobile devices typically have less RAM
    }
    
    if (userAgent.includes('ipad') || userAgent.includes('tablet')) {
      return 6; // Tablets typically have moderate RAM
    }
    
    // Desktop fallback
    return 8;
  }

  private async detectGPUSupport(): Promise<boolean> {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      
      if (!gl) return false;
      
      // Check for WebGL extensions that indicate decent GPU
      const extensions = gl.getSupportedExtensions() || [];
      const hasGoodExtensions = extensions.some(ext => 
        ext.includes('texture_float') || 
        ext.includes('vertex_array_object') ||
        ext.includes('instanced_arrays')
      );
      
      return hasGoodExtensions;
    } catch (error) {
      return false;
    }
  }

  private async estimateGPUMemory(): Promise<number> {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      
      if (!gl) return 2; // Default fallback
      
      // Try to estimate VRAM based on max texture size
      const maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
      
      if (maxTextureSize >= 16384) return 8; // High-end GPU
      if (maxTextureSize >= 8192) return 4;  // Mid-range GPU
      if (maxTextureSize >= 4096) return 2;  // Low-end GPU
      
      return 1; // Very basic GPU
    } catch (error) {
      return 2; // Default fallback
    }
  }

  private async detectGPUName(): Promise<string> {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      
      if (!gl) return 'Unknown GPU';
      
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
        return renderer || 'Unknown GPU';
      }
      
      return 'WebGL GPU';
    } catch (error) {
      return 'Unknown GPU';
    }
  }

  private detectPlatform(): SystemCapabilities['platform'] {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('win')) return 'windows';
    if (userAgent.includes('mac')) return 'mac';
    if (userAgent.includes('linux')) return 'linux';
    
    return 'unknown';
  }

  private detectArchitecture(): SystemCapabilities['architecture'] {
    const userAgent = navigator.userAgent.toLowerCase();
    
    if (userAgent.includes('arm64') || userAgent.includes('aarch64')) {
      return 'arm64';
    }
    
    if (userAgent.includes('x86_64') || userAgent.includes('amd64') || userAgent.includes('wow64')) {
      return 'x64';
    }
    
    return 'unknown';
  }

  generateOptimalConfiguration(
    modelId: string, 
    capabilities: SystemCapabilities,
    priority: 'performance' | 'quality' | 'balanced' = 'balanced'
  ): OptimalConfiguration {
    const modelReqs = this.getModelRequirements(modelId);
    const reasoning: string[] = [];
    const warnings: string[] = [];

    // Check if system can handle the model
    if (capabilities.availableRAM < modelReqs.minRAM) {
      warnings.push(`Insufficient RAM: ${capabilities.availableRAM}GB available, ${modelReqs.minRAM}GB required`);
    }

    // Determine context size
    let contextSize = 4096; // Default
    if (capabilities.availableRAM >= 16) {
      contextSize = 8192;
      reasoning.push('Large context size (8192) due to abundant RAM');
    } else if (capabilities.availableRAM >= 8) {
      contextSize = 4096;
      reasoning.push('Standard context size (4096) for moderate RAM');
    } else {
      contextSize = 2048;
      reasoning.push('Reduced context size (2048) due to limited RAM');
      warnings.push('Context size reduced due to RAM constraints');
    }

    // Determine thread count
    let threads = Math.min(capabilities.cpuCores, 8);
    if (capabilities.hasGPU && capabilities.gpuVRAM && capabilities.gpuVRAM >= 4) {
      threads = Math.max(2, Math.floor(capabilities.cpuCores / 2));
      reasoning.push(`Reduced CPU threads (${threads}) to balance with GPU processing`);
    } else {
      reasoning.push(`Using ${threads} CPU threads based on available cores`);
    }

    // Determine GPU layers
    let gpuLayers = 0;
    if (capabilities.hasGPU && capabilities.gpuVRAM) {
      if (capabilities.gpuVRAM >= 8) {
        gpuLayers = 35;
        reasoning.push('High GPU layer count (35) due to abundant VRAM');
      } else if (capabilities.gpuVRAM >= 4) {
        gpuLayers = 20;
        reasoning.push('Moderate GPU layer count (20) for available VRAM');
      } else if (capabilities.gpuVRAM >= 2) {
        gpuLayers = 10;
        reasoning.push('Conservative GPU layer count (10) due to limited VRAM');
      }
    } else {
      reasoning.push('CPU-only processing (no GPU detected or insufficient VRAM)');
    }

    // Determine batch size
    let batchSize = 512; // Default
    if (priority === 'performance' && capabilities.availableRAM >= 12) {
      batchSize = 1024;
      reasoning.push('Large batch size (1024) for maximum performance');
    } else if (capabilities.availableRAM < 6) {
      batchSize = 256;
      reasoning.push('Reduced batch size (256) due to RAM constraints');
    }

    // Determine performance level
    let performance: OptimalConfiguration['performance'] = 'medium';
    if (capabilities.hasGPU && capabilities.gpuVRAM && capabilities.gpuVRAM >= 6 && capabilities.availableRAM >= 12) {
      performance = 'high';
    } else if (capabilities.availableRAM < 6 || !capabilities.hasGPU) {
      performance = 'low';
    }

    // Quality-focused parameters
    const temperature = priority === 'quality' ? 0.7 : 0.8;
    const topK = priority === 'quality' ? 40 : 50;
    const topP = priority === 'quality' ? 0.9 : 0.95;
    const repeatPenalty = 1.1;

    return {
      contextSize,
      threads,
      gpuLayers,
      batchSize,
      temperature,
      topK,
      topP,
      repeatPenalty,
      reasoning,
      warnings,
      performance
    };
  }

  private getModelRequirements(modelId: string): ModelRequirements {
    // Try to match model ID to known requirements
    const normalizedId = modelId.toLowerCase();
    
    for (const [key, requirements] of Object.entries(this.modelRequirements)) {
      if (normalizedId.includes(key) || normalizedId.includes(key.replace('-', ''))) {
        return requirements;
      }
    }

    // Default requirements for unknown models
    return {
      minRAM: 4,
      recommendedRAM: 6,
      parameters: 'Unknown',
      quantization: 'Q4_K_M',
      estimatedSize: 2
    };
  }

  getRecommendedModels(capabilities: SystemCapabilities): Array<{
    modelId: string;
    name: string;
    suitability: 'excellent' | 'good' | 'marginal' | 'unsuitable';
    reasoning: string;
  }> {
    const recommendations = [];

    for (const [modelId, requirements] of Object.entries(this.modelRequirements)) {
      let suitability: 'excellent' | 'good' | 'marginal' | 'unsuitable';
      let reasoning: string;

      if (capabilities.availableRAM >= requirements.recommendedRAM) {
        suitability = 'excellent';
        reasoning = `Excellent fit: ${capabilities.availableRAM}GB RAM available, ${requirements.recommendedRAM}GB recommended`;
      } else if (capabilities.availableRAM >= requirements.minRAM) {
        suitability = 'good';
        reasoning = `Good fit: ${capabilities.availableRAM}GB RAM available, ${requirements.minRAM}GB minimum`;
      } else if (capabilities.availableRAM >= requirements.minRAM * 0.8) {
        suitability = 'marginal';
        reasoning = `Marginal: ${capabilities.availableRAM}GB RAM available, ${requirements.minRAM}GB minimum (may be slow)`;
      } else {
        suitability = 'unsuitable';
        reasoning = `Unsuitable: ${capabilities.availableRAM}GB RAM available, ${requirements.minRAM}GB minimum required`;
      }

      recommendations.push({
        modelId,
        name: this.getModelDisplayName(modelId),
        suitability,
        reasoning
      });
    }

    // Sort by suitability
    const suitabilityOrder = { excellent: 0, good: 1, marginal: 2, unsuitable: 3 };
    recommendations.sort((a, b) => suitabilityOrder[a.suitability] - suitabilityOrder[b.suitability]);

    return recommendations;
  }

  private getModelDisplayName(modelId: string): string {
    const displayNames: Record<string, string> = {
      'qwen2.5-0.5b': 'Qwen2.5 0.5B Instruct',
      'llama-3.2-1b': 'Llama 3.2 1B Instruct',
      'phi-3-mini': 'Phi-3 Mini 4K Instruct',
      'llama-3.2-3b': 'Llama 3.2 3B Instruct',
      'llama-3.1-7b': 'Llama 3.1 7B Instruct',
      'llama-3.1-13b': 'Llama 3.1 13B Instruct'
    };

    return displayNames[modelId] || modelId;
  }
}

export const llamaCppAutoConfig = new LlamaCppAutoConfig();
