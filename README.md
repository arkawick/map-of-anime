# Map of Anime

An interactive visualization of 4,584+ anime positioned by viewer similarity using AniList recommendation data, rendered with production-grade PIXI.js graphics.

![Anime](https://img.shields.io/badge/anime-4584-blue) ![Status](https://img.shields.io/badge/status-production-success) ![License](https://img.shields.io/badge/license-MIT-green)

## ✨ Features

- 🗺️ **Interactive Exploration** - Pan, zoom, and navigate through thousands of anime
- 🎨 **Hierarchical Clustering** - Community-based color-coded grouping with d3-force
- 🔍 **Smart Search** - Find anime by title with live autocomplete
- 🖼️ **High-Quality Images** - Anime cover art from AniList
- 📖 **Rich Metadata** - Synopses, genres, popularity stats
- ⚡ **60 FPS Performance** - Sprite-based rendering with visibility culling (max 1000 nodes)
- 🎯 **Detail Panel** - Click any anime to see full information
- 💫 **Smooth Animations** - Fluid transitions and hover effects

## 📸 Screenshot

```
[Your visualization with colored communities, detail panel on left, search in top-right]
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 14+** and npm
- **2GB free disk space** for data
- **Modern browser** with WebGL 2.0 support

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd map-of-anime

# Install dependencies
npm install
```

### Option A: Use Existing Data (Fast - 30 seconds)

If `public/data/processed/layout.compact.json` already exists:

```bash
npm run dev
# Open http://localhost:3000
```

### Option B: Generate Fresh Data (Full Pipeline - 20 minutes)

```bash
# Step 1: Collect anime from AniList (~15 min)
npm run collect

# Step 2: Build similarity graph (~3 min)
npm run compute

# Step 3: Generate hierarchical layout (~2 min)
node scripts/generate-layout-hierarchical.js

# Step 4: Copy to public folder
cp data/processed/layout.compact.json public/data/processed/
# Windows: copy data\processed\layout.compact.json public\data\processed\

# Step 5: Start development server
npm run dev
```

---

## ⚙️ Configuration

### 1. Limit Number of Anime

**File**: `scripts/collect-data-recommendations.js` (Line 9)

```javascript
const MAX_ANIME = 5000; // Default: 5000

// Recommended values:
//   500  - Quick testing (2-3 min)
//  1000  - Small dataset (3-5 min)
//  2500  - Medium dataset (7-10 min)
//  5000  - Full dataset (15-20 min) ← Default
// 10000  - Extended (30-40 min)
```

### 2. API Rate Limiting

**File**: `scripts/collect-data-recommendations.js` (Line 8)

```javascript
const DELAY_MS = 800; // Milliseconds between requests

// Adjust based on your needs:
// 500  - Faster (may hit rate limits)
// 800  - Default (recommended)
// 1000 - Conservative (slowest, safest)
```

### 3. Batch Size

**File**: `scripts/collect-data-recommendations.js` (Line 7)

```javascript
const BATCH_SIZE = 50; // Anime per request

// Don't exceed 50 (AniList GraphQL API limit)
```

### 4. Visual Settings

**File**: `src/lib/renderer-production.js`

```javascript
// Maximum nodes visible at once (Line 27)
this.MAX_VISIBLE_NODES = 1000; // 1000 = optimal 60fps

// Background color (Line 26)
this.BACKGROUND_COLOR = 0x000000; // 0x000000 = black

// Node sprite size (Line 25)
this.NODE_BASE_SIZE = 400; // Larger = smoother circles
```

### 5. Layout Density

**File**: `scripts/generate-layout-hierarchical.js`

```javascript
// Hierarchical levels (Line 28)
this.maxTier = 3; // 0-3 = 4 tiers total

// Spread/compactness (Line 31)
this.targetDensity = 0.00005; // Lower = more spread out

// World dimensions (Line 299)
const scale = 20000; // 20000x20000 world size
```

### 6. Recommendation Filter

**File**: `scripts/compute-similarity-recommendations.js`

```javascript
// Minimum rating to include recommendation (Line 32)
const MIN_RATING = 0; // 0 = include all

// Common values:
// 0  - All recommendations
// 10 - Only well-rated recommendations
// 50 - Only highly-rated recommendations
```

---

## 📁 Project Structure

```
map-of-anime/
├── src/
│   ├── App.vue                           # Main UI component
│   ├── lib/
│   │   └── renderer-production.js        # PIXI.js renderer with culling
│   └── main.js                           # Vue 3 entry point
│
├── scripts/
│   ├── collect-data-recommendations.js   # Fetch from AniList API
│   ├── compute-similarity-recommendations.js  # Build recommendation graph
│   ├── generate-layout-hierarchical.js   # Hierarchical force layout
│   └── check-data.js                     # Data validation utility
│
├── data/
│   ├── raw/
│   │   └── anime_recommendations.json    # Raw AniList data
│   └── processed/
│       ├── graph.json                    # Similarity graph with communities
│       ├── communities.json              # Louvain clustering results
│       └── layout.compact.json           # Final positioned data
│
├── public/
│   └── data/processed/
│       └── layout.compact.json           # Production data (copied)
│
├── package.json                          # Dependencies and scripts
├── vite.config.js                        # Vite configuration
└── README.md                             # This file
```

---

## 🔄 Data Pipeline Explained

### Step 1: Data Collection (`npm run collect`)

**Script**: `scripts/collect-data-recommendations.js`

**What it does**:
- Fetches top anime by popularity from AniList GraphQL API
- For each anime, gets: title, cover image, description, genres, popularity, recommendations
- Saves to `data/raw/anime_recommendations.json`

**Time**: ~15 minutes for 5,000 anime
**Output**: Raw anime data with recommendations

**GraphQL Query**:
```graphql
{
  Page(page: 1, perPage: 50) {
    media(type: ANIME, sort: POPULARITY_DESC) {
      id
      title { romaji, english }
      coverImage { large }
      description
      genres
      popularity
      recommendations(sort: RATING_DESC, perPage: 25) {
        edges {
          node {
            mediaRecommendation { id, title }
            rating
          }
        }
      }
    }
  }
}
```

### Step 2: Similarity Computation (`npm run compute`)

**Script**: `scripts/compute-similarity-recommendations.js`

**What it does**:
1. Loads raw anime data
2. Builds undirected graph where:
   - **Nodes** = anime
   - **Edges** = recommendation connections (weight = rating)
3. Applies **Louvain algorithm** for community detection
4. Saves graph with community assignments

**Time**: ~3 minutes
**Output**:
- `data/processed/graph.json` - Graph with communities
- `data/processed/communities.json` - Community info

**Algorithm**: Louvain modularity optimization

### Step 3: Hierarchical Layout (`node scripts/generate-layout-hierarchical.js`)

**Script**: `scripts/generate-layout-hierarchical.js`

**What it does**:
1. Creates hierarchical layout nodes (one per community initially)
2. Runs 4-tier force-directed layout:
   - **Tier 0**: Top-level communities (500 iterations)
   - **Tier 1-3**: Progressive subdivision (300 iterations each)
3. Assigns **HSL hues** to communities for coloring
4. Maps anime to layout positions
5. Outputs compact JSON format

**Time**: ~2 minutes
**Output**: `data/processed/layout.compact.json`

**Forces Used**:
- `forceLink` - Keeps connected anime close
- `forceManyBody` - Prevents overlap
- `forceCenter` - Centers the graph

### Step 4: Compact Data Format

**File**: `data/processed/layout.compact.json`

```json
{
  "nodes": [
    {
      "id": "16498",
      "t": "Shingeki no Kyojin",         // Title (romaji)
      "et": "Attack on Titan",           // English title
      "g": ["Action", "Drama"],          // Genres array
      "p": 931904,                       // Popularity (user count)
      "c": 0,                            // Community ID
      "h": 86,                           // Hue (0-360 degrees)
      "x": 9825,                         // X position (0-20000)
      "y": 12058,                        // Y position (0-20000)
      "img": "https://s4.anilist.co/...", // Cover image URL
      "desc": "<p>Synopsis...</p>"       // HTML description
    }
  ],
  "edges": [
    [16498, 101348, 26.61]               // [source, target, weight]
  ],
  "bounds": {
    "width": 20000,
    "height": 20000
  }
}
```

**Field Abbreviations** (for file size):
- `t` = title
- `et` = englishTitle
- `g` = genres
- `p` = popularity
- `c` = community
- `h` = hue
- `img` = coverImage
- `desc` = description

---

## 🎮 Usage

### Controls

| Action | Control |
|--------|---------|
| **Pan** | Click + Drag |
| **Zoom** | Mouse Wheel / Pinch |
| **Search** | Type in top-right search box |
| **Select Anime** | Click any dot |
| **Close Detail** | Click X or click same anime again |
| **Reset View** | Click "Reset View" button |
| **Hover Preview** | Mouse over any dot |

### Search

- Type any part of anime title (romaji or English)
- Shows top 50 matches
- Click result to focus and open detail panel

### Detail Panel

Shows when you click an anime:
- **Cover Image** - Full poster
- **Synopsis** - Scrollable description
- **Genres** - All genre tags
- **Statistics** - Popularity, community

---

## 🛠️ Development

### Run Development Server

```bash
npm run dev
```

- URL: http://localhost:3000 (or next available port)
- Hot Module Replacement (HMR) enabled
- Auto-reloads on file changes

### Build for Production

```bash
npm run build
```

- Output: `dist/` folder
- Optimized and minified
- Bundle size: ~343 KB (107 KB gzipped)

### Preview Production Build

```bash
npm run preview
```

- Serves the `dist/` folder
- Test production optimizations

### Available Scripts

| Script | Command |
|--------|---------|
| Development server | `npm run dev` |
| Production build | `npm run build` |
| Preview build | `npm run preview` |
| Collect data | `npm run collect` |
| Compute graph | `npm run compute` |
| Generate layout | `node scripts/generate-layout-hierarchical.js` |
| Check data | `node check-data.js` |

---

## 🐛 Troubleshooting

### Problem: "Failed to load data" on page load

**Cause**: Missing `public/data/processed/layout.compact.json`

**Solution**:
```bash
cp data/processed/layout.compact.json public/data/processed/
# Windows: copy data\processed\layout.compact.json public\data\processed\
```

### Problem: Map shows nothing initially, only after clicking "Reset View"

**Cause**: Viewport positioning issue

**Solution**: Hard refresh browser
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

### Problem: Rate limiting from AniList

**Symptoms**: Collection script fails with 429 errors

**Solution**: Increase delay in `collect-data-recommendations.js`:
```javascript
const DELAY_MS = 1000; // Increase from 800
```

### Problem: Out of memory during collection

**Symptoms**: Node.js crashes with heap error

**Solution**: Reduce dataset size:
```javascript
const MAX_ANIME = 2500; // Reduce from 5000
```

Or increase Node memory:
```bash
node --max-old-space-size=4096 scripts/collect-data-recommendations.js
```

### Problem: Layout looks too clustered

**Cause**: Target density too high

**Solution**: Edit `generate-layout-hierarchical.js`:
```javascript
this.targetDensity = 0.00003; // Lower = more spread (was 0.00005)
```

Then regenerate layout:
```bash
node scripts/generate-layout-hierarchical.js
cp data/processed/layout.compact.json public/data/processed/
```

### Problem: Tooltip not showing when detail panel is open

**Cause**: Outdated code

**Solution**: This should be fixed in latest version. Tooltip shows on hover even when panel is open.

### Problem: Low FPS / Laggy performance

**Solutions**:
1. Reduce visible nodes in `renderer-production.js`:
   ```javascript
   this.MAX_VISIBLE_NODES = 500; // Reduce from 1000
   ```

2. Use smaller dataset (1000-2500 anime)

3. Close other browser tabs

4. Disable browser extensions

5. Use Chrome/Edge (best WebGL performance)

---

## 🎯 Performance

- **Rendering**: 60 FPS with 1000 visible nodes
- **Data Loading**: <1 second for 4584 anime
- **Memory**: ~150 MB typical usage
- **Visibility Culling**: Only renders nodes in viewport
- **Sprite-Based**: Reuses textures for performance

---

## 💻 Technology Stack

### Frontend
- **Vue 3** - Reactive UI framework
- **Vite** - Build tool with HMR
- **PIXI.js v8** - WebGL rendering engine
- **pixi-viewport** - Pan/zoom controls

### Data Processing
- **d3-force** - Force-directed graph layout
- **graphology** - Graph data structure
- **graphology-communities-louvain** - Community detection
- **axios** - HTTP client for AniList API

### Data Source
- **AniList GraphQL API** - Anime metadata and recommendations

---

## 🌐 Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Recommended |
| Edge | 90+ | ✅ Recommended |
| Firefox | 88+ | ✅ Supported |
| Safari | 14+ | ✅ Supported |

**Requirements**:
- WebGL 2.0 support
- ES6+ JavaScript
- Modern CSS (backdrop-filter, flexbox)

---

## 📚 Further Reading

- **[CONFIGURATION.md](CONFIGURATION.md)** - Detailed configuration guide
- **[DATA_PIPELINE.md](DATA_PIPELINE.md)** - In-depth data pipeline documentation
- **[AniList API Docs](https://anilist.gitbook.io/anilist-apiv2-docs/)** - AniList GraphQL reference
- **[PIXI.js Docs](https://pixijs.com/guides)** - Rendering engine documentation

---

## 🤝 Contributing

Contributions welcome! Areas for improvement:

- Genre filters
- Year/season timeline
- Mobile touch controls
- Additional data sources
- Performance optimizations
- Accessibility features

---

## 📜 License

MIT License - feel free to use for your own projects!

---

## 🙏 Credits

- **Data**: [AniList](https://anilist.co/) - Comprehensive anime database
- **Inspiration**: [MAL-Map](https://github.com/platers/MAL-Map) - Similar visualization for MyAnimeList
- **Layout Algorithm**: ForceAtlas2 via d3-force

---

## 📧 Support

- **Issues**: Report bugs or request features on [GitHub Issues](https://github.com/your-username/map-of-anime/issues)
- **Discussions**: Ask questions on [GitHub Discussions](https://github.com/your-username/map-of-anime/discussions)
- **AniList**: Data updates at [anilist.co](https://anilist.co)

---

**Made with ❤️ for the anime community**
