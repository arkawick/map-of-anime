# Map of Anime - Quick Start Guide

## TL;DR - Get Your Map Running in 10 Minutes

```bash
# 1. Install dependencies
npm install

# 2. Collect anime data from AniList (3-5 min)
npm run collect

# 3. Calculate similarities (2-3 min)
npm run compute

# 4. Generate positions (2-3 min)
npm run layout

# 5. Copy data to public folder
cp data/processed/layout.compact.json public/data/processed/

# 6. Start visualization
npm run dev
```

Then open **http://localhost:3000** 🎉

---

## First Time Setup

### Prerequisites
- Node.js 16+ installed
- Modern browser with WebGL 2 support

### Installation
```bash
git clone <your-repo>
cd map-of-anime
npm install
```

---

## Commands Reference

| Command | Time | What It Does |
|---------|------|--------------|
| `npm run collect` | 3-5 min | Fetches 1500 anime from AniList API |
| `npm run compute` | 2-3 min | Calculates similarities, detects communities |
| `npm run layout` | 2-3 min | Generates 2D positions using ForceAtlas2 |
| `npm run dev` | instant | Starts development server |
| `npm run build` | ~30 sec | Builds for production |

---

## Quick Customization

### Change Number of Anime

**File:** `scripts/collect-data-metadata.js` (line 125)
```javascript
fetchAllAnime(1500)  // Change to 500, 1000, 3000, etc.
```

### Adjust Clustering

**File:** `scripts/compute-similarity-metadata.js` (line 115)
```javascript
const MIN_SIMILARITY = 0.25;  // Higher = more distinct clusters
```

### Make Dots Bigger

**File:** `src/lib/renderer.js` (line 173)
```javascript
this.sizes[i] = 8 + normalizedPop * 12;  // Increase 8 and 12
```

Then refresh browser - Vite will hot reload!

---

## Common Issues

### "No data showing"
```bash
# Copy data to public folder
cp data/processed/layout.compact.json public/data/processed/
# Hard refresh browser (Ctrl+Shift+R)
```

### "All dots same color"
```bash
# Increase similarity threshold
# Edit scripts/compute-similarity-metadata.js line 115
const MIN_SIMILARITY = 0.30;  # Higher value

# Regenerate
npm run compute && npm run layout
cp data/processed/layout.compact.json public/data/processed/
```

### "Dots too small"
```javascript
// Edit src/lib/renderer.js line 173
this.sizes[i] = 12 + normalizedPop * 20;
// Refresh browser
```

---

## Usage Tips

### Search
- Type anime name in search box
- Click result to focus on it

### Navigation
- **Scroll**: Zoom in/out
- **Drag**: Pan around
- **Click**: Select and focus anime
- **Hover**: View details

### Visual Guide
- **Colors**: Different genres (Action=red, Mystery=blue, etc.)
- **Size**: Popularity (bigger = more popular)
- **Position**: Similarity (closer = more similar)

---

## What You Get

**Your visualization shows:**
- 1500 most popular anime
- Clustered by genre and similarity
- 12+ color-coded communities
- Interactive zoom, pan, search
- Real-time hover details

**Example clusters you'll see:**
- Action/Shonen cluster (red/orange)
- Psychological/Mystery cluster (blue/purple)
- Romance/Drama cluster (pink/purple)
- Comedy/Slice of Life cluster (green/yellow)

---

## Next Steps

- **Read WORKFLOW.md** for detailed documentation
- **Customize** similarity weights and layout
- **Export** images or share your map
- **Extend** with more features

---

## Full Documentation

- **WORKFLOW.md**: Complete technical documentation
- **README.md**: Project overview and features
- **package.json**: All available npm scripts

---

## Need Help?

1. Check WORKFLOW.md troubleshooting section
2. Run `node check-data.js` to verify data
3. Check browser console (F12) for errors
4. Open an issue on GitHub

---

## Performance Tips

**For faster processing:**
- Reduce anime count to 500
- Lower layout iterations to 300
- Increase API delay if getting rate limited

**For better visualization:**
- Increase similarity threshold (0.30+)
- More layout iterations (700+)
- Adjust dot sizes and colors

---

Made with ❤️ inspired by [map-of-reddit](https://github.com/anvaka/map-of-reddit)
