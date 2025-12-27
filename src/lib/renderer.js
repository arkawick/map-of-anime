export class AnimeMapRenderer {
  constructor(canvas, data) {
    this.canvas = canvas;
    this.data = data;
    this.gl = canvas.getContext('webgl2', { antialias: true });

    if (!this.gl) {
      throw new Error('WebGL 2 not supported');
    }

    // View state
    this.camera = {
      x: data.bounds.width / 2,
      y: data.bounds.height / 2,
      zoom: 0.1
    };

    this.hoveredNode = null;
    this.selectedNode = null;
    this.searchResults = new Set();

    // Build spatial index for hover detection
    this.buildSpatialIndex();

    // Initialize WebGL
    this.initGL();
    this.setupEventListeners();
  }

  buildSpatialIndex() {
    // Simple grid-based spatial index
    this.gridSize = 500;
    this.grid = new Map();

    this.data.nodes.forEach(node => {
      const gridX = Math.floor(node.x / this.gridSize);
      const gridY = Math.floor(node.y / this.gridSize);
      const key = `${gridX},${gridY}`;

      if (!this.grid.has(key)) {
        this.grid.set(key, []);
      }
      this.grid.get(key).push(node);
    });
  }

  initGL() {
    const gl = this.gl;

    // Vertex shader
    const vertexShaderSource = `#version 300 es
      in vec2 a_position;
      in float a_size;
      in vec3 a_color;
      in float a_highlight;

      uniform vec2 u_resolution;
      uniform vec2 u_camera;
      uniform float u_zoom;

      out vec3 v_color;
      out float v_highlight;

      void main() {
        vec2 worldPos = a_position - u_camera;
        vec2 scaledPos = worldPos * u_zoom;
        vec2 clipSpace = (scaledPos / u_resolution) * 2.0;

        gl_Position = vec4(clipSpace, 0.0, 1.0);
        gl_PointSize = a_size * u_zoom + 2.0;

        v_color = a_color;
        v_highlight = a_highlight;
      }
    `;

    // Fragment shader
    const fragmentShaderSource = `#version 300 es
      precision highp float;

      in vec3 v_color;
      in float v_highlight;

      out vec4 outColor;

      void main() {
        vec2 coord = gl_PointCoord - vec2(0.5);
        float dist = length(coord);

        if (dist > 0.5) {
          discard;
        }

        float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
        vec3 color = v_color;

        if (v_highlight > 0.5) {
          color = mix(color, vec3(1.0, 1.0, 0.0), 0.5);
          alpha = 1.0;
        }

        outColor = vec4(color, alpha * 0.8);
      }
    `;

    // Compile shaders
    const vertexShader = this.createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    // Create program
    this.program = gl.createProgram();
    gl.attachShader(this.program, vertexShader);
    gl.attachShader(this.program, fragmentShader);
    gl.linkProgram(this.program);

    if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
      throw new Error('Program link failed: ' + gl.getProgramInfoLog(this.program));
    }

    // Get attribute and uniform locations
    this.locations = {
      position: gl.getAttribLocation(this.program, 'a_position'),
      size: gl.getAttribLocation(this.program, 'a_size'),
      color: gl.getAttribLocation(this.program, 'a_color'),
      highlight: gl.getAttribLocation(this.program, 'a_highlight'),
      resolution: gl.getUniformLocation(this.program, 'u_resolution'),
      camera: gl.getUniformLocation(this.program, 'u_camera'),
      zoom: gl.getUniformLocation(this.program, 'u_zoom')
    };

    // Create buffers
    this.createBuffers();

    // Enable blending
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }

  createShader(type, source) {
    const gl = this.gl;
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error('Shader compile failed: ' + info);
    }

    return shader;
  }

  createBuffers() {
    const gl = this.gl;
    const nodeCount = this.data.nodes.length;

    // Prepare data arrays
    this.positions = new Float32Array(nodeCount * 2);
    this.sizes = new Float32Array(nodeCount);
    this.colors = new Float32Array(nodeCount * 3);
    this.highlights = new Float32Array(nodeCount);

    // Community colors
    const communityColors = this.generateCommunityColors();

    this.data.nodes.forEach((node, i) => {
      this.positions[i * 2] = node.x;
      this.positions[i * 2 + 1] = node.y;

      // Size based on popularity (increased size)
      const normalizedPop = Math.log(node.p || 1) / Math.log(1000000);
      this.sizes[i] = 8 + normalizedPop * 12;

      // Color based on community
      const color = communityColors[node.c % communityColors.length];
      this.colors[i * 3] = color[0];
      this.colors[i * 3 + 1] = color[1];
      this.colors[i * 3 + 2] = color[2];

      this.highlights[i] = 0;
    });

    // Create and bind buffers
    this.buffers = {
      position: this.createBuffer(this.positions),
      size: this.createBuffer(this.sizes),
      color: this.createBuffer(this.colors),
      highlight: this.createBuffer(this.highlights)
    };
  }

  createBuffer(data) {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
    return buffer;
  }

  generateCommunityColors() {
    const colors = [];
    const count = 50;

    for (let i = 0; i < count; i++) {
      const hue = (i * 137.5) % 360;
      const [r, g, b] = this.hslToRgb(hue / 360, 0.7, 0.6);
      colors.push([r, g, b]);
    }

    return colors;
  }

  hslToRgb(h, s, l) {
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

    return [r, g, b];
  }

  setupEventListeners() {
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;

    this.canvas.addEventListener('mousedown', (e) => {
      isDragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });

    this.canvas.addEventListener('mousemove', (e) => {
      if (isDragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;

        this.camera.x -= dx / this.camera.zoom;
        this.camera.y -= dy / this.camera.zoom;

        lastX = e.clientX;
        lastY = e.clientY;

        this.render();
      } else {
        this.updateHover(e.clientX, e.clientY);
      }
    });

    this.canvas.addEventListener('mouseup', (e) => {
      if (!isDragging) {
        // Click without drag - select node
        this.updateHover(e.clientX, e.clientY);
        if (this.hoveredNode) {
          this.focusNode(this.hoveredNode);
          if (this.onClick) {
            this.onClick(this.hoveredNode);
          }
        }
      }
      isDragging = false;
    });

    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const oldZoom = this.camera.zoom;
      this.camera.zoom *= zoomFactor;
      this.camera.zoom = Math.max(0.01, Math.min(10, this.camera.zoom));

      // Zoom towards mouse position
      const rect = this.canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const worldX = this.camera.x + (mouseX - rect.width / 2) / oldZoom;
      const worldY = this.camera.y + (mouseY - rect.height / 2) / oldZoom;

      this.camera.x = worldX - (mouseX - rect.width / 2) / this.camera.zoom;
      this.camera.y = worldY - (mouseY - rect.height / 2) / this.camera.zoom;

      this.render();
    });
  }

  updateHover(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const worldX = this.camera.x + (x - rect.width / 2) / this.camera.zoom;
    const worldY = this.camera.y + (y - rect.height / 2) / this.camera.zoom;

    // Find nearest node
    const threshold = 20 / this.camera.zoom;
    let nearest = null;
    let nearestDist = threshold;

    const gridX = Math.floor(worldX / this.gridSize);
    const gridY = Math.floor(worldY / this.gridSize);

    // Check nearby grid cells
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${gridX + dx},${gridY + dy}`;
        const cells = this.grid.get(key);

        if (cells) {
          for (const node of cells) {
            const dist = Math.sqrt(
              Math.pow(node.x - worldX, 2) + Math.pow(node.y - worldY, 2)
            );

            if (dist < nearestDist) {
              nearestDist = dist;
              nearest = node;
            }
          }
        }
      }
    }

    if (nearest !== this.hoveredNode) {
      this.hoveredNode = nearest;
      this.updateHighlights();
      this.render();

      if (this.onHover) {
        this.onHover(nearest);
      }
    }
  }

  updateHighlights() {
    const highlightSet = new Set();

    if (this.hoveredNode) {
      highlightSet.add(this.hoveredNode.id);
    }

    if (this.selectedNode) {
      highlightSet.add(this.selectedNode.id);
    }

    this.searchResults.forEach(id => highlightSet.add(id));

    this.data.nodes.forEach((node, i) => {
      this.highlights[i] = highlightSet.has(node.id) ? 1 : 0;
    });

    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.highlight);
    gl.bufferData(gl.ARRAY_BUFFER, this.highlights, gl.DYNAMIC_DRAW);
  }

  search(query) {
    if (!query) {
      this.searchResults.clear();
      this.updateHighlights();
      this.render();
      return [];
    }

    const results = [];
    const lowerQuery = query.toLowerCase();

    this.data.nodes.forEach(node => {
      const title = (node.t || '').toLowerCase();
      const englishTitle = (node.et || '').toLowerCase();

      if (title.includes(lowerQuery) || englishTitle.includes(lowerQuery)) {
        results.push(node);
        this.searchResults.add(node.id);
      }
    });

    this.updateHighlights();
    this.render();

    return results.slice(0, 50);
  }

  focusNode(node) {
    this.camera.x = node.x;
    this.camera.y = node.y;
    this.camera.zoom = 2;
    this.selectedNode = node;
    this.updateHighlights();
    this.render();
  }

  resize(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
    this.render();
  }

  render() {
    const gl = this.gl;

    gl.clearColor(0.04, 0.04, 0.04, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(this.program);

    // Set uniforms
    gl.uniform2f(this.locations.resolution, this.canvas.width, this.canvas.height);
    gl.uniform2f(this.locations.camera, this.camera.x, this.camera.y);
    gl.uniform1f(this.locations.zoom, this.camera.zoom);

    // Bind attributes
    this.bindAttribute(this.buffers.position, this.locations.position, 2);
    this.bindAttribute(this.buffers.size, this.locations.size, 1);
    this.bindAttribute(this.buffers.color, this.locations.color, 3);
    this.bindAttribute(this.buffers.highlight, this.locations.highlight, 1);

    // Draw
    gl.drawArrays(gl.POINTS, 0, this.data.nodes.length);
  }

  bindAttribute(buffer, location, size) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(location);
    gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
  }

  destroy() {
    const gl = this.gl;
    Object.values(this.buffers).forEach(buffer => gl.deleteBuffer(buffer));
    gl.deleteProgram(this.program);
  }
}
