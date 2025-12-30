# Configuration Guide

Complete reference for configuring Map of Anime.

## Table of Contents

- [Data Collection](#data-collection)
- [Graph Computation](#graph-computation)
- [Layout Generation](#layout-generation)
- [Renderer Settings](#renderer-settings)
- [UI Customization](#ui-customization)
- [Performance Tuning](#performance-tuning)

---

## Data Collection

### File: `scripts/collect-data-recommendations.js`

#### Core Settings

```javascript
// Line 7: Number of anime per API request
const BATCH_SIZE = 50;
// MAX: 50 (AniList GraphQL limit)
// Don't change unless you know what you're doing

// Line 8: Delay between API requests (milliseconds)
const DELAY_MS = 800;
// 500  - Fast (may hit rate limits)
// 800  - Default (recommended)
// 1000 - Safe (use if getting 429 errors)
// 1500 - Very safe (slowest)

// Line 9: Maximum anime to collect
const MAX_ANIME = 5000;
// 100   - Testing (1-2 min)
// 500   - Quick test (2-3 min)
// 1000  - Small dataset (5 min)
// 2500  - Medium dataset (10 min)
// 5000  - Full dataset (20 min) ← Default
// 10000 - Extended (40 min)
// 20000 - Very large (80+ min)
```

#### GraphQL Query Configuration

**Recommendations per anime** (Line 44):
```javascript
recommendations(sort: RATING_DESC, perPage: 25)
// Default: 25 recommendations per anime
// Range: 1-50
// More = better connections but slower
```

**Recommendation sort order** (Line 44):
```javascript
sort: RATING_DESC
// RATING_DESC - Highest rated first (best)
// RATING_ASC  - Lowest rated first
```

#### What Gets Collected

Edit the GraphQL query (Lines 20-60) to add/remove fields:

```graphql
media(type: ANIME, sort: POPULARITY_DESC) {
  id                    # Required
  title { romaji, english, native }  # Required
  coverImage { large, medium }       # For images
  description           # For synopses
  format                # TV, Movie, OVA, etc.
  status                # FINISHED, RELEASING, etc.
  genres                # Genre array
  averageScore          # 0-100 score
  popularity            # User count
  favourites            # Favorites count
  season                # WINTER, SPRING, SUMMER, FALL
  seasonYear            # Year (2023, etc.)

  # Add more fields from AniList API:
  # episodes            # Number of episodes
  # duration            # Minutes per episode
  # startDate { year, month, day }
  # endDate { year, month, day }
  # studios { nodes { name } }
}
```

---

## Graph Computation

### File: `scripts/compute-similarity-recommendations.js`

#### Edge Filtering

```javascript
// Line 32: Minimum recommendation rating to include
const MIN_RATING = 0;
// 0   - Include all recommendations
// 10  - Only decent recommendations
// 25  - Only good recommendations
// 50  - Only excellent recommendations
// 100 - Only perfect recommendations
```

#### Community Detection

**Louvain Algorithm** (Line 55):
```javascript
louvain(graph, {
  resolution: 1.0,  // Community granularity
  // 0.5  - Fewer, larger communities
  // 1.0  - Default (balanced)
  // 2.0  - More, smaller communities
});
```

#### Graph Statistics

Enable/disable statistics output (Lines 115-145):
```javascript
// Shows community sizes, genre distributions, etc.
// Set to false for faster processing:
const SHOW_STATS = true;
```

---

## Layout Generation

### File: `scripts/generate-layout-hierarchical.js`

#### Hierarchical Tiers

```javascript
// Line 28: Number of hierarchical levels
this.maxTier = 3;
// 0 = 1 level (flat)
// 1 = 2 levels
// 2 = 3 levels
// 3 = 4 levels (default, best)
// 4+ = 5+ levels (slower, may not improve)
```

#### Density/Spread

```javascript
// Line 31: Target density (lower = more spread out)
this.targetDensity = 0.00005;
// 0.0001  - Very compact
// 0.00005 - Default (balanced)
// 0.00003 - Spread out
// 0.00001 - Very spread out
```

#### World Size

```javascript
// Line 299: World dimensions
const scale = 20000;
// 10000  - Small world (faster rendering)
// 20000  - Default (balanced)
// 30000  - Large world (more space)
// 50000  - Very large (may affect performance)
```

#### Force Simulation Parameters

**Tier 0** (initial, Line 170):
```javascript
.force('link', forceLink(edges)
  .strength(d => d.weight * 0.5)  // Edge strength
  .distance(100))                 // Desired distance
.force('charge', forceManyBody()
  .strength(-200)                 // Repulsion strength
  .distanceMax(500))              // Max repulsion distance
.force('center', forceCenter(0, 0))
.alphaDecay(0.005)                // Cooling rate
.velocityDecay(0.4);              // Velocity damping
```

Adjust for different layouts:
- **More compact**: Increase link strength, decrease charge
- **More spread**: Decrease link strength, increase charge
- **Faster**: Increase alphaDecay (less accurate)
- **Better quality**: Decrease alphaDecay (slower)

#### Iteration Counts

```javascript
// Line 170: Tier 0 iterations
await this.runTier(nodes, edges, 500);
// 200  - Quick (less accurate)
// 500  - Default (balanced)
// 1000 - High quality (slower)

// Line 178: Tier 1-3 iterations
await this.runTier(nodes, edges, 300);
// 100  - Quick
// 300  - Default
// 500  - High quality
```

#### Color Assignment

**Hue distribution** (Lines 44-62):
```javascript
assignHues(nodes) {
  // Evenly distributes hues around color wheel
  // Shuffles for better visual separation
  // Swaps second with middle for contrast
}
```

Customize colors by editing the hue assignment logic.

---

## Renderer Settings

### File: `src/lib/renderer-production.js`

#### Performance

```javascript
// Line 27: Maximum visible nodes
this.MAX_VISIBLE_NODES = 1000;
// 500   - Best performance
// 1000  - Default (balanced)
// 2000  - Good GPU required
// 5000  - High-end GPU only
// ALL   - Remove culling (may lag)
```

#### Visual Style

```javascript
// Line 26: Background color (hex)
this.BACKGROUND_COLOR = 0x000000;
// 0x000000 - Black
// 0x0a0a0a - Dark gray
// 0x2c2620 - Warm brown (MAL-Map style)
// 0x1a1a2e - Dark blue
// 0xffffff - White
```

```javascript
// Line 25: Node sprite base size
this.NODE_BASE_SIZE = 400;
// 200  - Smaller nodes (pixelated)
// 400  - Default (smooth)
// 800  - Larger nodes (slower)
// 1000 - Very smooth (performance cost)
```

#### Node Sizing

**Scale calculation** (Line 191):
```javascript
const normalizedPop = Math.log(node.p || 1) / Math.log(1000000);
const scale = (0.02 + normalizedPop * 0.03);
// Adjust 0.02 and 0.03 to change size range:
// (0.01 + normalizedPop * 0.02) - Smaller nodes
// (0.03 + normalizedPop * 0.05) - Larger nodes
```

#### Colors (HSL)

**Normal state** (Line 154):
```javascript
return this.hslToHex(hue, 30, 50);
// hslToHex(hue, saturation, lightness)
// Increase saturation: (hue, 50, 50) - More vibrant
// Increase lightness: (hue, 30, 60) - Brighter
```

**Selected state** (Line 149):
```javascript
return this.hslToHex(hue, 90, 60);
// Very vibrant and bright
```

**Neighbor state** (Line 151):
```javascript
return this.hslToHex(hue, 60, 70);
// Medium vibrant, lighter
```

#### Viewport

**Initial zoom** (Line 77):
```javascript
this.viewport.setZoom(0.05);
// 0.02 - Very zoomed out
// 0.05 - Default
// 0.1  - Medium zoom
// 0.5  - Zoomed in
```

**Zoom settings** (Line 70):
```javascript
.wheel({ percent: 0.1 })
// 0.05 - Slower zoom
// 0.1  - Default
// 0.2  - Faster zoom
```

**Deceleration** (Line 71):
```javascript
.decelerate({ friction: 0.95 })
// 0.9  - More friction (stops faster)
// 0.95 - Default
// 0.99 - Less friction (coasts longer)
```

---

## UI Customization

### File: `src/App.vue`

#### Detail Panel Position

```css
/* Line 498: Panel position */
.detail-panel {
  left: 20px;   /* Distance from left edge */
  top: 20px;    /* Distance from top */
  width: 450px; /* Panel width */
}

/* Alternative positions: */
/* Right side: */
/*   right: 20px; */
/*   left: auto; */

/* Bottom: */
/*   bottom: 20px; */
/*   top: auto; */
```

#### Color Scheme

```css
/* Background (Line 270) */
background: #000000;  /* Black */

/* Text colors (Line 507) */
color: #e6cfb3;  /* Cream */

/* Panel backgrounds */
/* Line 501 */
background: rgba(0, 0, 0, 0.95);  /* Dark with transparency */

/* Borders (Line 502) */
border: 1px solid rgba(230, 207, 179, 0.4);  /* Subtle cream */
```

#### Tooltip

```css
/* Line 435: Tooltip padding */
padding: 0;  /* No padding (image fills top) */

/* Line 436: Tooltip max width */
max-width: 320px;

/* Line 447: Cover image height */
height: 180px;
```

#### Search Box

```css
/* Line 328: Search position */
.search-container {
  top: 20px;
  right: 20px;
  width: 300px;  /* Search box width */
}
```

---

## Performance Tuning

### For Low-End Systems

```javascript
// renderer-production.js
this.MAX_VISIBLE_NODES = 500;

// collect-data-recommendations.js
const MAX_ANIME = 1000;

// generate-layout-hierarchical.js
const scale = 10000;
this.maxTier = 2;
```

### For High-End Systems

```javascript
// renderer-production.js
this.MAX_VISIBLE_NODES = 2000;
this.NODE_BASE_SIZE = 800;

// collect-data-recommendations.js
const MAX_ANIME = 10000;

// generate-layout-hierarchical.js
const scale = 30000;
await this.runTier(nodes, edges, 1000);  // Line 170
```

### Memory Optimization

**Node.js heap size**:
```bash
# Increase for large datasets
node --max-old-space-size=4096 scripts/collect-data-recommendations.js
node --max-old-space-size=4096 scripts/compute-similarity-recommendations.js
```

### Network Optimization

**Compress data file**:
```bash
# After generating layout
gzip -9 public/data/processed/layout.compact.json
# Serve as .json.gz with proper headers
```

---

## Environment Variables

Create `.env` file:

```bash
# AniList API (optional - no auth needed)
ANILIST_API_URL=https://graphql.anilist.co

# Development server
VITE_PORT=3000

# Production URL
VITE_BASE_URL=/map-of-anime/

# Performance
VITE_MAX_VISIBLE_NODES=1000
```

Use in code:
```javascript
const maxNodes = import.meta.env.VITE_MAX_VISIBLE_NODES || 1000;
```

---

## Quick Reference

### Common Scenarios

**I want faster data collection:**
```javascript
// collect-data-recommendations.js
const MAX_ANIME = 1000;  // Reduce
const DELAY_MS = 500;    // Reduce (risky)
```

**I want more anime:**
```javascript
const MAX_ANIME = 10000; // Increase
const DELAY_MS = 1000;   // Increase to be safe
```

**I want better performance:**
```javascript
// renderer-production.js
this.MAX_VISIBLE_NODES = 500;  // Reduce
```

**I want more spread out layout:**
```javascript
// generate-layout-hierarchical.js
this.targetDensity = 0.00003;  // Lower
const scale = 30000;           // Larger world
```

**I want more compact layout:**
```javascript
this.targetDensity = 0.0001;   // Higher
const scale = 15000;           // Smaller world
```

---

## Advanced Configuration

### Custom Data Source

Replace AniList with your own API in `collect-data-recommendations.js`:

```javascript
// Custom API
const response = await axios.get('https://your-api.com/anime');

// Map to expected format
const anime = response.data.map(item => ({
  id: item.anime_id,
  title: {
    romaji: item.title,
    english: item.title_en
  },
  genres: item.tags,
  popularity: item.views,
  // ... etc
}));
```

### Custom Similarity Metric

Replace recommendation-based similarity in `compute-similarity-recommendations.js`:

```javascript
// Example: Genre-based similarity
function genreSimilarity(anime1, anime2) {
  const genres1 = new Set(anime1.genres);
  const genres2 = new Set(anime2.genres);

  const intersection = [...genres1].filter(g => genres2.has(g)).length;
  const union = new Set([...genres1, ...genres2]).size;

  return intersection / union;  // Jaccard similarity
}
```

### Custom Layout Algorithm

Replace hierarchical layout with your own in `generate-layout-hierarchical.js`:

```javascript
// Example: Circular layout by community
communities.forEach((community, i) => {
  const angle = (2 * Math.PI * i) / communities.length;
  const radius = 5000;

  community.nodes.forEach(node => {
    node.x = Math.cos(angle) * radius;
    node.y = Math.sin(angle) * radius;
  });
});
```

---

## Troubleshooting Configuration

### Changes Not Appearing

1. **Hard refresh browser**: Ctrl+Shift+R
2. **Clear cache**: Browser DevTools → Application → Clear storage
3. **Rebuild**: `npm run build`
4. **Restart dev server**: Stop and run `npm run dev` again

### Invalid Configuration

**Symptoms**: Errors, crashes, weird behavior

**Solution**: Reset to defaults:
```bash
git checkout scripts/
git checkout src/
```

Or check this guide for correct values.

---

**Need help?** Open an issue on GitHub with your configuration details.
