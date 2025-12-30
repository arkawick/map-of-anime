import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';

export class AnimeMapRenderer {
  constructor(canvas, data) {
    this.data = data;
    this.canvas = canvas;

    // Create PIXI application
    this.app = new PIXI.Application();
    this.initialized = false;

    // State
    this.hoveredNode = null;
    this.selectedNode = null;
    this.searchResults = new Set();
    this.nodeGraphics = new Map();
    this.nodeToGraphic = new Map();
    this.edgeGraphics = null;
    this.adjacencyMap = new Map();

    // Callbacks
    this.onHover = null;
    this.onClick = null;

    this.init();
  }

  async init() {
    // Initialize PIXI app
    await this.app.init({
      canvas: this.canvas,
      width: window.innerWidth,
      height: window.innerHeight,
      backgroundColor: 0x0a0a0a,
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

    this.app.stage.addChild(this.viewport);

    // Enable viewport interactions
    this.viewport
      .drag()
      .pinch()
      .wheel()
      .decelerate();

    // Set initial camera position
    const centerX = this.data.bounds.width / 2;
    const centerY = this.data.bounds.height / 2;
    this.viewport.moveCenter(centerX, centerY);
    this.viewport.setZoom(0.05);  // Lower zoom for larger world

    // Generate community colors
    this.communityColors = this.generateCommunityColors();

    // Build adjacency map from edges
    this.buildAdjacencyMap();

    // Create edge container (below nodes)
    this.edgeGraphics = new PIXI.Graphics();
    this.viewport.addChild(this.edgeGraphics);

    // Create nodes
    this.createNodes();

    // Setup event listeners
    this.setupEventListeners();

    this.initialized = true;
    this.render();
  }

  generateCommunityColors() {
    const colors = [];
    const count = 50;

    for (let i = 0; i < count; i++) {
      const hue = (i * 137.5) % 360;
      const color = this.hslToHex(hue / 360, 0.7, 0.6);
      colors.push(color);
    }

    return colors;
  }

  hslToHex(h, s, l) {
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return (Math.round(r * 255) << 16) + (Math.round(g * 255) << 8) + Math.round(b * 255);
  }

  buildAdjacencyMap() {
    // Build a map of node ID -> connected node IDs
    // Handle both array format [source, target, weight] and object format
    this.data.edges.forEach(edge => {
      let source, target, weight;

      if (Array.isArray(edge)) {
        // Compact format: [source, target, weight]
        [source, target, weight] = edge;
      } else {
        // Object format: {source, target, weight}
        source = edge.source;
        target = edge.target;
        weight = edge.weight;
      }

      // Convert to string for consistent lookup
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

  createNodes() {
    const container = new PIXI.Container();
    this.viewport.addChild(container);
    this.nodesContainer = container;

    this.data.nodes.forEach((node) => {
      const graphics = new PIXI.Graphics();

      // Calculate size based on popularity
      const normalizedPop = Math.log(node.p || 1) / Math.log(1000000);
      const size = 8 + normalizedPop * 12;

      // Get color based on community
      const color = this.communityColors[node.c % this.communityColors.length];

      // Draw circle
      graphics.circle(0, 0, size);
      graphics.fill({ color, alpha: 0.8 });

      // Position
      graphics.x = node.x;
      graphics.y = node.y;

      // Store references
      graphics.eventMode = 'static';
      graphics.cursor = 'pointer';
      graphics.userData = node;

      // Store with string ID for consistent lookup
      this.nodeGraphics.set(String(node.id), graphics);
      this.nodeToGraphic.set(graphics, node);

      container.addChild(graphics);
    });
  }

  setupEventListeners() {
    // Hover detection
    this.viewport.on('pointermove', (event) => {
      const pos = this.viewport.toWorld(event.global);
      this.updateHover(pos.x, pos.y, event.global.x, event.global.y);
    });

    // Click detection
    this.viewport.on('pointerdown', () => {
      this.isDragging = false;
    });

    this.viewport.on('pointermove', () => {
      if (this.viewport.moving) {
        this.isDragging = true;
      }
    });

    this.viewport.on('pointerup', () => {
      if (!this.isDragging && this.hoveredNode) {
        this.focusNode(this.hoveredNode);
        if (this.onClick) {
          this.onClick(this.hoveredNode);
        }
      }
      this.isDragging = false;
    });
  }

  updateHover(worldX, worldY, screenX, screenY) {
    const threshold = 50 / this.viewport.scale.x;
    let nearest = null;
    let nearestDist = threshold;

    // Check all nodes - could be optimized with spatial indexing
    this.data.nodes.forEach(node => {
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
      this.updateHighlights();

      if (this.onHover) {
        this.onHover(nearest, screenX, screenY);
      }
    }
  }

  drawEdges() {
    this.edgeGraphics.clear();

    if (!this.selectedNode) return;

    const selectedId = String(this.selectedNode.id);
    const connections = this.adjacencyMap.get(selectedId) || [];
    const selectedNodeData = this.data.nodes.find(n => String(n.id) === selectedId);

    if (!selectedNodeData) return;

    // Draw edges from selected node to connected nodes
    connections.forEach(conn => {
      const targetNode = this.data.nodes.find(n => String(n.id) === String(conn.id));
      if (!targetNode) return;

      // Line width based on weight
      const lineWidth = 1 + (conn.weight || 1) * 2;
      const alpha = Math.min(0.6, 0.2 + (conn.weight || 1) * 0.4);

      this.edgeGraphics.moveTo(selectedNodeData.x, selectedNodeData.y);
      this.edgeGraphics.lineTo(targetNode.x, targetNode.y);
      this.edgeGraphics.stroke({
        width: lineWidth,
        color: 0xffffff,
        alpha: alpha
      });
    });
  }

  updateHighlights() {
    const highlightSet = new Set();
    const connectedSet = new Set();

    if (this.hoveredNode) {
      highlightSet.add(this.hoveredNode.id);
    }

    if (this.selectedNode) {
      const selectedId = String(this.selectedNode.id);
      highlightSet.add(selectedId);

      // Add connected nodes to highlight set
      const connections = this.adjacencyMap.get(selectedId) || [];
      connections.forEach(conn => {
        connectedSet.add(String(conn.id));
      });
    }

    this.searchResults.forEach(id => highlightSet.add(id));

    // Update all node graphics
    this.data.nodes.forEach((node) => {
      const nodeId = String(node.id);
      const graphics = this.nodeGraphics.get(nodeId);
      const isHighlighted = highlightSet.has(nodeId);
      const isConnected = connectedSet.has(nodeId);

      // Calculate size
      const normalizedPop = Math.log(node.p || 1) / Math.log(1000000);
      const baseSize = 8 + normalizedPop * 12;
      let size = baseSize;

      if (isHighlighted) {
        size = baseSize * 1.5;
      } else if (isConnected) {
        size = baseSize * 1.2;
      }

      // Get color
      let color = this.communityColors[node.c % this.communityColors.length];

      // Redraw
      graphics.clear();
      graphics.circle(0, 0, size);

      if (isHighlighted) {
        // Yellow highlight for selected
        graphics.fill({ color: 0xffff00, alpha: 0.9 });
      } else if (isConnected) {
        // Bright color for connected nodes
        graphics.fill({ color: 0xffffff, alpha: 0.8 });
      } else {
        graphics.fill({ color, alpha: 0.8 });
      }
    });

    // Draw edges
    this.drawEdges();
  }

  search(query) {
    if (!query) {
      this.searchResults.clear();
      this.updateHighlights();
      return [];
    }

    const results = [];
    const lowerQuery = query.toLowerCase();

    this.searchResults.clear();

    this.data.nodes.forEach(node => {
      const title = (node.t || '').toLowerCase();
      const englishTitle = (node.et || '').toLowerCase();

      if (title.includes(lowerQuery) || englishTitle.includes(lowerQuery)) {
        results.push(node);
        this.searchResults.add(node.id);
      }
    });

    this.updateHighlights();

    return results.slice(0, 50);
  }

  focusNode(node) {
    // Toggle selection if clicking same node
    if (this.selectedNode && String(this.selectedNode.id) === String(node.id)) {
      this.selectedNode = null;
    } else {
      this.selectedNode = node;
      this.viewport.animate({
        position: new PIXI.Point(node.x, node.y),
        scale: 2,
        time: 500,
        ease: 'easeInOutQuad'
      });
    }
    this.updateHighlights();
  }

  resize(width, height) {
    if (this.app) {
      this.app.renderer.resize(width, height);
      if (this.viewport) {
        this.viewport.resize(width, height);
      }
    }
  }

  render() {
    // PIXI handles rendering automatically
    if (this.app && this.app.renderer) {
      this.app.renderer.render(this.app.stage);
    }
  }

  get camera() {
    if (!this.viewport) return { x: 0, y: 0, zoom: 0.1 };

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
      this.app.destroy(true, { children: true });
    }
  }
}
