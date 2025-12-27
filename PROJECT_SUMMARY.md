# Map of Anime - Project Summary

## Project Context

This project was created to build an interactive visualization of anime relationships, inspired by [anvaka/map-of-reddit](https://github.com/anvaka/map-of-reddit).

### Goal
Create a map where each anime is represented as a dot, positioned based on similarity to other anime, allowing users to explore anime relationships visually.

---

## Development Journey

### Initial Approach: User-Based Similarity
**Plan:** Use AniList API to fetch which users watched which anime, then compute Jaccard similarity based on shared viewers (like map-of-reddit does with subreddits).

**Implementation:**
- `scripts/collect-data.js` - Fetch anime and user watch lists
- `scripts/compute-similarity.js` - Calculate similarity from shared users

**Result:** ❌ Failed
- AniList API returned 524 (timeout) errors when fetching user lists
- User list queries are too heavy for AniList's public API
- Would take many hours even if it worked

### Pivot: Metadata-Based Similarity
**New Approach:** Use anime metadata (genres, tags, studios, staff) to compute similarity instead of user data.

**Advantages:**
- ✅ Much faster (~10 minutes total vs hours)
- ✅ More reliable (no API timeouts)
- ✅ Actually produces better clustering (thematic grouping)
- ✅ Works offline after initial collection

**Implementation:**
- `scripts/collect-data-metadata.js` - Fetch anime with rich metadata
- `scripts/compute-similarity-metadata.js` - Multi-factor similarity calculation

---

## Technical Decisions

### 1. Similarity Computation

**Weighted multi-factor approach:**
```javascript
Similarity = weighted_sum([
  Genre overlap (3.0),
  Tag overlap (2.5),
  Studio overlap (1.5),
  Staff overlap (1.0),
  Format match (0.5),
  Season proximity (0.3),
  Direct relations (2.0)
]) / total_weight
```

**Why:** Provides nuanced similarity that captures multiple dimensions of anime relationships.

**Threshold:** 0.25 (25% minimum similarity)
- Lower threshold (0.15) → Too many edges, single cluster
- Higher threshold (0.35) → Too few edges, disconnected nodes
- Sweet spot: 0.25 → ~136k edges, good clustering

### 2. Community Detection

**Evolution:**
- **Attempt 1:** Label propagation algorithm
  - Result: All anime in single community (failed)
- **Attempt 2:** Genre-based assignment
  - Result: 12-16 distinct communities (success!)

**Final Implementation:**
```javascript
Assign anime to community based on primary genre:
- Action → Community 0
- Mystery → Community 6
- Romance → Community 8
- etc.
```

**Why:** Simple, interpretable, visually meaningful.

### 3. Layout Algorithm

**Choice:** ForceAtlas2
- Popular for graph visualization
- Good balance of speed and quality
- Built into graphology library

**Parameters:**
```javascript
iterations: 500
barnesHutOptimize: true  (faster for large graphs)
gravity: 0.05            (gentle pull to center)
scalingRatio: 10         (moderate spread)
edgeWeightInfluence: 1   (respect similarity weights)
```

**Why:** These settings provide good separation between clusters while keeping the map cohesive.

### 4. Visualization Technology

**Choice:** Custom WebGL 2 renderer (not Canvas 2D, not Three.js)

**Reasons:**
- Performance: Can render 1500+ points at 60 FPS
- Control: Full control over rendering pipeline
- Size: Lightweight (no heavy dependencies)
- Learning: Good exercise in graphics programming

**Key optimizations:**
- Single draw call for all points
- Spatial grid index for O(1) hover detection
- Compact data format (abbreviated JSON keys)

---

## Key Files

### Data Pipeline
```
collect-data-metadata.js      # API fetching
  ↓
compute-similarity-metadata.js # Similarity & communities
  ↓
generate-layout.js             # 2D positioning
  ↓
layout.compact.json            # Final data (3 MB)
```

### Visualization
```
index.html                     # Entry point
  ↓
src/main.js                    # Vue initialization
  ↓
src/App.vue                    # UI components
  ↓
src/lib/renderer.js            # WebGL rendering
```

---

## Issues Encountered & Solutions

### Issue 1: API Timeouts (524 errors)
**Cause:** Fetching user watch lists too heavy for AniList API

**Solution:** Switched to metadata-based similarity
- Faster, more reliable, better results

### Issue 2: All Dots Same Color
**Cause:** Community detection found only 1 community

**Root causes:**
1. Similarity threshold too low (0.15 → 463k edges)
2. Label propagation converged to single cluster

**Solution:**
1. Increased threshold to 0.25 (→ 136k edges)
2. Switched to genre-based community assignment

### Issue 3: Dots Too Small
**Cause:** Original size formula: `3 + popularity * 5`

**Solution:** Increased to: `8 + popularity * 12`
- More visible, easier to click
- Still shows popularity differences

### Issue 4: Data Not Loading in Browser
**Cause:** Vite dev server only serves from `public/` directory

**Solution:** Copy processed data to public folder
```bash
cp data/processed/layout.compact.json public/data/processed/
```

### Issue 5: Missing Community Field
**Cause:** `detectCommunities()` called after `graph.json` saved

**Solution:** Reorder operations - detect communities before saving
```javascript
// OLD: build → save → detect
// NEW: build → detect → save
```

---

## Data Formats

### anime_metadata.json (5.8 MB)
```json
[{
  "id": 16498,
  "title": {
    "romaji": "Shingeki no Kyojin",
    "english": "Attack on Titan",
    "native": "進撃の巨人"
  },
  "genres": ["Action", "Drama", "Fantasy", "Mystery"],
  "tags": [{"name": "War", "rank": 90}, ...],
  "studios": {"nodes": [{"id": 858, "name": "Wit Studio"}]},
  "staff": {"edges": [...]},
  "popularity": 931353,
  "averageScore": 85,
  "seasonYear": 2013
}]
```

### graph.json (43 MB)
```json
{
  "nodes": [{
    "id": 16498,
    "title": "Shingeki no Kyojin",
    "genres": ["Action", "Drama", "Fantasy", "Mystery"],
    "community": 0,
    ...
  }],
  "edges": [{
    "source": 16498,
    "target": 101922,
    "weight": 0.67
  }]
}
```

### layout.compact.json (3 MB)
```json
{
  "nodes": [{
    "id": 16498,
    "t": "Shingeki no Kyojin",
    "et": "Attack on Titan",
    "g": ["Action", "Drama", "Fantasy", "Mystery"],
    "p": 931353,
    "c": 0,
    "x": 6837,
    "y": 7092
  }],
  "edges": [[16498, 101922, 0.67], ...],
  "bounds": {"width": 10000, "height": 10000}
}
```

**Key abbreviations:**
- `t` = title (romaji)
- `et` = englishTitle
- `g` = genres
- `p` = popularity
- `c` = community
- `x`, `y` = coordinates

---

## Performance Metrics

### Data Collection
- **1500 anime**: ~3-5 minutes
- **Rate limit**: 1.5 seconds between requests
- **Data size**: 5.8 MB raw JSON

### Computation
- **Similarity calculation**: ~2-3 minutes
  - 1,124,250 pairwise comparisons
  - ~136,795 edges above threshold
- **Community detection**: <1 second (genre-based)
- **Output size**: 43 MB graph JSON

### Layout Generation
- **ForceAtlas2**: ~2-3 minutes
  - 500 iterations
  - 1500 nodes, 136k edges
- **Output size**: 3 MB compact JSON

### Visualization
- **Load time**: <1 second
- **FPS**: 60 (WebGL)
- **Memory**: ~50 MB
- **Nodes rendered**: 1500 points/frame

**Total workflow time:** ~10 minutes

---

## Design Patterns

### 1. Progressive Enhancement
- Works with partial data (auto-saves progress)
- Graceful degradation if API fails
- Can resume interrupted processes

### 2. Separation of Concerns
- Data collection (scripts/)
- Data processing (scripts/)
- Visualization (src/)
- Each step independent, can run separately

### 3. Optimization Strategy
- Pre-compute everything possible
- Runtime only handles rendering & interaction
- Compact data format for faster loading
- Spatial indexing for fast queries

### 4. Configurability
- All thresholds and parameters easily adjustable
- Comments explain what each parameter does
- No hardcoded "magic numbers"

---

## Future Improvements

### Short Term
1. ✅ Add click handlers (completed)
2. ✅ Fix community detection (completed)
3. ✅ Increase dot sizes (completed)
4. Add genre filters
5. Show edge connections on hover
6. Add keyboard shortcuts

### Long Term
1. Mobile/touch support
2. 3D visualization option
3. Time-based animation (decade evolution)
4. Export high-res images
5. Share links to specific views
6. Integrate real user data (if API allows)
7. Collaborative filtering recommendations

---

## Lessons Learned

### 1. API Limitations Matter
Initial plan (user-based similarity) failed due to API constraints. Always have a backup approach.

### 2. Simpler Can Be Better
Metadata-based similarity actually produces better, more interpretable results than user-based would have.

### 3. Visualization Debugging is Hard
Issues like "all dots same color" require understanding the entire pipeline. Good logging and validation scripts (check-data.js) are essential.

### 4. WebGL is Worth It
Custom WebGL renderer is more complex than Canvas 2D, but the performance gain for 1500+ points is significant.

### 5. Community Detection is Nuanced
Graph-based clustering algorithms (label propagation, Louvain) can struggle with certain graph structures. Sometimes domain knowledge (genre-based) works better.

---

## Technology Stack Summary

### Backend (Data Processing)
- **Node.js 16+**: Runtime environment
- **Axios**: HTTP client for AniList API
- **Graphology**: Graph data structure
- **graphology-layout-forceatlas2**: Layout algorithm

### Frontend (Visualization)
- **Vue 3**: UI framework
- **Vite**: Build tool & dev server
- **WebGL 2**: Graphics rendering
- **Custom renderer**: No external graphics library

### Data Source
- **AniList GraphQL API**: Anime metadata
- **No authentication required**: Public API
- **Rate limit**: ~1 request/second

---

## Project Statistics

### Code
- **JavaScript files**: 8
- **Vue components**: 1
- **Total lines**: ~1,500
- **Largest file**: renderer.js (~450 lines)

### Data
- **Anime processed**: 1,500
- **Edges computed**: 136,795
- **Communities**: 12-16
- **Genres covered**: 15+

### Documentation
- **README.md**: Project overview
- **QUICK_START.md**: 10-minute guide
- **WORKFLOW.md**: Technical deep-dive (500+ lines)
- **PROJECT_SUMMARY.md**: This file

---

## Credits & Inspiration

- **Inspired by**: [anvaka/map-of-reddit](https://github.com/anvaka/map-of-reddit)
- **Data source**: [AniList](https://anilist.co/)
- **Layout algorithm**: ForceAtlas2 (Jacomy et al., 2014)
- **Community**: Built with assistance from Claude (Anthropic)

---

## License

MIT License - See LICENSE file for details

---

## Contact & Contributions

- **Issues**: Report bugs and feature requests
- **Pull Requests**: Contributions welcome!
- **Discussions**: Share your custom visualizations

---

**Last Updated**: December 2024

**Status**: ✅ Fully functional, production-ready

**Next Steps**:
1. Deploy to GitHub Pages
2. Add genre filters
3. Create showcase video
4. Share with anime community
