export class MemoryMonitor {
    constructor(renderer, scene) {
        this.renderer = renderer;
        this.scene = scene;
        this.checkInterval = 300; // frames between checks
        this.frameCount = 0;
        this.lastCheckTime = 0;
        
        // Statistics
        this.stats = {
            maxVRAMUsage: 0,
            maxHeapUsage: 0,
            leakDetections: 0
        };
    }

    checkVRAMUsage() {
        if (!this.renderer || !this.renderer.getContext) return null;
        
        const gl = this.renderer.getContext();
        let vramInfo = null;
        
        // Try to get WebGL memory info
        try {
            const memoryInfo = gl.getExtension('WEBGL_memory_info');
            if (memoryInfo) {
                vramInfo = {
                    total: memoryInfo.total_gpu_memory,
                    used: memoryInfo.current_available_gpu_memory ? 
                          memoryInfo.total_gpu_memory - memoryInfo.current_available_gpu_memory : null
                };
                
                if (vramInfo.used) {
                    this.stats.maxVRAMUsage = Math.max(this.stats.maxVRAMUsage, vramInfo.used);
                }
            }
        } catch (e) {
            console.warn('Could not access VRAM info:', e);
        }
        
        return vramInfo;
    }

    debugMemoryUsage() {
        console.group('🚀 MEMORY DEBUG INFO');
        
        // Three.js memory stats
        if (this.renderer) {
            const threeInfo = {
                geometries: this.renderer.info.memory.geometries,
                textures: this.renderer.info.memory.textures,
                programs: this.renderer.info.programs?.length || 'N/A'
            };
            
            console.log('📊 Three.js Memory:', threeInfo);
            
            const renderInfo = {
                calls: this.renderer.info.render.calls,
                triangles: this.renderer.info.render.triangles,
                lines: this.renderer.info.render.lines,
                points: this.renderer.info.render.points
            };
            
            console.log('🎯 Three.js Render:', renderInfo);
        }
        
        // JavaScript heap
        if (performance.memory) {
            const used = performance.memory.usedJSHeapSize / 1048576;
            const total = performance.memory.totalJSHeapSize / 1048576;
            const percentage = ((used / total) * 100);
            
            this.stats.maxHeapUsage = Math.max(this.stats.maxHeapUsage, used);
            
            console.log('💾 JavaScript Heap:', {
                used: `${used.toFixed(2)} MB`,
                total: `${total.toFixed(2)} MB`,
                percentage: `${percentage.toFixed(1)}%`
            });

            // Warning for high memory usage
            if (used > 500) {
                console.warn('🚨 HIGH MEMORY USAGE DETECTED');
                this.stats.leakDetections++;
            }
        }
        
        // Track scene objects
        if (this.scene) {
            const objectCounts = {
                meshes: 0,
                lights: 0,
                groups: 0,
                cameras: 0,
                total: this.scene.children.length
            };
            
            this.scene.traverse(child => {
                if (child.isMesh) objectCounts.meshes++;
                if (child.isLight) objectCounts.lights++;
                if (child.isGroup) objectCounts.groups++;
                if (child.isCamera) objectCounts.cameras++;
            });
            
            console.log('🔄 Scene Objects:', objectCounts);
        }
        
        // VRAM info
        const vramInfo = this.checkVRAMUsage();
        if (vramInfo) {
            console.log('🎮 VRAM Usage:', vramInfo);
        }
        
        console.log('📈 Memory Statistics:', this.stats);
        console.groupEnd();
        
        return this.stats;
    }

    checkForLeaks(previousCounts = {}) {
        if (!this.renderer || !this.scene) return null;
        
        const currentCounts = {
            geometries: this.renderer.info.memory.geometries,
            textures: this.renderer.info.memory.textures,
            sceneObjects: this.scene.children.length,
            meshes: 0
        };
        
        this.scene.traverse(child => {
            if (child.isMesh) currentCounts.meshes++;
        });
        
        // Detect significant increases
        if (previousCounts.geometries && currentCounts.geometries > previousCounts.geometries + 10) {
            console.warn(`🔴 Possible geometry leak: ${previousCounts.geometries} → ${currentCounts.geometries}`);
        }
        
        if (previousCounts.textures && currentCounts.textures > previousCounts.textures + 5) {
            console.warn(`🔴 Possible texture leak: ${previousCounts.textures} → ${currentCounts.textures}`);
        }
        
        return currentCounts;
    }

    forceCleanup() {
        if (!this.renderer || !this.scene) return;
        
        console.log('🧹 Starting forced cleanup...');
        
        let disposedCount = {
            geometries: 0,
            materials: 0,
            textures: 0
        };
        
        // Clean up scene objects
        this.scene.traverse(object => {
            if (object.geometry) {
                object.geometry.dispose();
                disposedCount.geometries++;
            }
            
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => {
                        material.dispose();
                        if (material.map) {
                            material.map.dispose();
                            disposedCount.textures++;
                        }
                    });
                    disposedCount.materials += object.material.length;
                } else {
                    object.material.dispose();
                    disposedCount.materials++;
                    if (object.material.map) {
                        object.material.map.dispose();
                        disposedCount.textures++;
                    }
                }
            }
        });
        
        // Force renderer cleanup
        this.renderer.dispose();
        
        // Force garbage collection if available
        if (window.gc) {
            window.gc();
            console.log('🔄 Forced garbage collection');
        }
        
        console.log('✅ Cleanup completed:', disposedCount);
        return disposedCount;
    }

    update() {
        this.frameCount++;
        
        // Only check every N frames for performance
        if (this.frameCount % this.checkInterval === 0) {
            this.debugMemoryUsage();
            this.lastCheckTime = performance.now();
        }
    }

    getStats() {
        return {
            ...this.stats,
            frameCount: this.frameCount,
            currentTime: performance.now()
        };
    }

    dispose() {
        this.renderer = null;
        this.scene = null;
        console.log('MemoryMonitor disposed');
    }
}

// Utility function for global memory check
export function globalMemoryCheck() {
    if (performance.memory) {
        const used = performance.memory.usedJSHeapSize / 1048576;
        const total = performance.memory.totalJSHeapSize / 1048576;
        return {
            usedMB: used,
            totalMB: total,
            percentage: (used / total) * 100
        };
    }
    return null;
}

// Quick memory status for HUD
export function getMemoryStatus() {
    const memory = globalMemoryCheck();
    if (!memory) return 'Memory API not available';
    
    const status = memory.usedMB > 500 ? '🚨 HIGH' : memory.usedMB > 300 ? '⚠️ MED' : '✅ OK';
    return `${status} (${memory.usedMB.toFixed(1)}MB)`;
}