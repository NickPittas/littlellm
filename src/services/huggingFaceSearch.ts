// Hugging Face model search service

export interface HuggingFaceModel {
  id: string;
  name: string;
  description: string;
  downloads: number;
  likes: number;
  tags: string[];
  library_name?: string;
  pipeline_tag?: string;
  quantizations: string[];
  size?: Record<string, string>;
}

export interface SearchFilters {
  library?: string;
  pipeline_tag?: string;
  tags?: string[];
  sort?: 'downloads' | 'likes' | 'trending' | 'updated';
  limit?: number;
}

class HuggingFaceSearchService {
  private baseURL = 'https://huggingface.co/api';
  private defaultQuantizations = ['Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0', 'F16'];

  async searchModels(query: string, filters: SearchFilters = {}): Promise<HuggingFaceModel[]> {
    try {
      console.log(`🔍 Searching Hugging Face for: ${query}`);

      // Build search parameters for better GGUF model discovery
      const params = new URLSearchParams();
      params.append('search', `${query} gguf`); // Include 'gguf' in search term
      params.append('filter', 'gguf'); // Focus on GGUF models
      params.append('sort', filters.sort || 'downloads'); // Default to most downloaded
      params.append('full', 'true'); // Get full model information

      if (filters.library) params.append('library', filters.library);
      if (filters.pipeline_tag) params.append('pipeline_tag', filters.pipeline_tag);
      params.append('limit', String(filters.limit || 50)); // Increase limit for better results

      const response = await fetch(`${this.baseURL}/models?${params.toString()}`);

      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      // Filter and transform results to focus on GGUF models
      const ggufModels = await Promise.all(
        data
          .filter((model: any) => this.isGGUFModel(model))
          .slice(0, filters.limit || 20) // Limit before processing for performance
          .map(async (model: any) => {
            const transformedModel = this.transformModel(model);

            // Get detailed file information including quantizations and sizes
            try {
              const files = await this.getModelFiles(model.id);
              transformedModel.quantizations = this.extractQuantizations(files);
              transformedModel.size = this.calculateModelSizes(files);
            } catch (fileError) {
              console.warn(`⚠️ Failed to get files for ${model.id}:`, fileError);
              // Use default quantizations if file fetch fails
              transformedModel.quantizations = this.defaultQuantizations;
            }

            return transformedModel;
          })
      );

      console.log(`✅ Found ${ggufModels.length} GGUF models with detailed information`);
      return ggufModels;

    } catch (error) {
      console.error('❌ Hugging Face search failed:', error);

      // Return empty array instead of mock results to avoid 404 errors
      console.log('🔍 Returning empty results - please check your internet connection or try again later');
      return [];
    }
  }

  async getModelDetails(modelId: string): Promise<HuggingFaceModel | null> {
    try {
      console.log(`📋 Getting details for model: ${modelId}`);
      
      const response = await fetch(`${this.baseURL}/models/${modelId}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(`Model not found: ${modelId}`);
          return null;
        }
        throw new Error(`Failed to get model details: ${response.status}`);
      }

      const model = await response.json();
      return this.transformModel(model);

    } catch (error) {
      console.error(`❌ Failed to get model details for ${modelId}:`, error);
      return null;
    }
  }

  async getModelFiles(modelId: string): Promise<Array<{
    filename: string;
    size: number;
    quantization?: string;
  }>> {
    try {
      console.log(`📁 Getting files for model: ${modelId}`);

      // Try models API first, then datasets API as fallback
      let response = await fetch(`${this.baseURL}/models/${modelId}/tree/main`);

      if (!response.ok && response.status === 404) {
        // Fallback to datasets API for GGUF repositories
        response = await fetch(`${this.baseURL}/datasets/${modelId}/tree/main`);
      }

      if (!response.ok) {
        throw new Error(`Failed to get model files: ${response.status}`);
      }

      const files = await response.json();
      
      // Filter for GGUF files and extract quantization info
      return files
        .filter((file: any) => file.path.endsWith('.gguf'))
        .map((file: any) => ({
          filename: file.path,
          size: file.size || 0,
          quantization: this.extractQuantizationFromFilename(file.path)
        }));

    } catch (error) {
      console.error(`❌ Failed to get model files for ${modelId}:`, error);
      return [];
    }
  }

  private isGGUFModel(model: any): boolean {
    const modelId = model.id?.toLowerCase() || '';
    const tags = model.tags || [];
    
    // Check if model ID contains GGUF
    if (modelId.includes('gguf')) return true;
    
    // Check tags for GGUF-related terms
    const ggufTags = ['gguf', 'quantized', 'llama.cpp'];
    if (tags.some((tag: string) => ggufTags.includes(tag.toLowerCase()))) return true;
    
    // Check if it has GGUF files (would need additional API call)
    return false;
  }

  private transformModel(model: any): HuggingFaceModel {
    const modelId = model.id || '';
    const name = model.id?.split('/').pop() || modelId;
    
    return {
      id: modelId,
      name: this.formatModelName(name),
      description: model.description || `GGUF model: ${name}`,
      downloads: model.downloads || 0,
      likes: model.likes || 0,
      tags: model.tags || [],
      library_name: model.library_name,
      pipeline_tag: model.pipeline_tag,
      quantizations: this.getAvailableQuantizations(model),
      size: this.estimateModelSizes(model)
    };
  }

  private formatModelName(name: string): string {
    return name
      .replace(/-/g, ' ')
      .replace(/gguf/gi, 'GGUF')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  private async getModelFiles(modelId: string): Promise<Array<{ filename: string; size: number; quantization?: string }>> {
    try {
      // Try models API first, then datasets API as fallback
      let response = await fetch(`${this.baseURL}/models/${modelId}/tree/main`);

      if (!response.ok && response.status === 404) {
        // Fallback to datasets API for GGUF repositories
        response = await fetch(`${this.baseURL}/datasets/${modelId}/tree/main`);
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch files: ${response.status}`);
      }

      const data = await response.json();

      // Extract .gguf files with their sizes and quantizations
      const ggufFiles = data
        .filter((file: any) => file.type === 'file' && file.path.endsWith('.gguf'))
        .map((file: any) => ({
          filename: file.path,
          size: file.size || 0,
          quantization: this.extractQuantizationFromFilename(file.path)
        }))
        .filter((file: any) => file.quantization); // Only include files with recognized quantizations

      return ggufFiles;
    } catch (error) {
      console.warn(`⚠️ Failed to fetch files for ${modelId}:`, error);
      return [];
    }
  }

  private getAvailableQuantizations(model: any): string[] {
    // In a real implementation, this would check the actual files
    // For now, return common quantizations
    return this.defaultQuantizations;
  }

  private estimateModelSizes(model: any): Record<string, string> {
    // Estimate sizes based on model name/parameters
    const name = model.id?.toLowerCase() || '';
    
    let baseSize = 2.5; // Default 2.5GB for unknown models
    
    if (name.includes('0.5b') || name.includes('500m')) baseSize = 0.5;
    else if (name.includes('1b')) baseSize = 1.0;
    else if (name.includes('3b')) baseSize = 2.0;
    else if (name.includes('7b')) baseSize = 4.0;
    else if (name.includes('13b')) baseSize = 7.0;
    else if (name.includes('20b')) baseSize = 12.0;
    else if (name.includes('30b')) baseSize = 18.0;
    else if (name.includes('70b')) baseSize = 40.0;

    return {
      'Q4_K_M': `${(baseSize * 0.6).toFixed(1)}GB`,
      'Q5_K_M': `${(baseSize * 0.7).toFixed(1)}GB`,
      'Q6_K': `${(baseSize * 0.8).toFixed(1)}GB`,
      'Q8_0': `${(baseSize * 0.9).toFixed(1)}GB`,
      'F16': `${baseSize.toFixed(1)}GB`
    };
  }

  private extractQuantizationFromFilename(filename: string): string | undefined {
    const quantizations = ['Q2_K', 'Q3_K_S', 'Q3_K_M', 'Q3_K_L', 'Q4_0', 'Q4_1', 'Q4_K_S', 'Q4_K_M', 'Q5_0', 'Q5_1', 'Q5_K_S', 'Q5_K_M', 'Q6_K', 'Q8_0', 'F16', 'F32'];

    const upperFilename = filename.toUpperCase();
    for (const quant of quantizations) {
      if (upperFilename.includes(quant)) {
        return quant;
      }
    }

    return undefined;
  }

  private extractQuantizations(files: Array<{ filename: string; size: number; quantization?: string }>): string[] {
    const quantizations = new Set<string>();

    files.forEach(file => {
      if (file.quantization) {
        quantizations.add(file.quantization);
      }
    });

    // Return sorted quantizations, or default if none found
    const result = Array.from(quantizations).sort();
    return result.length > 0 ? result : this.defaultQuantizations;
  }

  private calculateModelSizes(files: Array<{ filename: string; size: number; quantization?: string }>): Record<string, string> {
    const sizes: Record<string, string> = {};

    files.forEach(file => {
      if (file.quantization && file.size > 0) {
        sizes[file.quantization] = this.formatFileSize(file.size);
      }
    });

    return sizes;
  }

  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  private getMockSearchResults(query: string): HuggingFaceModel[] {
    // Fallback mock results when API is unavailable
    const baseModels = [
      {
        id: `${query}/GGUF`,
        name: `${query} GGUF`,
        description: `GGUF quantized version of ${query}`,
        downloads: Math.floor(Math.random() * 10000),
        likes: Math.floor(Math.random() * 1000),
        tags: ['gguf', 'quantized'],
        quantizations: this.defaultQuantizations,
        size: this.estimateModelSizes({ id: query })
      },
      {
        id: `${query}-instruct/GGUF`,
        name: `${query} Instruct GGUF`,
        description: `Instruction-tuned GGUF version of ${query}`,
        downloads: Math.floor(Math.random() * 5000),
        likes: Math.floor(Math.random() * 500),
        tags: ['gguf', 'instruct', 'quantized'],
        quantizations: this.defaultQuantizations,
        size: this.estimateModelSizes({ id: query })
      }
    ];

    // Add some popular models if query matches
    if (query.toLowerCase().includes('llama')) {
      baseModels.push({
        id: 'bartowski/Llama-3.2-3B-Instruct-GGUF',
        name: 'Llama 3.2 3B Instruct GGUF',
        description: 'Meta Llama 3.2 3B Instruct model in GGUF format',
        downloads: 75000,
        likes: 2500,
        tags: ['llama', 'gguf', 'instruct'],
        quantizations: this.defaultQuantizations,
        size: this.estimateModelSizes({ id: 'llama-3b' })
      });
    }

    if (query.toLowerCase().includes('phi')) {
      baseModels.push({
        id: 'bartowski/Phi-3-mini-4k-instruct-GGUF',
        name: 'Phi-3 Mini 4K Instruct GGUF',
        description: 'Microsoft Phi-3 Mini model optimized for instruction following',
        downloads: 50000,
        likes: 1800,
        tags: ['phi', 'gguf', 'microsoft'],
        quantizations: this.defaultQuantizations,
        size: this.estimateModelSizes({ id: 'phi-3b' })
      });
    }

    return baseModels.slice(0, 5);
  }

  // Utility method to validate model ID format
  isValidModelId(modelId: string): boolean {
    // Basic validation for Hugging Face model IDs
    const pattern = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;
    return pattern.test(modelId);
  }

  // Get popular GGUF models
  async getPopularGGUFModels(): Promise<HuggingFaceModel[]> {
    return this.searchModels('gguf', {
      sort: 'downloads',
      limit: 10
    });
  }

  // Get trending GGUF models
  async getTrendingGGUFModels(): Promise<HuggingFaceModel[]> {
    return this.searchModels('gguf', {
      sort: 'trending',
      limit: 10
    });
  }
}

export const huggingFaceSearchService = new HuggingFaceSearchService();
