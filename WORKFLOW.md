# Map of Anime - Complete Workflow Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Complete Workflow](#complete-workflow)
4. [Data Pipeline](#data-pipeline)
5. [Visualization Pipeline](#visualization-pipeline)
6. [Customization Guide](#customization-guide)
7. [Troubleshooting](#troubleshooting)
8. [Performance Optimization](#performance-optimization)

---

## Project Overview

**Map of Anime** is an interactive visualization tool that creates a graph-based map of anime relationships. Similar to the map-of-reddit project, it positions anime based on their similarity, creating visual clusters of related content.

### Key Features
- **Metadata-based similarity**: Uses genres, tags, studios, and staff instead of user data
- **Interactive WebGL visualization**: Smooth rendering of 1500+ anime
- **Community detection**: Automatic clustering by genre
- **Real-time search**: Find and focus on specific anime
- **Color-coded clusters**: Visual representation of anime communities

### Technology Stack
- **Data Collection**: Node.js + Axios (AniList GraphQL API)
- **Graph Processing**: Graphology + ForceAtlas2 layout algorithm
- **Visualization**: Vue 3 + Custom WebGL 2 renderer
- **Build Tool**: Vite

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     DATA COLLECTION                          │
│  (scripts/collect-data-metadata.js)                         │
│                                                              │
│  AniList API → Fetch anime metadata (genres, tags, studios) │
│              → Save to data/raw/anime_metadata.json         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  SIMILARITY COMPUTATION                      │
│  (scripts/compute-similarity-metadata.js)                   │
│                                                              │
│  Load metadata → Calculate Jaccard similarity               │
│                → Build graph (nodes + edges)                │
│                → Detect communities by genre                │
│                → Save to data/processed/graph.json          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   LAYOUT GENERATION                          │
│  (scripts/generate-layout.js)                               │
│                                                              │
│  Load graph → Run ForceAtlas2 (500 iterations)              │
│             → Normalize coordinates                         │
│             → Create compact JSON                           │
│             → Save to data/processed/layout.compact.json    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   VISUALIZATION                              │
│  (src/App.vue + src/lib/renderer.js)                        │
│                                                              │
│  Load layout.compact.json → Initialize WebGL renderer       │
│                           → Render interactive map          │
│                           → Handle user interactions        │
└─────────────────────────────────────────────────────────────┘
```

---

## Complete Workflow

### Step 1: Installation

```bash
# Clone or navigate to project directory
cd map-of-anime

# Install dependencies
npm install
```

**What this does:**
- Installs Vue 3, Vite, Graphology, Axios, and other dependencies
- Sets up the development environment

---

### Step 2: Data Collection (~3-5 minutes)

```bash
npm run collect
```

**What this does:**
1. Connects to AniList GraphQL API
2. Fetches up to 1500 most popular anime
3. For each anime, retrieves:
   - Title (romaji, english, native)
   - Genres (Action, Drama, etc.)
   - Tags (Isekai, Time Travel, etc.)
   - Studios (MAPPA, Ufotable, etc.)
   - Staff (directors, creators)
   - Relations (sequels, prequels)
   - Metadata (year, score, popularity)
4. Saves to `data/raw/anime_metadata.json`

**Output:**
```
=== Map of Anime - Metadata Collection ===
Fetching page 1... (0 anime collected)
✓ Fetched 50 anime (total: 50)
...
Progress saved (1500 anime)
Completed! Fetched 1500 anime with full metadata.
```

**Configuration:**
Edit `scripts/collect-data-metadata.js` line 125 to change the number:
```javascript
async function fetchAllAnime(maxAnime = 1500) {  // Change 1500 to desired amount
```

---

### Step 3: Similarity Computation (~2-3 minutes)

```bash
npm run compute
```

**What this does:**

#### 3.1 Calculate Similarity
For each pair of anime, computes weighted similarity based on:

| Factor | Weight | Description |
|--------|--------|-------------|
| Genres | 3.0 | Jaccard similarity of genre lists |
| Tags | 2.5 | Weighted tag overlap (by rank) |
| Studios | 1.5 | Shared production studios |
| Staff | 1.0 | Shared directors/creators |
| Format | 0.5 | TV, Movie, OVA match |
| Season | 0.3 | Released in similar years |
| Relations | 2.0 | Direct sequels/prequels |

**Similarity Threshold:** 0.25 (25% minimum similarity to create edge)

#### 3.2 Build Graph
- **Nodes**: Each anime becomes a node
- **Edges**: Created between similar anime (above threshold)
- **Result**: ~1500 nodes, ~136k edges

#### 3.3 Detect Communities
Assigns each anime to a genre-based community:
- Action, Adventure, Comedy, Drama, Fantasy
- Horror, Mystery, Psychological, Romance, Sci-Fi
- Slice of Life, Sports, Supernatural, Thriller, Mecha

**Output:**
```
Computing similarities based on metadata...
Processed 1124250/1124250 pairs (100%)
Found 136795 edges above threshold.

Building graph structure...
Graph has 1500 nodes and 136795 edges

Detecting communities based on primary genres...
Detected 16 communities
```

**Files created:**
- `data/processed/graph.json` (full graph with all metadata)
- `data/processed/communities.json` (community labels)

**Configuration:**
Edit `scripts/compute-similarity-metadata.js` line 115 to adjust threshold:
```javascript
const MIN_SIMILARITY = 0.25;  // Higher = fewer edges, more distinct clusters
```

---

### Step 4: Layout Generation (~2-3 minutes)

```bash
npm run layout
```

**What this does:**

#### 4.1 Load Graph
Reads `data/processed/graph.json` with nodes and edges

#### 4.2 Initialize ForceAtlas2
Force-directed graph layout algorithm that:
- Treats edges as springs (pull similar anime together)
- Applies repulsive force between all nodes (prevent overlap)
- Uses Barnes-Hut optimization for speed

**Parameters:**
```javascript
{
  iterations: 500,           // More = better layout, slower
  barnesHutOptimize: true,   // Faster computation
  gravity: 0.05,             // Pull towards center
  scalingRatio: 10,          // Spread factor
  linLogMode: false,         // Linear attraction mode
  edgeWeightInfluence: 1     // How much edge weight matters
}
```

#### 4.3 Run Layout
Executes 500 iterations in batches of 50, updating positions each iteration

#### 4.4 Normalize & Export
- Scales coordinates to 10000x10000 space
- Creates full JSON (layout.json) with all data
- Creates compact JSON (layout.compact.json) with abbreviated keys:
  - `t` = title
  - `et` = english title
  - `g` = genres
  - `p` = popularity
  - `c` = community ID
  - `x`, `y` = coordinates

**Output:**
```
Running ForceAtlas2 layout algorithm...
Completed 500/500 iterations
Layout computation complete!
Normalizing coordinates...
Saved layout with 1500 positioned nodes
Saved compact layout (3026081 bytes)
```

**Files created:**
- `data/processed/layout.json` (43 MB - full data)
- `data/processed/layout.compact.json` (3 MB - optimized for web)

**Configuration:**
Edit `scripts/generate-layout.js` to adjust layout:
```javascript
const settings = {
  iterations: 500,        // Increase for better layout
  settings: {
    gravity: 0.05,       // Higher = more compact
    scalingRatio: 10,    // Higher = more spread out
  }
};
```

---

### Step 5: Copy Data to Public Folder

```bash
cp data/processed/layout.compact.json public/data/processed/
```

**Why this is needed:**
Vite's dev server only serves files from the `public/` directory. The processed data needs to be accessible via HTTP.

**Alternative (automatic):**
You can create a post-layout script that does this automatically:

Edit `package.json`:
```json
"scripts": {
  "layout": "node scripts/generate-layout.js && npm run copy-data",
  "copy-data": "node -e \"require('fs').cpSync('data/processed/layout.compact.json','public/data/processed/layout.compact.json')\""
}
```

---

### Step 6: Start Visualization

```bash
npm run dev
```

**What this does:**
1. Starts Vite dev server on http://localhost:3000
2. Loads Vue application
3. Fetches `/data/processed/layout.compact.json`
4. Initializes WebGL renderer
5. Renders interactive map

**Output:**
```
VITE v5.0.0  ready in 523 ms
➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
```

Open http://localhost:3000 in your browser!

---

## Data Pipeline

### Data Flow Diagram

```
AniList API
    │
    ├─→ [GraphQL Query]
    │   └─→ anime_metadata.json (5.8 MB)
    │       ├─ id, title, genres
    │       ├─ tags, studios, staff
    │       └─ format, year, score
    │
    ├─→ [Similarity Calculation]
    │   └─→ graph.json (43 MB)
    │       ├─ nodes[] (1500 anime with metadata)
    │       └─ edges[] (136k connections with weights)
    │
    ├─→ [ForceAtlas2 Layout]
    │   └─→ layout.compact.json (3 MB)
    │       ├─ nodes[] (1500 anime with x,y positions)
    │       ├─ edges[] (connection data)
    │       └─ bounds {width, height}
    │
    └─→ [WebGL Renderer]
        └─→ Interactive Map
            ├─ 1500 colored dots
            ├─ Zoom, pan, search
            └─ Hover tooltips
```

### File Structure

```
map-of-anime/
├── data/
│   ├── raw/                          # Source data from API
│   │   └── anime_metadata.json       # 1500 anime with full metadata
│   └── processed/                    # Computed data
│       ├── graph.json                # Graph with nodes and edges
│       ├── communities.json          # Community labels
│       ├── layout.json               # Full layout data
│       └── layout.compact.json       # Optimized for web
│
├── public/
│   └── data/processed/               # Data accessible via HTTP
│       └── layout.compact.json       # Copy of compact layout
│
├── scripts/
│   ├── collect-data-metadata.js      # Step 1: Fetch from AniList
│   ├── compute-similarity-metadata.js # Step 2: Calculate similarities
│   └── generate-layout.js            # Step 3: Generate positions
│
└── src/
    ├── App.vue                       # Main Vue component
    ├── main.js                       # Vue entry point
    └── lib/
        └── renderer.js               # WebGL renderer
```

---

## Visualization Pipeline

### WebGL Renderer Architecture

#### Initialization
```javascript
new AnimeMapRenderer(canvas, data)
  ├─→ Build spatial index (grid-based for fast hover detection)
  ├─→ Compile WebGL shaders (vertex + fragment)
  ├─→ Create GPU buffers (positions, sizes, colors, highlights)
  ├─→ Setup event listeners (mouse, wheel, keyboard)
  └─→ Start render loop
```

#### Rendering Pipeline

1. **Vertex Shader** (runs for each anime dot)
   ```glsl
   - Input: position, size, color, highlight
   - Apply camera transform (pan + zoom)
   - Convert world coords to screen coords
   - Output: final position + size
   ```

2. **Fragment Shader** (runs for each pixel)
   ```glsl
   - Draw circular dots (discard pixels outside circle)
   - Apply color from vertex shader
   - Add highlight effect (yellow) if selected
   - Apply alpha for semi-transparency
   ```

3. **Rendering**
   ```javascript
   requestAnimationFrame() loop:
     ├─→ Clear canvas
     ├─→ Update uniforms (camera position, zoom)
     ├─→ Bind vertex buffers
     ├─→ Draw all 1500 points in single call
     └─→ Repeat at 60 FPS
   ```

#### Interaction System

**Hover Detection:**
```javascript
Mouse Move
  ├─→ Convert screen coords to world coords
  ├─→ Query spatial grid for nearby anime
  ├─→ Find nearest anime within threshold
  ├─→ Update highlight buffer
  ├─→ Trigger onHover callback
  └─→ Re-render
```

**Click Handling:**
```javascript
Mouse Click
  ├─→ Check if drag occurred (ignore if dragging)
  ├─→ Get hovered anime
  ├─→ Focus camera on anime (smooth zoom)
  ├─→ Set as selected
  └─→ Trigger onClick callback
```

**Search:**
```javascript
User Types Query
  ├─→ Filter nodes by title match
  ├─→ Update search results set
  ├─→ Update highlight buffer
  ├─→ Re-render with highlighted matches
  └─→ Display results list
```

### Camera System

```javascript
Camera {
  x: worldX,        // Center X position
  y: worldY,        // Center Y position
  zoom: 0.1-10.0    // Zoom level (0.1 = 10%, 10 = 1000%)
}

Screen to World:
  worldX = cameraX + (screenX - screenWidth/2) / zoom
  worldY = cameraY + (screenY - screenHeight/2) / zoom

World to Screen:
  screenX = (worldX - cameraX) * zoom + screenWidth/2
  screenY = (worldY - cameraY) * zoom + screenHeight/2
```

---

## Customization Guide

### Adjust Number of Anime

**File:** `scripts/collect-data-metadata.js:125`
```javascript
async function fetchAllAnime(maxAnime = 1500) {
  // Change 1500 to:
  // - 500 for quick testing
  // - 3000 for comprehensive map
  // - 10000+ for full database (slow!)
}
```

### Adjust Similarity Threshold

**File:** `scripts/compute-similarity-metadata.js:115`
```javascript
const MIN_SIMILARITY = 0.25;
// Lower (0.15): More edges, denser clusters
// Higher (0.35): Fewer edges, distinct clusters
```

### Adjust Similarity Weights

**File:** `scripts/compute-similarity-metadata.js:65-100`
```javascript
function computeAnimeSimilarity(animeA, animeB) {
  // Adjust these weights based on importance:
  similarity += genreSim * 3.0;      // Genre importance
  similarity += tagSim * 2.5;        // Tag importance
  similarity += studioSim * 1.5;     // Studio importance
  // etc.
}
```

### Adjust Layout Spread

**File:** `scripts/generate-layout.js:35-45`
```javascript
const settings = {
  iterations: 500,           // More = better (but slower)
  settings: {
    gravity: 0.05,          // Lower = more spread out
    scalingRatio: 10,       // Higher = more spacing
    strongGravityMode: false,
    linLogMode: false,
    edgeWeightInfluence: 1  // How much similarity matters
  }
};
```

### Adjust Dot Sizes

**File:** `src/lib/renderer.js:172-173`
```javascript
const normalizedPop = Math.log(node.p || 1) / Math.log(1000000);
this.sizes[i] = 8 + normalizedPop * 12;
// Base size: 8 pixels
// Max additional: 12 pixels
// Total range: 8-20 pixels
```

### Change Community Colors

**File:** `src/lib/renderer.js:185-196`
```javascript
generateCommunityColors() {
  const colors = [];
  const count = 50;  // Max communities to support

  for (let i = 0; i < count; i++) {
    const hue = (i * 137.5) % 360;  // Golden angle distribution
    const [r, g, b] = this.hslToRgb(hue / 360, 0.7, 0.6);
    // Adjust saturation (0.7) and lightness (0.6) here
    colors.push([r, g, b]);
  }

  return colors;
}
```

### Add Custom Community Detection

**File:** `scripts/compute-similarity-metadata.js:179-245`

Replace genre-based detection with your own algorithm:
```javascript
function detectCommunities(graph) {
  // Option 1: By studio
  graph.nodes.forEach(node => {
    const studio = node.studios?.[0]?.name || 'Other';
    node.community = studioToId.get(studio);
  });

  // Option 2: By decade
  graph.nodes.forEach(node => {
    const decade = Math.floor(node.seasonYear / 10) * 10;
    node.community = decadeToId.get(decade);
  });

  // Option 3: Use graph-based clustering (Louvain, etc.)
  // ... implement your algorithm
}
```

---

## Troubleshooting

### Issue: "No data showing in visualization"

**Symptoms:** Browser shows UI but no dots

**Solutions:**
1. Check browser console for errors (F12)
2. Verify data file exists:
   ```bash
   ls -lh public/data/processed/layout.compact.json
   ```
3. Check data is valid JSON:
   ```bash
   node check-data.js
   ```
4. Hard refresh browser (Ctrl+Shift+R)
5. Re-copy data file:
   ```bash
   cp data/processed/layout.compact.json public/data/processed/
   ```

### Issue: "All dots same color"

**Cause:** Only 1 community detected

**Solutions:**
1. Increase similarity threshold in `compute-similarity-metadata.js`:
   ```javascript
   const MIN_SIMILARITY = 0.30;  // Higher = more distinct
   ```
2. Regenerate:
   ```bash
   npm run compute && npm run layout
   cp data/processed/layout.compact.json public/data/processed/
   ```

### Issue: "Dots too small"

**Solution:** Edit `src/lib/renderer.js:172-173`:
```javascript
this.sizes[i] = 12 + normalizedPop * 20;  // Larger base + range
```

Refresh browser (no rebuild needed, Vite hot reloads)

### Issue: "API timeout (524 errors)"

**Cause:** AniList API rate limiting or server issues

**Solutions:**
1. Increase delay in `collect-data-metadata.js:8`:
   ```javascript
   const DELAY_MS = 2000;  // 2 seconds between requests
   ```
2. Reduce batch size:
   ```javascript
   const BATCH_SIZE = 25;  // Fewer per request
   ```
3. Use existing partial data:
   ```javascript
   // Script auto-saves progress every 5 pages
   // Check data/raw/anime_metadata.json
   ```

### Issue: "Layout looks clustered/messy"

**Solutions:**
1. Increase iterations in `generate-layout.js`:
   ```javascript
   iterations: 1000  // More iterations = better spread
   ```
2. Adjust layout parameters:
   ```javascript
   gravity: 0.02,        // Less gravity = more spread
   scalingRatio: 20,     // More spacing
   ```
3. Reduce edge count (increase similarity threshold)

### Issue: "WebGL not supported"

**Cause:** Old browser or hardware

**Solutions:**
1. Update browser to latest version
2. Enable hardware acceleration in browser settings
3. Check WebGL support: visit https://get.webgl.org/
4. Use different browser (Chrome, Firefox, Edge)

---

## Performance Optimization

### Reduce Dataset Size

For faster processing:
```javascript
// collect-data-metadata.js
fetchAllAnime(500)  // Instead of 1500
```

### Optimize Similarity Computation

Add early termination:
```javascript
// compute-similarity-metadata.js
if (similarity < MIN_SIMILARITY) continue;  // Skip remaining checks
```

### Reduce Layout Iterations

For faster layout generation:
```javascript
// generate-layout.js
iterations: 300  // Instead of 500
```

### Optimize Rendering

**Reduce draw calls:**
- Already optimized: Single draw call for all 1500 points

**Reduce update frequency:**
```javascript
// renderer.js - only render on changes
render() {
  if (!this.needsRender) return;
  // ... rendering code
  this.needsRender = false;
}
```

**Spatial index optimization:**
```javascript
// Adjust grid size for better hover performance
this.gridSize = 500;  // Larger = fewer checks, less precise
```

### Memory Optimization

**Stream large files:**
```javascript
// Instead of loading all at once
const stream = fs.createReadStream('large-file.json');
```

**Use compact format:**
- Already done: `layout.compact.json` uses abbreviated keys
- Further optimize: Use binary format (Protocol Buffers, MessagePack)

---

## Advanced Topics

### Custom Data Source

Replace AniList with MyAnimeList, Kitsu, or your own data:

1. **Create new collector:**
   ```javascript
   // scripts/collect-data-custom.js
   async function fetchFromMyAPI() {
     const response = await fetch('https://your-api.com/anime');
     const data = await response.json();
     // Transform to same format as anime_metadata.json
     return transformedData;
   }
   ```

2. **Ensure same data structure:**
   ```javascript
   {
     id: number,
     title: { romaji, english, native },
     genres: string[],
     tags: { name, rank }[],
     // ... rest of fields
   }
   ```

### Export High-Resolution Images

Add export functionality:

```javascript
// In App.vue
function exportImage() {
  const canvas = renderer.canvas;
  const dataURL = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = 'anime-map.png';
  link.href = dataURL;
  link.click();
}
```

### Add Filters

Filter by genre, year, studio:

```javascript
// In App.vue
const filters = {
  genres: ['Action', 'Fantasy'],
  yearRange: [2010, 2020],
  minScore: 7.5
};

const filteredNodes = data.nodes.filter(node => {
  return filters.genres.some(g => node.g.includes(g)) &&
         node.seasonYear >= filters.yearRange[0] &&
         node.seasonYear <= filters.yearRange[1] &&
         node.averageScore >= filters.minScore;
});
```

### Add Edge Visualization

Show connections between anime:

```javascript
// In renderer.js - add edge rendering
drawEdges() {
  const lineShader = this.createLineShader();
  this.data.edges.forEach(edge => {
    const source = this.nodeMap.get(edge.source);
    const target = this.nodeMap.get(edge.target);
    this.drawLine(source.x, source.y, target.x, target.y);
  });
}
```

---

## Deployment

### Build for Production

```bash
npm run build
```

Creates optimized static files in `dist/`:
- Minified JavaScript
- Optimized CSS
- Compressed assets

### Deploy to Static Hosting

**GitHub Pages:**
```bash
npm run build
git add dist -f
git subtree push --prefix dist origin gh-pages
```

**Netlify:**
```bash
npm run build
netlify deploy --prod --dir=dist
```

**Vercel:**
```bash
npm run build
vercel --prod
```

---

## Future Enhancements

### Planned Features
1. **Time-based animation**: Show anime map evolution over decades
2. **Genre filters**: Toggle visibility of specific genres
3. **Recommendation engine**: "Anime similar to X"
4. **Mobile support**: Touch controls and responsive design
5. **3D visualization**: Add Z-axis for time/score dimension
6. **Collaborative filtering**: Integrate actual user watch data
7. **Export/share**: Generate shareable links to specific views

### Community Contributions
- Submit issues: https://github.com/your-repo/issues
- Pull requests welcome!
- Share your custom visualizations

---

## Summary

This workflow creates an interactive anime map through 4 main steps:

1. **Collect** (3-5 min): Fetch 1500 anime metadata from AniList
2. **Compute** (2-3 min): Calculate similarities and detect communities
3. **Layout** (2-3 min): Generate 2D positions using force-directed algorithm
4. **Visualize** (instant): Render interactive WebGL map

**Total time:** ~10 minutes for a complete map of 1500 anime!

The result is a beautiful, interactive visualization where:
- Each dot is an anime
- Colors represent genres
- Position indicates similarity
- Users can zoom, pan, search, and explore

**Questions?** Check the troubleshooting section or open an issue!
