const fs = require('fs').promises;
const path = require('path');

const RAW_DIR = path.join(__dirname, '../data/raw');
const PROCESSED_DIR = path.join(__dirname, '../data/processed');

// Jaccard similarity coefficient
function jaccardSimilarity(setA, setB) {
  if (setA.length === 0 && setB.length === 0) return 0;
  const intersection = setA.filter(item => setB.includes(item));
  const union = new Set([...setA, ...setB]);
  return intersection.length / union.size;
}

// Weighted tag similarity (using tag rank)
function tagSimilarity(tagsA, tagsB) {
  const tagMapA = new Map(tagsA.map(t => [t.name, t.rank]));
  const tagMapB = new Map(tagsB.map(t => [t.name, t.rank]));

  const allTags = new Set([...tagMapA.keys(), ...tagMapB.keys()]);
  let totalWeight = 0;
  let matchWeight = 0;

  for (const tag of allTags) {
    const rankA = tagMapA.get(tag) || 0;
    const rankB = tagMapB.get(tag) || 0;
    const maxRank = Math.max(rankA, rankB);

    totalWeight += maxRank;
    if (rankA > 0 && rankB > 0) {
      matchWeight += Math.min(rankA, rankB);
    }
  }

  return totalWeight > 0 ? matchWeight / totalWeight : 0;
}

// Compute comprehensive similarity between two anime
function computeAnimeSimilarity(animeA, animeB) {
  let similarity = 0;
  let weights = 0;

  // 1. Genre similarity (weight: 3.0)
  if (animeA.genres?.length > 0 && animeB.genres?.length > 0) {
    const genreSim = jaccardSimilarity(animeA.genres, animeB.genres);
    similarity += genreSim * 3.0;
    weights += 3.0;
  }

  // 2. Tag similarity (weight: 2.5)
  if (animeA.tags?.length > 0 && animeB.tags?.length > 0) {
    // Filter out spoiler tags
    const tagsA = animeA.tags.filter(t => !t.isMediaSpoiler);
    const tagsB = animeB.tags.filter(t => !t.isMediaSpoiler);

    if (tagsA.length > 0 && tagsB.length > 0) {
      const tagSim = tagSimilarity(tagsA, tagsB);
      similarity += tagSim * 2.5;
      weights += 2.5;
    }
  }

  // 3. Studio similarity (weight: 1.5)
  const studiosA = animeA.studios?.nodes?.map(s => s.id) || [];
  const studiosB = animeB.studios?.nodes?.map(s => s.id) || [];
  if (studiosA.length > 0 && studiosB.length > 0) {
    const studioSim = jaccardSimilarity(studiosA, studiosB);
    similarity += studioSim * 1.5;
    weights += 1.5;
  }

  // 4. Staff similarity (weight: 1.0)
  const staffA = animeA.staff?.edges?.map(s => s.node.id) || [];
  const staffB = animeB.staff?.edges?.map(s => s.node.id) || [];
  if (staffA.length > 0 && staffB.length > 0) {
    const staffSim = jaccardSimilarity(staffA, staffB);
    similarity += staffSim * 1.0;
    weights += 1.0;
  }

  // 5. Format match (weight: 0.5)
  if (animeA.format && animeB.format && animeA.format === animeB.format) {
    similarity += 0.5;
    weights += 0.5;
  }

  // 6. Season proximity (weight: 0.3)
  if (animeA.seasonYear && animeB.seasonYear) {
    const yearDiff = Math.abs(animeA.seasonYear - animeB.seasonYear);
    if (yearDiff <= 2) {
      const seasonSim = (3 - yearDiff) / 3;
      similarity += seasonSim * 0.3;
      weights += 0.3;
    }
  }

  // 7. Direct relations (weight: 2.0)
  const relationsA = animeA.relations?.edges?.map(r => r.node.id) || [];
  if (relationsA.includes(animeB.id)) {
    similarity += 2.0;
    weights += 2.0;
  }

  return weights > 0 ? similarity / weights : 0;
}

// Compute similarities between all anime pairs
async function computeSimilarities(animeList) {
  console.log('Computing similarities based on metadata...');
  const similarities = [];
  let processed = 0;
  const total = (animeList.length * (animeList.length - 1)) / 2;

  // Minimum threshold for creating an edge
  const MIN_SIMILARITY = 0.25; // 25% similarity threshold (higher = more distinct communities)

  for (let i = 0; i < animeList.length; i++) {
    const animeA = animeList[i];

    for (let j = i + 1; j < animeList.length; j++) {
      const animeB = animeList[j];

      const similarity = computeAnimeSimilarity(animeA, animeB);

      if (similarity >= MIN_SIMILARITY) {
        similarities.push({
          source: animeA.id,
          target: animeB.id,
          weight: similarity
        });
      }

      processed++;
      if (processed % 10000 === 0) {
        const percent = ((processed / total) * 100).toFixed(1);
        console.log(`Processed ${processed}/${total} pairs (${percent}%)`);
        console.log(`Found ${similarities.length} edges so far`);
      }
    }
  }

  console.log(`\nCompleted! Found ${similarities.length} edges above threshold.`);
  return similarities;
}

// Build graph structure
function buildGraph(animeList, edges) {
  console.log('\nBuilding graph structure...');

  // Create nodes
  const nodes = animeList.map(anime => ({
    id: anime.id,
    title: anime.title.romaji || anime.title.english || anime.title.native,
    englishTitle: anime.title.english,
    genres: anime.genres || [],
    popularity: anime.popularity,
    averageScore: anime.averageScore,
    format: anime.format,
    seasonYear: anime.seasonYear
  }));

  // Filter to only include nodes that have edges
  const nodeIds = new Set();
  edges.forEach(edge => {
    nodeIds.add(edge.source);
    nodeIds.add(edge.target);
  });

  const connectedNodes = nodes.filter(node => nodeIds.has(node.id));

  console.log(`Graph has ${connectedNodes.length} nodes and ${edges.length} edges`);

  return {
    nodes: connectedNodes,
    edges: edges
  };
}

// Detect communities using primary genre
function detectCommunities(graph) {
  console.log('\nDetecting communities based on primary genres...');

  // Map genres to community IDs
  const genreToCommunity = new Map();
  const communityMap = new Map();
  let communityId = 0;

  // Primary genres to create distinct communities
  const primaryGenres = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy',
    'Horror', 'Mystery', 'Psychological', 'Romance', 'Sci-Fi',
    'Slice of Life', 'Sports', 'Supernatural', 'Thriller', 'Mecha'
  ];

  // Assign community IDs to primary genres
  primaryGenres.forEach(genre => {
    genreToCommunity.set(genre, communityId);
    communityMap.set(communityId, []);
    communityId++;
  });

  // Default community for others
  const defaultCommunity = communityId;
  communityMap.set(defaultCommunity, []);

  // Assign each anime to a community based on its primary genre
  graph.nodes.forEach(node => {
    if (node.genres && node.genres.length > 0) {
      // Find first matching primary genre
      let assigned = false;
      for (const genre of node.genres) {
        if (genreToCommunity.has(genre)) {
          node.community = genreToCommunity.get(genre);
          communityMap.get(node.community).push(node);
          assigned = true;
          break;
        }
      }

      // If no primary genre match, use default
      if (!assigned) {
        node.community = defaultCommunity;
        communityMap.get(defaultCommunity).push(node);
      }
    } else {
      node.community = defaultCommunity;
      communityMap.get(defaultCommunity).push(node);
    }
  });

  console.log(`Detected ${communityMap.size} communities`);

  // Label communities by most common genre
  const communityLabels = [];
  for (const [commId, nodes] of communityMap) {
    const genreCounts = new Map();
    nodes.forEach(node => {
      node.genres.forEach(genre => {
        genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
      });
    });

    const sortedGenres = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1]);

    communityLabels.push({
      id: commId,
      primaryGenre: sortedGenres[0]?.[0] || 'Unknown',
      size: nodes.length,
      topAnime: nodes.sort((a, b) => b.popularity - a.popularity).slice(0, 5)
        .map(a => a.title)
    });
  }

  return communityLabels;
}

async function main() {
  console.log('=== Map of Anime - Metadata-Based Similarity ===\n');

  // Ensure output directory exists
  await fs.mkdir(PROCESSED_DIR, { recursive: true });

  // Load anime metadata
  const metadataPath = path.join(RAW_DIR, 'anime_metadata.json');
  console.log('Loading anime metadata...');

  let animeList;
  try {
    const metadataData = await fs.readFile(metadataPath, 'utf-8');
    animeList = JSON.parse(metadataData);
  } catch (error) {
    console.error('Error: anime_metadata.json not found!');
    console.log('Please run: npm run collect:metadata first');
    process.exit(1);
  }

  console.log(`Loaded ${animeList.length} anime with metadata.\n`);

  // Compute similarities
  const edges = await computeSimilarities(animeList);

  // Build graph
  const graph = buildGraph(animeList, edges);

  // Detect and label communities (modifies graph.nodes to add community field)
  const communities = detectCommunities(graph);

  // Save graph (after community detection)
  await fs.writeFile(
    path.join(PROCESSED_DIR, 'graph.json'),
    JSON.stringify(graph, null, 2)
  );

  // Save community labels
  await fs.writeFile(
    path.join(PROCESSED_DIR, 'communities.json'),
    JSON.stringify(communities, null, 2)
  );

  console.log('\n=== Similarity computation complete! ===');
  console.log('Next step: Run "npm run layout" to generate positions');
}

main().catch(console.error);
