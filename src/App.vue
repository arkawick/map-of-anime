<template>
  <div class="app">
    <div class="loading" v-if="loading">
      <div class="spinner"></div>
      <p>{{ loadingMessage }}</p>
    </div>

    <div class="error" v-if="error">
      <h2>Error</h2>
      <p>{{ error }}</p>
      <p class="hint">Make sure you've run the data collection and processing scripts first.</p>
    </div>

    <canvas ref="canvas" class="map-canvas"></canvas>

    <div class="ui" v-if="!loading && !error">
      <div class="header">
        <h1>Map of Anime</h1>
        <p class="subtitle">{{ nodeCount }} anime visualized by viewer similarity</p>
      </div>

      <div class="search-container">
        <input
          type="text"
          v-model="searchQuery"
          @input="onSearch"
          placeholder="Search anime..."
          class="search-input"
        />
        <div class="search-results" v-if="searchResults.length > 0">
          <div
            v-for="result in searchResults"
            :key="result.id"
            class="search-result"
            @click="focusAnime(result)"
          >
            <div class="result-title">{{ result.t }}</div>
            <div class="result-genres">{{ result.g.join(', ') }}</div>
          </div>
        </div>
      </div>

      <div class="tooltip" v-if="hoveredAnime" :style="tooltipStyle">
        <h3>{{ hoveredAnime.t }}</h3>
        <p v-if="hoveredAnime.et" class="english-title">{{ hoveredAnime.et }}</p>
        <div class="genres">
          <span v-for="genre in hoveredAnime.g" :key="genre" class="genre-tag">
            {{ genre }}
          </span>
        </div>
        <p class="stats">Popularity: {{ hoveredAnime.p?.toLocaleString() }}</p>
      </div>

      <div class="controls">
        <div class="control-item">
          <span class="label">Zoom:</span>
          <span class="value">{{ zoomPercent }}%</span>
        </div>
        <button @click="resetView" class="reset-btn">Reset View</button>
      </div>

      <div class="info">
        <p>Scroll to zoom • Drag to pan • Hover for details</p>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { AnimeMapRenderer } from './lib/renderer.js';

export default {
  name: 'App',
  setup() {
    const canvas = ref(null);
    const loading = ref(true);
    const loadingMessage = ref('Loading data...');
    const error = ref(null);
    const searchQuery = ref('');
    const searchResults = ref([]);
    const hoveredAnime = ref(null);
    const tooltipStyle = ref({});
    const nodeCount = ref(0);
    const zoomPercent = ref(10);

    let renderer = null;
    let animationFrameId = null;

    const loadData = async () => {
      try {
        loadingMessage.value = 'Loading anime map data...';

        const response = await fetch('/data/processed/layout.compact.json');
        if (!response.ok) {
          throw new Error('Failed to load data. Have you run the data collection scripts?');
        }

        const data = await response.json();
        nodeCount.value = data.nodes.length;

        loadingMessage.value = 'Initializing renderer...';
        await new Promise(resolve => setTimeout(resolve, 100));

        return data;
      } catch (err) {
        error.value = err.message;
        throw err;
      }
    };

    const initRenderer = async () => {
      try {
        const data = await loadData();

        renderer = new AnimeMapRenderer(canvas.value, data);

        renderer.onHover = (node) => {
          hoveredAnime.value = node;
        };

        const animate = () => {
          renderer.render();
          animationFrameId = requestAnimationFrame(animate);
        };

        animate();

        loading.value = false;
      } catch (err) {
        console.error('Failed to initialize:', err);
        loading.value = false;
      }
    };

    const handleResize = () => {
      if (canvas.value && renderer) {
        const width = window.innerWidth;
        const height = window.innerHeight;
        renderer.resize(width, height);
      }
    };

    const onSearch = () => {
      if (renderer) {
        const results = renderer.search(searchQuery.value);
        searchResults.value = results;
      }
    };

    const focusAnime = (anime) => {
      if (renderer) {
        renderer.focusNode(anime);
        searchResults.value = [];
        searchQuery.value = '';
      }
    };

    const resetView = () => {
      if (renderer) {
        renderer.camera.x = renderer.data.bounds.width / 2;
        renderer.camera.y = renderer.data.bounds.height / 2;
        renderer.camera.zoom = 0.1;
        zoomPercent.value = 10;
      }
    };

    onMounted(() => {
      canvas.value.width = window.innerWidth;
      canvas.value.height = window.innerHeight;

      window.addEventListener('resize', handleResize);
      initRenderer();

      // Update zoom display
      const updateZoom = () => {
        if (renderer) {
          zoomPercent.value = Math.round(renderer.camera.zoom * 100);
        }
        requestAnimationFrame(updateZoom);
      };
      updateZoom();
    });

    onUnmounted(() => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (renderer) {
        renderer.destroy();
      }
    });

    return {
      canvas,
      loading,
      loadingMessage,
      error,
      searchQuery,
      searchResults,
      hoveredAnime,
      tooltipStyle,
      nodeCount,
      zoomPercent,
      onSearch,
      focusAnime,
      resetView
    };
  }
};
</script>

<style scoped>
.app {
  width: 100vw;
  height: 100vh;
  position: relative;
  overflow: hidden;
}

.map-canvas {
  display: block;
  width: 100%;
  height: 100%;
}

.loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: #fff;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #ff4444;
  color: white;
  padding: 30px;
  border-radius: 10px;
  max-width: 500px;
}

.error .hint {
  margin-top: 15px;
  opacity: 0.8;
  font-size: 14px;
}

.ui {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
}

.ui > * {
  pointer-events: auto;
}

.header {
  position: absolute;
  top: 20px;
  left: 20px;
  color: white;
}

.header h1 {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 5px;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
}

.subtitle {
  font-size: 14px;
  opacity: 0.7;
  text-shadow: 0 1px 5px rgba(0, 0, 0, 0.5);
}

.search-container {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 300px;
}

.search-input {
  width: 100%;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: white;
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
}

.search-input:focus {
  border-color: rgba(255, 255, 255, 0.4);
  background: rgba(0, 0, 0, 0.9);
}

.search-results {
  margin-top: 10px;
  background: rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.search-result {
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  transition: background 0.2s;
}

.search-result:hover {
  background: rgba(255, 255, 255, 0.1);
}

.search-result:last-child {
  border-bottom: none;
}

.result-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.result-genres {
  font-size: 12px;
  opacity: 0.6;
}

.tooltip {
  position: fixed;
  background: rgba(0, 0, 0, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.3);
  border-radius: 8px;
  padding: 15px;
  max-width: 300px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
  z-index: 1000;
}

.tooltip h3 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
}

.english-title {
  font-size: 13px;
  opacity: 0.7;
  margin: 0 0 10px 0;
}

.genres {
  margin: 10px 0;
}

.genre-tag {
  display: inline-block;
  background: rgba(255, 255, 255, 0.1);
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  margin-right: 5px;
  margin-bottom: 5px;
}

.stats {
  margin: 10px 0 0 0;
  font-size: 12px;
  opacity: 0.7;
}

.controls {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: rgba(0, 0, 0, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  padding: 15px;
  color: white;
}

.control-item {
  margin-bottom: 10px;
  font-size: 14px;
}

.label {
  opacity: 0.7;
  margin-right: 10px;
}

.value {
  font-weight: 600;
}

.reset-btn {
  width: 100%;
  padding: 8px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.reset-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.info {
  position: absolute;
  bottom: 20px;
  left: 20px;
  color: white;
  opacity: 0.5;
  font-size: 12px;
}
</style>
