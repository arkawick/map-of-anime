const fs = require('fs').promises;
const path = require('path');

const RAW_DIR = path.join(__dirname, '../data/raw');
const PROCESSED_DIR = path.join(__dirname, '../data/processed');

// Jaccard similarity coefficient
function jaccardSimilarity(setA, setB) {
  const intersection = setA.filter(item => setB.includes(item));
  const union = new Set([...setA, ...setB]);
  return intersection.length / union.size;
}

// Compute similarity between all anime pairs
async function computeSimilarities(animeUsers) {
  console.log('Computing similarities between anime...');
  const animeIds = Object.keys(animeUsers);
  const similarities = [];
  let processed = 0;
  const total = (animeIds.length * (animeIds.length - 1)) / 2;

  // Minimum threshold for creating an edge
  const MIN_SIMILARITY = 0.05; // 5% shared users
  const MIN_SHARED_USERS = 10; // At least 10 shared users

  for (let i = 0; i < animeIds.length; i++) {
    const animeA = animeUsers[animeIds[i]];
    const usersA = animeA.users;

    // Skip anime with too few users
    if (usersA.length < 20) continue;

    for (let j = i + 1; j < animeIds.length; j++) {
      const animeB = animeUsers[animeIds[j]];
      const usersB = animeB.users;

      // Skip anime with too few users
      if (usersB.length < 20) continue;

      const similarity = jaccardSimilarity(usersA, usersB);
      const sharedUsers = usersA.filter(u => usersB.includes(u)).length;

      if (similarity >= MIN_SIMILARITY && sharedUsers >= MIN_SHARED_USERS) {
        similarities.push({
          source: animeA.id,
          target: animeB.id,
          weight: similarity,
          sharedUsers: sharedUsers
        });
      }

      processed++;
      if (processed % 100000 === 0) {
        console.log(`Processed ${processed}/${total} pairs (${((processed/total)*100).toFixed(1)}%)`);
        console.log(`Found ${similarities.length} edges so far`);
      }
    }
  }

  console.log(`\nCompleted! Found ${similarities.length} edges above threshold.`);
  return similarities;
}

// Build graph structure
function buildGraph(animeUsers, edges) {
  console.log('\nBuilding graph structure...');

  // Create nodes
  const nodes = Object.values(animeUsers).map(anime => ({
    id: anime.id,
    title: anime.title.romaji || anime.title.english || anime.title.native,
    englishTitle: anime.title.english,
    genres: anime.genres,
    popularity: anime.popularity,
    userCount: anime.users.length
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

// Detect communities using simple label propagation
function detectCommunities(graph) {
  console.log('\nDetecting communities...');

  // Create adjacency list
  const adjacency = new Map();
  graph.nodes.forEach(node => {
    adjacency.set(node.id, []);
  });

  graph.edges.forEach(edge => {
    adjacency.get(edge.source).push({ id: edge.target, weight: edge.weight });
    adjacency.get(edge.target).push({ id: edge.source, weight: edge.weight });
  });

  // Initialize each node with its own community
  const communities = new Map();
  graph.nodes.forEach(node => {
    communities.set(node.id, node.id);
  });

  // Label propagation
  let changed = true;
  let iterations = 0;
  const maxIterations = 10;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const node of graph.nodes) {
      const neighbors = adjacency.get(node.id);
      if (neighbors.length === 0) continue;

      // Count community weights
      const communityWeights = new Map();
      neighbors.forEach(neighbor => {
        const comm = communities.get(neighbor.id);
        const currentWeight = communityWeights.get(comm) || 0;
        communityWeights.set(comm, currentWeight + neighbor.weight);
      });

      // Find most common community
      let maxWeight = 0;
      let bestCommunity = communities.get(node.id);

      for (const [comm, weight] of communityWeights) {
        if (weight > maxWeight) {
          maxWeight = weight;
          bestCommunity = comm;
        }
      }

      if (bestCommunity !== communities.get(node.id)) {
        communities.set(node.id, bestCommunity);
        changed = true;
      }
    }

    console.log(`Iteration ${iterations}: communities updated`);
  }

  // Assign community to nodes
  const communityMap = new Map();
  let communityId = 0;
  const communityIds = new Map();

  graph.nodes.forEach(node => {
    const comm = communities.get(node.id);
    if (!communityIds.has(comm)) {
      communityIds.set(comm, communityId++);
    }
    node.community = communityIds.get(comm);

    if (!communityMap.has(node.community)) {
      communityMap.set(node.community, []);
    }
    communityMap.get(node.community).push(node);
  });

  console.log(`Detected ${communityIds.size} communities`);

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
    });
  }

  return communityLabels;
}

async function main() {
  console.log('=== Map of Anime Similarity Computation ===\n');

  // Ensure output directory exists
  await fs.mkdir(PROCESSED_DIR, { recursive: true });

  // Load anime user data
  const animeUsersPath = path.join(RAW_DIR, 'anime_users.json');
  console.log('Loading anime user data...');
  const animeUsersData = await fs.readFile(animeUsersPath, 'utf-8');
  const animeUsers = JSON.parse(animeUsersData);

  console.log(`Loaded ${Object.keys(animeUsers).length} anime with user data.\n`);

  // Compute similarities
  const edges = await computeSimilarities(animeUsers);

  // Build graph
  const graph = buildGraph(animeUsers, edges);

  // Save graph
  await fs.writeFile(
    path.join(PROCESSED_DIR, 'graph.json'),
    JSON.stringify(graph, null, 2)
  );

  // Detect and label communities
  const communities = detectCommunities(graph);
  await fs.writeFile(
    path.join(PROCESSED_DIR, 'communities.json'),
    JSON.stringify(communities, null, 2)
  );

  console.log('\n=== Similarity computation complete! ===');
  console.log('Next step: Run "npm run layout" to generate positions');
}

main().catch(console.error);
