# Quick Start Guide

Get your anime map running in **5 minutes** or less!

## ⚡ TL;DR

```bash
# Install
npm install

# Run with existing data (30 sec)
npm run dev
```

**OR** generate fresh data:

```bash
# Collect (~15 min)
npm run collect

# Compute (~3 min)
npm run compute

# Layout (~2 min)
node scripts/generate-layout-hierarchical.js

# Copy data
cp data/processed/layout.compact.json public/data/processed/

# Run
npm run dev
```

Then open **http://localhost:3000** 🎉

---

## 📦 Prerequisites

- **Node.js 14+** - [Download here](https://nodejs.org/)
- **2GB free space** - For anime data
- **Modern browser** - Chrome, Firefox, Edge, Safari

---

## 🚀 Installation (30 seconds)

```bash
# Clone repository
git clone <your-repo-url>
cd map-of-anime

# Install dependencies
npm install
```

Done! Now choose your path:

---

## Path A: Use Existing Data (Fast)

**Best for**: Testing, development, quick demo

**Time**: 30 seconds

If you already have `public/data/processed/layout.compact.json`:

```bash
npm run dev
```

Open **http://localhost:3000** (or URL shown in terminal)

✅ **Skip to [Using the Map](#using-the-map)**

---

## Path B: Generate Fresh Data (Complete)

**Best for**: Production, latest data, customization

**Time**: ~20 minutes total

### Step 1: Collect Anime Data (15 min)

```bash
npm run collect
```

What it does:
- Fetches 5,000 most popular anime from AniList
- Gets titles, images, descriptions, recommendations
- Saves to `data/raw/anime_recommendations.json`

**Progress bar shown. Can be interrupted and resumed.**

### Step 2: Compute Similarity Graph (3 min)

```bash
npm run compute
```

What it does:
- Builds recommendation graph
- Detects 25+ communities (Louvain algorithm)
- Saves to `data/processed/graph.json`

### Step 3: Generate Layout (2 min)

```bash
node scripts/generate-layout-hierarchical.js
```

What it does:
- Runs 4-tier hierarchical layout
- Assigns colors to communities
- Positions 4,584 anime in 20000×20000 world
- Saves to `data/processed/layout.compact.json`

### Step 4: Copy to Public Folder

```bash
# Mac/Linux
cp data/processed/layout.compact.json public/data/processed/

# Windows
copy data\processed\layout.compact.json public\data\processed\
```

### Step 5: Start Server

```bash
npm run dev
```

Open the URL shown in terminal!

---

## 🎮 Using the Map

### Controls

| Action | How To |
|--------|--------|
| **Zoom** | Scroll wheel |
| **Pan** | Click + drag |
| **Preview** | Hover over dot |
| **Details** | Click dot |
| **Search** | Type in top-right box |
| **Reset** | Click "Reset View" button |
| **Close panel** | Click X or same anime again |

### Quick Tips

1. **Start zoomed out** - See colored communities
2. **Search your favorites** - Find specific anime instantly
3. **Explore clusters** - Similar anime are grouped together
4. **Click for details** - Full info appears on left
5. **Hover while browsing** - Tooltip still works!

### What You're Seeing

- **Colors** = Different communities (genre/theme clusters)
- **Size** = Popularity (bigger = more popular)
- **Position** = Similarity (closer = more similar viewers)

---

## ⚙️ Quick Customization

### Want Fewer/More Anime?

Edit `scripts/collect-data-recommendations.js` **line 9**:

```javascript
const MAX_ANIME = 5000;  // Change this number
```

**Values:**
- 500 = Quick test (3 min)
- 1000 = Small dataset (5 min)
- 2500 = Medium (10 min)
- 5000 = Default (20 min)
- 10000 = Large (40 min)

Then re-run steps 1-5.

### Want Different Colors?

Edit `src/lib/renderer-production.js` **line 26**:

```javascript
this.BACKGROUND_COLOR = 0x000000;  // Black
// Try: 0x2c2620 (brown), 0x1a1a2e (blue)
```

Refresh browser to see changes.

### Want Bigger/Smaller Dots?

Edit `src/lib/renderer-production.js` **line 25**:

```javascript
this.NODE_BASE_SIZE = 400;  // Default
// Try: 200 (smaller), 800 (larger)
```

Refresh browser.

---

## 🐛 Common Issues

### Issue: "Failed to load data"

**Cause**: Missing data file

**Fix**:
```bash
cp data/processed/layout.compact.json public/data/processed/
```

### Issue: Map is blank on load

**Cause**: Browser cache

**Fix**: Hard refresh
- Windows/Linux: `Ctrl + Shift + R`
- Mac: `Cmd + Shift + R`

### Issue: Collection too slow

**Cause**: Default 5,000 anime takes time

**Fix**: Reduce anime count
```javascript
// scripts/collect-data-recommendations.js line 9
const MAX_ANIME = 1000;  // Faster
```

### Issue: Rate limiting errors (429)

**Cause**: Too many requests to AniList

**Fix**: Increase delay
```javascript
// scripts/collect-data-recommendations.js line 8
const DELAY_MS = 1000;  // Increase from 800
```

### Issue: Out of memory

**Cause**: Large dataset, low RAM

**Fix**: Reduce anime or increase Node memory
```bash
node --max-old-space-size=4096 scripts/collect-data-recommendations.js
```

---

## 📊 What Gets Collected

For each anime:
- ✅ Title (romaji + English)
- ✅ Cover image (large)
- ✅ Description/synopsis
- ✅ Genres
- ✅ Popularity
- ✅ Top 25 recommendations

---

## 🎯 Performance

- **Rendering**: 60 FPS with 1000 visible nodes
- **Load time**: <1 second for 4,584 anime
- **Memory**: ~150 MB
- **Works on**: Any modern laptop/desktop

---

## 📚 Next Steps

**For more control:**
- **[CONFIGURATION.md](CONFIGURATION.md)** - All settings explained
- **[README.md](README.md)** - Full documentation

**For development:**
- **Build for production**: `npm run build`
- **Preview build**: `npm run preview`

**For help:**
- **GitHub Issues** - Report bugs
- **Check browser console** (F12) - See errors

---

## 💡 Pro Tips

1. **Search is powerful** - Type partial names, works with English or Japanese
2. **Communities are smart** - Action anime cluster together, romance together, etc.
3. **Hover works everywhere** - Even when detail panel is open
4. **Detail panel movable** - Check CONFIGURATION.md to move it
5. **Zoom in for clarity** - See individual anime better

---

## 🎨 Example Clusters You'll See

- **Shonen Action** - Naruto, One Piece, Dragon Ball (orange/red)
- **Psychological Thriller** - Death Note, Steins;Gate (blue/purple)
- **Romance/Drama** - Your Name, Clannad (pink)
- **Slice of Life** - K-On!, Nichijou (green)
- **Sci-Fi** - Cowboy Bebop, Ghost in the Shell (cyan)

---

## That's It!

You're ready to explore the anime universe! 🌟

**Questions?** Check [README.md](README.md) or open an issue.

**Happy exploring!** 🎉
