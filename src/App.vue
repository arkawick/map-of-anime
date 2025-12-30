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
        <img v-if="hoveredAnime.img" :src="hoveredAnime.img" class="tooltip-cover" :alt="hoveredAnime.t" />
        <div class="tooltip-content">
          <h3>{{ hoveredAnime.t }}</h3>
          <p v-if="hoveredAnime.et" class="english-title">{{ hoveredAnime.et }}</p>
          <div class="genres">
            <span v-for="genre in hoveredAnime.g" :key="genre" class="genre-tag">
              {{ genre }}
            </span>
          </div>
          <p class="stats">Popularity: {{ hoveredAnime.p?.toLocaleString() }}</p>
        </div>
      </div>

      <div class="detail-panel" v-if="selectedAnime">
        <div class="detail-header">
          <h2>{{ selectedAnime.t }}</h2>
          <button @click="closeDetailPanel" class="close-btn">&times;</button>
        </div>
        <div class="detail-body">
          <img v-if="selectedAnime.img" :src="selectedAnime.img" class="detail-cover" :alt="selectedAnime.t" />
          <div class="detail-info">
            <p v-if="selectedAnime.et" class="detail-english-title">{{ selectedAnime.et }}</p>

            <div v-if="selectedAnime.desc" class="detail-section">
              <h3>Synopsis</h3>
              <div class="detail-description" v-html="selectedAnime.desc"></div>
            </div>

            <div class="detail-section">
              <h3>Genres</h3>
              <div class="genres">
                <span v-for="genre in selectedAnime.g" :key="genre" class="genre-tag">
                  {{ genre }}
                </span>
              </div>
            </div>

            <div class="detail-section">
              <h3>Statistics</h3>
              <p class="detail-stat">Popularity: {{ selectedAnime.p?.toLocaleString() }} users</p>
              <p class="detail-stat">Community: {{ selectedAnime.c }}</p>
            </div>
          </div>
        </div>
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
import { AnimeMapRenderer } from './lib/renderer-production.js';
import * as PIXI from 'pixi.js';

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
    const selectedAnime = ref(null);
    const tooltipStyle = ref({});
    const nodeCount = ref(0);
    const zoomPercent = ref(10);

    let renderer = null;

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

        renderer.onHover = (node, mouseX, mouseY) => {
          hoveredAnime.value = node;
          if (node) {
            tooltipStyle.value = {
              left: `${mouseX + 15}px`,
              top: `${mouseY + 15}px`
            };
          }
        };

        renderer.onClick = (node) => {
          selectedAnime.value = node;
        };

        // Wait for PIXI to initialize
        await new Promise(resolve => {
          const checkInit = () => {
            if (renderer.initialized) {
              resolve();
            } else {
              setTimeout(checkInit, 50);
            }
          };
          checkInit();
        });

        // Setup zoom tracking via viewport events
        if (renderer.viewport) {
          const updateZoom = () => {
            zoomPercent.value = Math.round(renderer.camera.zoom * 100);
          };

          renderer.viewport.on('zoomed', updateZoom);
          renderer.viewport.on('moved', updateZoom);

          // Initial zoom value
          updateZoom();
        }

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
      if (renderer && renderer.viewport) {
        const centerX = renderer.data.bounds.width / 2;
        const centerY = renderer.data.bounds.height / 2;
        renderer.viewport.animate({
          position: new PIXI.Point(centerX, centerY),
          scale: 0.04,
          time: 500
        });
      }
    };

    onMounted(() => {
      canvas.value.width = window.innerWidth;
      canvas.value.height = window.innerHeight;

      window.addEventListener('resize', handleResize);
      initRenderer();
    });

    onUnmounted(() => {
      window.removeEventListener('resize', handleResize);
      if (renderer) {
        renderer.destroy();
      }
    });

    const closeDetailPanel = () => {
      selectedAnime.value = null;
      if (renderer) {
        renderer.selectNode(null);
      }
    };

    return {
      canvas,
      loading,
      loadingMessage,
      error,
      searchQuery,
      searchResults,
      hoveredAnime,
      selectedAnime,
      tooltipStyle,
      nodeCount,
      zoomPercent,
      onSearch,
      focusAnime,
      resetView,
      closeDetailPanel
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
  background: #000000;
}

.map-canvas {
  display: block;
  width: 100%;
  height: 100%;
  background: #000000;
}

.loading {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  color: #e6cfb3;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
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
  color: #e6cfb3;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

.header h1 {
  font-size: 28px;
  font-weight: 600;
  margin-bottom: 5px;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7);
  letter-spacing: 0.5px;
}

.subtitle {
  font-size: 13px;
  opacity: 0.8;
  text-shadow: 0 1px 5px rgba(0, 0, 0, 0.5);
  font-weight: 400;
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
  background: rgba(44, 38, 32, 0.95);
  border: 1px solid rgba(230, 207, 179, 0.3);
  border-radius: 8px;
  color: #e6cfb3;
  font-size: 14px;
  outline: none;
  transition: all 0.2s;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

.search-input::placeholder {
  color: rgba(230, 207, 179, 0.5);
}

.search-input:focus {
  border-color: rgba(230, 207, 179, 0.6);
  background: rgba(44, 38, 32, 1);
  box-shadow: 0 0 0 3px rgba(230, 207, 179, 0.1);
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
  background: rgba(44, 38, 32, 0.98);
  border: 1px solid rgba(230, 207, 179, 0.4);
  border-radius: 10px;
  padding: 0;
  max-width: 320px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
  z-index: 1000;
  color: #e6cfb3;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  backdrop-filter: blur(10px);
  overflow: hidden;
}

.tooltip-cover {
  width: 100%;
  height: 180px;
  object-fit: cover;
  display: block;
}

.tooltip-content {
  padding: 16px;
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

.detail-panel {
  position: absolute;
  top: 20px;
  left: 20px;
  width: 450px;
  max-width: calc(100vw - 40px);
  background: rgba(0, 0, 0, 0.95);
  border: 1px solid rgba(230, 207, 179, 0.4);
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7);
  z-index: 1001;
  color: #e6cfb3;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  backdrop-filter: blur(10px);
  max-height: calc(100vh - 40px);
  overflow-y: auto;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.detail-header h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 600;
  flex: 1;
  padding-right: 20px;
}

.close-btn {
  background: transparent;
  border: none;
  color: #e6cfb3;
  font-size: 32px;
  line-height: 24px;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
  flex-shrink: 0;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.detail-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-cover {
  width: 100%;
  height: auto;
  max-height: 300px;
  object-fit: cover;
  border-radius: 8px;
}

.detail-info {
  flex: 1;
  min-width: 0;
}

.detail-english-title {
  font-size: 16px;
  opacity: 0.7;
  margin: 0 0 20px 0;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-section h3 {
  font-size: 14px;
  font-weight: 600;
  margin: 0 0 10px 0;
  opacity: 0.8;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.detail-section .genres {
  margin: 0;
}

.detail-stat {
  margin: 8px 0;
  font-size: 14px;
}

.detail-description {
  font-size: 14px;
  line-height: 1.6;
  opacity: 0.9;
  max-height: 200px;
  overflow-y: auto;
  padding-right: 8px;
}

.detail-description::-webkit-scrollbar {
  width: 6px;
}

.detail-description::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.detail-description::-webkit-scrollbar-thumb {
  background: rgba(230, 207, 179, 0.3);
  border-radius: 3px;
}

.detail-description::-webkit-scrollbar-thumb:hover {
  background: rgba(230, 207, 179, 0.5);
}

.controls {
  position: absolute;
  bottom: 20px;
  right: 20px;
  background: rgba(44, 38, 32, 0.95);
  border: 1px solid rgba(230, 207, 179, 0.3);
  border-radius: 10px;
  padding: 16px;
  color: #e6cfb3;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  backdrop-filter: blur(10px);
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
  color: #e6cfb3;
  opacity: 0.6;
  font-size: 12px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}
</style>
