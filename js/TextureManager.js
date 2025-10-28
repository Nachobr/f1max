// --- START OF FILE js/TextureManager.js ---

import * as THREE from 'three';

export class TextureManager {
    constructor(renderer) {
        this.renderer = renderer;
        this.textures = new Map();
        this.loader = new THREE.TextureLoader();
        this.stats = {
            totalLoaded: 0,
            memoryEstimate: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
    }
    
    loadTexture(url, options = {}) {
        // Return cached texture if available
        if (this.textures.has(url)) {
            this.stats.cacheHits++;
            return this.textures.get(url);
        }
        
        this.stats.cacheMisses++;
        
        const texture = this.loader.load(
            url,
            (tex) => {
                // Optimize texture settings
                this.optimizeTexture(tex, options);
                this.calculateTextureMemory(tex);
            },
            undefined,
            (error) => {
                console.error('❌ Failed to load texture:', url, error);
            }
        );
        
        this.textures.set(url, texture);
        this.stats.totalLoaded = this.textures.size;
        
        return texture;
    }
    
    optimizeTexture(texture, options) {
        texture.generateMipmaps = options.generateMipmaps !== false;
        texture.minFilter = options.minFilter || THREE.LinearMipmapLinearFilter;
        texture.magFilter = options.magFilter || THREE.LinearFilter;
        texture.anisotropy = this.renderer ? 
            Math.min(options.anisotropy || 4, this.renderer.capabilities.getMaxAnisotropy()) : 1;
        
        if (options.wrapS) texture.wrapS = options.wrapS;
        if (options.wrapT) texture.wrapT = options.wrapT;
    }
    
    calculateTextureMemory(texture) {
        if (texture.image) {
            const bytes = texture.image.width * texture.image.height * 4; // RGBA
            this.stats.memoryEstimate += bytes / 1048576; // MB
        }
    }
    
    getTextureStats() {
        return {
            ...this.stats,
            memoryEstimateMB: this.stats.memoryEstimate.toFixed(2)
        };
    }
    
    disposeTexture(url) {
        if (this.textures.has(url)) {
            const texture = this.textures.get(url);
            texture.dispose();
            this.textures.delete(url);
            this.stats.totalLoaded = this.textures.size;
            return true;
        }
        return false;
    }
    
    disposeAll() {
        this.textures.forEach(texture => texture.dispose());
        this.textures.clear();
        this.stats.totalLoaded = 0;
        this.stats.memoryEstimate = 0;
        console.log('🧹 All textures disposed');
    }
}