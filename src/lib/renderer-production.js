import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';

// Production-grade renderer inspired by MAL-Map
export class AnimeMapRenderer {
  constructor(canvas, data) {
    this.canvas = canvas;
    this.data = data;
    this.app = null;
    this.viewport = null;
    this.initialized = false;

    // State
    this.selectedNode = null;
    this.hoveredNode = null;
    this.searchResults = new Set();

    // Node storage
    this.nodes = [];
    this.nodeMap = new Map();
    this.nodeGraphics = new Map();
    this.adjacencyMap = new Map();

    // Visual constants
    this.NODE_BASE_SIZE = 400; // Large base for smooth circles
    this.BACKGROUND_COLOR = 0x000000; // Black
    this.MAX_VISIBLE_NODES = 1000; // Performance limit

    // Edge rendering
    this.edgeGraphics = null;
    this.labelContainer = null;

    // Callbacks
    this.onHover = null;
    this.onClick = null;

    this.init();
  }

  async init() {
    // Initialize PIXI Application
    this.app = new PIXI.Application();

    await this.app.init({
      canvas: this.canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: this.BACKGROUND_COLOR,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1
    });

    // Create viewport
    this.viewport = new Viewport({
      screenWidth: window.innerWidth,
      screenHeight: window.innerHeight,
      worldWidth: this.data.bounds.width,
      worldHeight: this.data.bounds.height,
      events: this.app.renderer.events
    });

    this.viewport.sortableChildren = true;
    this.app.stage.addChild(this.viewport);

    // Enable interactions
    this.viewport
      .drag()
      .pinch()
      .wheel({ percent: 0.1 })
      .decelerate({ friction: 0.95 });

    // Set initial position to show entire world
    this.viewport.fitWorld(true);
    this.viewport.setZoom(0.05); // Zoom out to see more

    // Create node texture (sprite-based for performance)
    this.nodeTexture = this.createNodeTexture();

    // Build data structures
    this.buildAdjacencyMap();
    this.processNodes();

    // Create rendering layers
    this.edgeGraphics = new PIXI.Graphics();
    this.edgeGraphics.zIndex = 0;
    this.viewport.addChild(this.edgeGraphics);

    this.nodesContainer = new PIXI.Container();
    this.nodesContainer.zIndex = 1;
    this.viewport.addChild(this.nodesContainer);

    this.labelContainer = new PIXI.Container();
    this.labelContainer.zIndex = 2;
    this.viewport.addChild(this.labelContainer);

    // Create all node sprites
    this.createNodeSprites();

    // Setup event listeners
    this.setupEventListeners();

    // Start render loop
    this.startRenderLoop();

    this.initialized = true;

    // Force initial visibility update after viewport is ready
    setTimeout(() => {
      this.updateVisibleNodes();
      console.log('Initial visibility update complete');
    }, 100);
  }

  createNodeTexture() {
    // Create a smooth circle texture
    const graphics = new PIXI.Graphics();
    graphics.circle(0, 0, this.NODE_BASE_SIZE);
    graphics.fill(0xffffff);

    return this.app.renderer.generateTexture(graphics);
  }

  hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));

    const r = Math.round(255 * f(0));
    const g = Math.round(255 * f(8));
    const b = Math.round(255 * f(4));

    return (r << 16) + (g << 8) + b;
  }

  getNodeColor(node, state = 'normal') {
    const hue = node.h || 0;

    switch (state) {
      case 'selected':
        return this.hslToHex(hue, 90, 60); // Vibrant
      case 'neighbor':
        return this.hslToHex(hue, 60, 70); // Lighter
      case 'normal':
      default:
        return this.hslToHex(hue, 30, 50); // Default
    }
  }

  buildAdjacencyMap() {
    this.data.edges.forEach(edge => {
      let source, target, weight;

      if (Array.isArray(edge)) {
        [source, target, weight] = edge;
      } else {
        source = edge.source;
        target = edge.target;
        weight = edge.weight;
      }

      source = String(source);
      target = String(target);

      if (!this.adjacencyMap.has(source)) {
        this.adjacencyMap.set(source, []);
      }
      if (!this.adjacencyMap.has(target)) {
        this.adjacencyMap.set(target, []);
      }

      this.adjacencyMap.get(source).push({ id: target, weight: weight || 1 });
      this.adjacencyMap.get(target).push({ id: source, weight: weight || 1 });
    });
  }

  processNodes() {
    this.data.nodes.forEach(node => {
      this.nodeMap.set(String(node.id), node);
      this.nodes.push(node);
    });
  }

  createNodeSprites() {
    this.nodes.forEach(node => {
      const sprite = new PIXI.Sprite(this.nodeTexture);
      sprite.anchor.set(0.5);
      sprite.x = node.x;
      sprite.y = node.y;

      // Calculate scale based on popularity
      const normalizedPop = Math.log(node.p || 1) / Math.log(1000000);
      const scale = (0.02 + normalizedPop * 0.03); // Scale for NODE_BASE_SIZE=400
      sprite.scale.set(scale);

      // Set color
      sprite.tint = this.getNodeColor(node);

      // Interactive
      sprite.eventMode = 'static';
      sprite.cursor = 'pointer';
      sprite.userData = node;

      // Initially hide (will be shown by visibility culling)
      sprite.visible = false;

      this.nodeGraphics.set(String(node.id), sprite);
      this.nodesContainer.addChild(sprite);
    });
  }

  setupEventListeners() {
    // Hover detection
    this.viewport.on('pointermove', (event) => {
      if (this.viewport.moving) return;

      const pos = this.viewport.toWorld(event.global);
      this.updateHover(pos.x, pos.y, event.global.x, event.global.y);
    });

    // Click detection
    let isDragging = false;

    this.viewport.on('drag-start', () => {
      isDragging = true;
    });

    this.viewport.on('clicked', (event) => {
      if (isDragging) {
        isDragging = false;
        return;
      }

      if (this.hoveredNode) {
        this.selectNode(this.hoveredNode);
      } else {
        this.selectNode(null);
      }
    });

    // Viewport moved - update visible nodes
    this.viewport.on('moved', () => {
      this.needsVisibilityUpdate = true;
    });

    this.viewport.on('zoomed', () => {
      this.needsVisibilityUpdate = true;
    });
  }

  updateHover(worldX, worldY, screenX, screenY) {
    const threshold = 100 / this.viewport.scale.x;
    let nearest = null;
    let nearestDist = threshold;

    // Only check visible nodes
    const visibleBounds = this.viewport.getVisibleBounds();

    this.nodes.forEach(node => {
      if (!visibleBounds.contains(node.x, node.y)) return;

      const dist = Math.sqrt(
        Math.pow(node.x - worldX, 2) + Math.pow(node.y - worldY, 2)
      );

      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = node;
      }
    });

    if (nearest !== this.hoveredNode) {
      this.hoveredNode = nearest;

      if (this.onHover) {
        this.onHover(nearest, screenX, screenY);
      }
    }
  }

  selectNode(node) {
    if (this.selectedNode && node && String(this.selectedNode.id) === String(node.id)) {
      // Deselect
      this.selectedNode = null;
    } else {
      this.selectedNode = node;

      if (node && this.viewport) {
        // Smooth zoom to node
        this.viewport.animate({
          position: new PIXI.Point(node.x, node.y),
          scale: 0.5,
          time: 500,
          ease: 'easeInOutQuad'
        });
      }
    }

    if (this.onClick) {
      this.onClick(this.selectedNode);
    }

    this.updateNodeStates();
    this.drawEdges();
  }

  updateNodeStates() {
    const selectedId = this.selectedNode ? String(this.selectedNode.id) : null;
    const hoveredId = this.hoveredNode ? String(this.hoveredNode.id) : null;
    const connectedIds = new Set();

    if (selectedId) {
      const connections = this.adjacencyMap.get(selectedId) || [];
      connections.forEach(conn => connectedIds.add(String(conn.id)));
    }

    this.nodeGraphics.forEach((sprite, id) => {
      const node = this.nodeMap.get(id);
      let state = 'normal';

      if (id === selectedId || id === hoveredId) {
        state = 'selected';
      } else if (connectedIds.has(id)) {
        state = 'neighbor';
      }

      sprite.tint = this.getNodeColor(node, state);

      // Adjust scale for emphasis
      const normalizedPop = Math.log(node.p || 1) / Math.log(1000000);
      let baseScale = (0.02 + normalizedPop * 0.03);

      if (state === 'selected') {
        baseScale *= 1.5;
      } else if (state === 'neighbor') {
        baseScale *= 1.2;
      }

      sprite.scale.set(baseScale);
    });
  }

  drawEdges() {
    this.edgeGraphics.clear();

    if (!this.selectedNode) return;

    const selectedId = String(this.selectedNode.id);
    const connections = this.adjacencyMap.get(selectedId) || [];
    const selectedNode = this.nodeMap.get(selectedId);

    connections.forEach(conn => {
      const targetNode = this.nodeMap.get(String(conn.id));
      if (!targetNode) return;

      const lineWidth = Math.max(0.5, conn.weight * 3);
      const alpha = Math.min(0.6, 0.2 + conn.weight * 0.4);

      this.edgeGraphics.moveTo(selectedNode.x, selectedNode.y);
      this.edgeGraphics.lineTo(targetNode.x, targetNode.y);
      this.edgeGraphics.stroke({
        width: lineWidth,
        color: 0xffffff,
        alpha: alpha
      });
    });
  }

  updateVisibleNodes() {
    const viewportBounds = this.viewport.getVisibleBounds();
    console.log('Viewport bounds:', {
      x: viewportBounds.x,
      y: viewportBounds.y,
      width: viewportBounds.width,
      height: viewportBounds.height,
      center: this.viewport.center,
      scale: this.viewport.scale.x
    });

    // Pad for smooth entry/exit
    viewportBounds.pad(viewportBounds.width * 0.3, viewportBounds.height * 0.3);

    const visibleNodes = [];

    this.nodes.forEach(node => {
      const sprite = this.nodeGraphics.get(String(node.id));

      if (viewportBounds.contains(node.x, node.y)) {
        visibleNodes.push(node);
        sprite.visible = true;
      } else {
        sprite.visible = false;
      }
    });

    // Sort by popularity and limit
    visibleNodes.sort((a, b) => (b.p || 0) - (a.p || 0));
    const limitedVisible = visibleNodes.slice(0, this.MAX_VISIBLE_NODES);

    visibleNodes.forEach(node => {
      const sprite = this.nodeGraphics.get(String(node.id));
      sprite.visible = limitedVisible.includes(node);
    });

    console.log(`Visibility update: ${limitedVisible.length} nodes visible out of ${this.nodes.length} total`);
  }

  startRenderLoop() {
    this.needsVisibilityUpdate = true;

    const renderLoop = () => {
      if (this.needsVisibilityUpdate) {
        this.updateVisibleNodes();
        this.needsVisibilityUpdate = false;
      }

      requestAnimationFrame(renderLoop);
    };

    renderLoop();
  }

  search(query) {
    if (!query) {
      this.searchResults.clear();
      return [];
    }

    const results = [];
    const lowerQuery = query.toLowerCase();

    this.nodes.forEach(node => {
      const title = (node.t || '').toLowerCase();
      const englishTitle = (node.et || '').toLowerCase();

      if (title.includes(lowerQuery) || englishTitle.includes(lowerQuery)) {
        results.push(node);
        this.searchResults.add(String(node.id));
      }
    });

    return results.slice(0, 50);
  }

  focusNode(node) {
    this.selectNode(node);
  }

  resize(width, height) {
    if (this.app) {
      this.app.renderer.resize(width, height);
      if (this.viewport) {
        this.viewport.resize(width, height);
        this.needsVisibilityUpdate = true;
      }
    }
  }

  get camera() {
    if (!this.viewport) return { x: 0, y: 0, zoom: 0.04 };

    return {
      x: this.viewport.center.x,
      y: this.viewport.center.y,
      zoom: this.viewport.scale.x
    };
  }

  destroy() {
    if (this.viewport) {
      this.viewport.destroy({ children: true });
    }
    if (this.app) {
      this.app.destroy(true);
    }
  }
}
