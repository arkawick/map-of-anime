# Next Steps - Quick Reference

## 🎯 What's Happening Now

**Data Collection is running in the background** ⏳
- Collecting 5,000 anime with recommendation data from AniList
- Progress: Check the terminal output
- Expected completion: 8-15 minutes from start

---

## 📋 Once Data Collection Finishes

### Step 1: Compute Similarities & Communities
```bash
npm run compute
```

**What this does:**
- Builds graph from recommendation data
- Applies Louvain community detection (multi-level modularity)
- Saves processed graph to `data/processed/graph.json`
- Time: ~1-2 minutes

**Expected output:**
```
Building recommendation graph...
Graph has ~4000-5000 nodes and ~50000-150000 edges
Detecting communities using Louvain algorithm...
Detected 30-60 communities
Top 10 communities:
  1. Community 5: 450 anime
     Primary genre: Action
     Top anime: Attack on Titan, Demon Slayer, ...
```

---

### Step 2: Generate Layout
```bash
npm run layout
```

**What this does:**
- Reads `data/processed/graph.json`
- Applies ForceAtlas2 force-directed layout (500 iterations)
- Normalizes positions to 10000x10000 space
- Saves to `public/data/processed/layout.compact.json`
- Time: ~2-5 minutes depending on graph size

**Expected output:**
```
Loading graph from data/processed/graph.json...
Running ForceAtlas2 layout (500 iterations)...
Iteration 100/500...
Iteration 200/500...
...
Layout complete! Normalized positions.
```

---

### Step 3: Run Development Server
```bash
npm run dev
```

**What this does:**
- Starts Vite dev server
- Opens at http://localhost:3000
- Hot reload enabled for live development

**Open in browser and enjoy:**
- Smooth PIXI.js rendering at 60 FPS
- Pan with mouse drag
- Zoom with scroll wheel
- Hover to see anime details
- Search for specific anime
- Click to focus on anime

---

## 🎨 Features to Try

### Search
- Type anime name in search box (top right)
- Click result to zoom to that anime
- Highlights matching anime in yellow

### Navigation
- **Drag:** Pan around the map
- **Scroll:** Zoom in/out
- **Hover:** See anime details tooltip
- **Click:** Focus on anime with smooth animation
- **Reset View button:** Return to overview

### What to Look For
1. **Community Clusters:** Anime grouped by recommendations
2. **Popular Anime:** Larger circles = more popular
3. **Genre Patterns:** Colors indicate community (discovered by algorithm)
4. **Connections:** Similar anime positioned close together

---

## 🔍 Checking Progress

### Data Collection Status
```bash
# Check if file exists and size
ls -lh data/raw/anime_recommendations.json
```

Should show ~5-15 MB file when complete.

### Verify Graph Output
```bash
# Check processed graph
ls -lh data/processed/graph.json
```

### Verify Layout Output
```bash
# Check final layout
ls -lh public/data/processed/layout.compact.json
```

Should show ~3-8 MB file depending on anime count.

---

## 🐛 Troubleshooting

### If Data Collection Stops Early
```bash
# Check the file
node check-data.js

# If you have 500+ anime, you can proceed:
npm run compute
npm run layout
npm run dev
```

### If Compute Fails
```
Error: anime_recommendations.json not found
```
**Solution:** Data collection didn't complete. Check `data/raw/` directory.

### If Layout Fails
```
Error: graph.json not found
```
**Solution:** Run `npm run compute` first.

### If Visualization Shows Error
```
Failed to load data
```
**Solution:** Run `npm run layout` to generate `public/data/processed/layout.compact.json`

---

## 📊 Comparison

### Before Upgrade
- 1,500 anime
- Genre-based communities (15 fixed)
- WebGL renderer (basic)
- Metadata-based similarities
- Several bugs

### After Upgrade
- **5,000 anime** ✨
- **Louvain communities** (30-60 dynamic) ✨
- **PIXI.js renderer** (smooth animations) ✨
- **Recommendation-based** (actual user behavior) ✨
- **All bugs fixed** ✅

---

## 🚀 Build for Production

Once satisfied with the visualization:

```bash
npm run build
```

This creates an optimized production bundle in `dist/` that you can:
- Deploy to GitHub Pages
- Deploy to Netlify/Vercel
- Host on any static file server

---

## 📈 Optional: Collect Even More Data

Want 10,000 anime? Edit the script:

```javascript
// In scripts/collect-data-recommendations.js
const MAX_ANIME = 10000; // Change from 5000
```

Then re-run:
```bash
rm data/raw/anime_recommendations.json
npm run collect
```

**Note:** More anime = longer processing time but richer visualization.

---

## 💡 Tips

1. **First Time:** Let the map load completely before interacting
2. **Performance:** If slow, try reducing anime count or closing other browser tabs
3. **Exploration:** Use search to find your favorite anime and discover similar ones
4. **Communities:** Different colors show different recommendation communities
5. **Popularity:** Bigger circles = more popular anime

---

## 📁 Key Files Reference

```
data/raw/
  └── anime_recommendations.json     # Collected data (Step 1)

data/processed/
  ├── graph.json                     # Processed graph (Step 2)
  └── communities.json               # Community labels (Step 2)

public/data/processed/
  └── layout.compact.json            # Final visualization data (Step 3)

src/lib/
  └── renderer-pixi.js               # New PIXI.js renderer
```

---

**Ready to see your upgraded map of anime? Follow the steps above once data collection completes!** 🎉
