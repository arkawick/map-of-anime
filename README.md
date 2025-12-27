# Map of Anime

An interactive visualization of anime relationships based on viewer similarity, inspired by [map-of-reddit](https://github.com/anvaka/map-of-reddit).

## Overview

This project creates an interactive map where each dot represents an anime title, positioned based on shared viewer patterns. Anime watched by similar groups of users are clustered together, revealing interesting relationships and communities within the anime landscape.

## Features

- **Interactive WebGL Visualization**: Smooth pan and zoom through thousands of anime titles
- **Smart Clustering**: Anime grouped by viewer overlap using Jaccard similarity
- **Community Detection**: Automatic identification of anime clusters by genre/theme
- **Real-time Search**: Instantly find and focus on any anime
- **Hover Tooltips**: View details including title, genres, and popularity
- **Responsive Design**: Works on desktop and large displays

## Architecture

### Data Collection
- Fetches anime data from AniList GraphQL API
- Collects user watch lists to determine viewer overlap
- Computes Jaccard similarity between anime pairs
- No authentication required for public data

### Graph Processing
- Builds similarity graph with configurable thresholds
- Applies label propagation for community detection
- Uses ForceAtlas2 layout algorithm for positioning
- Outputs optimized JSON for web rendering

### Visualization
- Vue 3 + Vite frontend
- Custom WebGL 2 renderer for performance
- Spatial indexing for efficient hover detection
- Color-coded communities with dynamic sizing

## Quick Start

```bash
npm install                    # Install dependencies
npm run collect                # Fetch anime data (3-5 min)
npm run compute                # Calculate similarities (2-3 min)
npm run layout                 # Generate positions (2-3 min)
cp data/processed/layout.compact.json public/data/processed/
npm run dev                    # Start visualization
```

Open http://localhost:3000 - Done! 🎉

**📚 Documentation:**
- **[QUICK_START.md](QUICK_START.md)** - Get started in 10 minutes
- **[WORKFLOW.md](WORKFLOW.md)** - Complete technical documentation

---

## Detailed Installation

```bash
npm install
```

## Usage

### Step 1: Collect Data

Fetch anime information and user lists from AniList:

```bash
npm run collect
```

This will:
- Fetch all anime sorted by popularity
- Collect user lists for the top 2000 most popular anime
- Save raw data to `data/raw/`
- Takes several hours due to rate limiting (can be interrupted and resumed)

**Note**: The script includes automatic rate limiting and retry logic. Progress is saved periodically.

### Step 2: Compute Similarities

Calculate Jaccard similarity between anime based on shared viewers:

```bash
npm run compute
```

This will:
- Load collected user data
- Compute pairwise similarities
- Filter edges by minimum thresholds
- Detect communities using label propagation
- Save processed graph to `data/processed/`

### Step 3: Generate Layout

Run ForceAtlas2 algorithm to position nodes in 2D space:

```bash
npm run layout
```

This will:
- Load the similarity graph
- Run 500 iterations of ForceAtlas2
- Normalize coordinates to 10000x10000 space
- Generate both full and compact JSON formats
- Save to `data/processed/layout.compact.json`

### Step 4: View Visualization

Start the development server:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

**Controls**:
- **Scroll**: Zoom in/out
- **Drag**: Pan around the map
- **Hover**: View anime details
- **Search**: Find specific anime titles
- **Click search result**: Focus on that anime

### Step 5: Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Configuration

### Data Collection

Edit `scripts/collect-data.js`:

```javascript
// Number of anime to process
const topAnime = anime.slice(0, 2000); // Increase for more coverage

// Users per anime to fetch
await fetchAnimeUsers(item.id, title, 1000); // Increase for better similarity
```

### Similarity Thresholds

Edit `scripts/compute-similarity.js`:

```javascript
const MIN_SIMILARITY = 0.05;  // Minimum 5% shared users
const MIN_SHARED_USERS = 10;  // At least 10 shared users
```

### Layout Parameters

Edit `scripts/generate-layout.js`:

```javascript
const settings = {
  iterations: 500,  // More iterations = better layout
  settings: {
    gravity: 0.05,  // Higher = more compact
    scalingRatio: 10,  // Higher = more spread out
    // ... other ForceAtlas2 parameters
  }
};
```

## Project Structure

```
map-of-anime/
├── scripts/
│   ├── collect-data.js       # AniList API data collection
│   ├── compute-similarity.js # Similarity computation
│   └── generate-layout.js    # Graph layout generation
├── src/
│   ├── App.vue              # Main Vue component
│   ├── main.js              # Vue app entry
│   └── lib/
│       └── renderer.js      # WebGL renderer
├── data/
│   ├── raw/                 # Raw API data
│   └── processed/           # Processed graph data
├── public/                  # Static assets
├── index.html               # HTML entry point
├── vite.config.js           # Vite configuration
└── package.json             # Dependencies

```

## Data Format

### Compact Layout (layout.compact.json)

```json
{
  "nodes": [
    {
      "id": 123,
      "t": "Anime Title",
      "et": "English Title",
      "g": ["Action", "Adventure"],
      "p": 150000,
      "c": 5,
      "x": 4532,
      "y": 7821
    }
  ],
  "edges": [
    [sourceId, targetId, weight]
  ],
  "bounds": { "width": 10000, "height": 10000 }
}
```

## Performance

- Handles 2000+ anime with 50,000+ edges smoothly
- WebGL rendering at 60 FPS
- Spatial indexing for O(1) hover detection
- Lazy loading and progressive enhancement ready

## Limitations

- AniList API rate limits apply (no auth required but slower)
- Community detection is approximate
- Similarity based solely on shared viewers
- Requires modern browser with WebGL 2 support

## Future Enhancements

- Add genre filters
- Show connections between anime on hover
- Export high-resolution images
- Time-based evolution (by season/year)
- Integration with streaming services
- Mobile touch controls

## Credits

- Inspired by [anvaka/map-of-reddit](https://github.com/anvaka/map-of-reddit)
- Data from [AniList](https://anilist.co/)
- Layout algorithm: ForceAtlas2
- Built with Vue 3 and WebGL

## License

MIT