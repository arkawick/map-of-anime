const fs = require('fs').promises;
const path = require('path');
const Graph = require('graphology');
const louvain = require('graphology-communities-louvain');

const RAW_DIR = path.join(__dirname, '../data/raw');
const PROCESSED_DIR = path.join(__dirname, '../data/processed');

// Build graph from recommendation data
function buildRecommendationGraph(animeList) {
  console.log('Building recommendation graph...');

  const graph = new Graph({ type: 'undirected' });
  const animeMap = new Map(animeList.map(a => [a.id, a]));

  // Add all anime as nodes
  animeList.forEach(anime => {
    graph.addNode(anime.id, {
      title: anime.title.romaji || anime.title.english || anime.title.native,
      englishTitle: anime.title.english,
      genres: anime.genres || [],
      popularity: anime.popularity,
      averageScore: anime.averageScore,
      format: anime.format,
      seasonYear: anime.seasonYear,
      coverImage: anime.coverImage?.large || anime.coverImage?.medium,
      description: anime.description
    });
  });

  // Add edges based on recommendations
  let edgeCount = 0;
  const MIN_RATING = 0; // Include all recommendations

  animeList.forEach(anime => {
    if (!anime.recommendations?.edges) return;

    anime.recommendations.edges.forEach(edge => {
      const recAnime = edge.node?.mediaRecommendation;
      if (!recAnime || !recAnime.id) return;

      const rating = edge.node.rating || 0;
      if (rating < MIN_RATING) return;

      // Only add edge if both nodes exist
      if (animeMap.has(recAnime.id) && graph.hasNode(anime.id) && graph.hasNode(recAnime.id)) {
        try {
          // Avoid duplicate edges
          if (!graph.hasEdge(anime.id, recAnime.id)) {
            // Weight based on recommendation rating
            const weight = Math.max(1, rating / 100);
            graph.addEdge(anime.id, recAnime.id, { weight });
            edgeCount++;
          } else {
            // If edge exists, update weight to maximum
            const existingWeight = graph.getEdgeAttribute(anime.id, recAnime.id, 'weight');
            const newWeight = Math.max(1, rating / 100);
            if (newWeight > existingWeight) {
              graph.setEdgeAttribute(anime.id, recAnime.id, 'weight', newWeight);
            }
          }
        } catch (error) {
          // Edge might already exist from reverse direction
        }
      }
    });
  });

  console.log(`Graph has ${graph.order} nodes and ${graph.size} edges`);

  // Remove isolated nodes (nodes with no connections)
  const isolatedNodes = [];
  graph.forEachNode((node, attributes) => {
    if (graph.degree(node) === 0) {
      isolatedNodes.push(node);
    }
  });

  if (isolatedNodes.length > 0) {
    console.log(`Removing ${isolatedNodes.length} isolated nodes...`);
    isolatedNodes.forEach(node => graph.dropNode(node));
  }

  console.log(`Final graph: ${graph.order} nodes, ${graph.size} edges`);

  return graph;
}

// Detect communities using Louvain method (multi-level modularity optimization)
function detectCommunities(graph) {
  console.log('\nDetecting communities using Louvain algorithm...');
  console.log('(Multi-level modularity optimization)');

  // Run Louvain community detection
  const communities = louvain(graph, {
    getEdgeWeight: 'weight',
    resolution: 1.0 // Default resolution, can be adjusted
  });

  // Assign communities to nodes
  graph.forEachNode((node, attributes) => {
    graph.setNodeAttribute(node, 'community', communities[node]);
  });

  // Count communities and their sizes
  const communitySizes = new Map();
  graph.forEachNode((node) => {
    const community = graph.getNodeAttribute(node, 'community');
    communitySizes.set(community, (communitySizes.get(community) || 0) + 1);
  });

  console.log(`Detected ${communitySizes.size} communities`);

  // Find top anime in each community
  const communityData = [];
  for (const [commId, size] of communitySizes) {
    const nodes = [];
    const genreCounts = new Map();

    graph.forEachNode((node, attributes) => {
      if (graph.getNodeAttribute(node, 'community') === commId) {
        nodes.push({
          id: node,
          title: attributes.title,
          popularity: attributes.popularity,
          genres: attributes.genres
        });

        // Count genres
        (attributes.genres || []).forEach(genre => {
          genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
        });
      }
    });

    // Sort by popularity
    nodes.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));

    // Find primary genre
    const sortedGenres = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1]);

    communityData.push({
      id: commId,
      size: size,
      primaryGenre: sortedGenres[0]?.[0] || 'Unknown',
      topGenres: sortedGenres.slice(0, 3).map(g => g[0]),
      topAnime: nodes.slice(0, 5).map(a => a.title)
    });
  }

  // Sort by size
  communityData.sort((a, b) => b.size - a.size);

  console.log('\nTop 10 communities:');
  communityData.slice(0, 10).forEach((comm, i) => {
    console.log(`${i + 1}. Community ${comm.id}: ${comm.size} anime`);
    console.log(`   Primary genre: ${comm.primaryGenre}`);
    console.log(`   Top anime: ${comm.topAnime.slice(0, 3).join(', ')}`);
  });

  return communityData;
}

// Convert graphology graph to JSON format
function graphToJSON(graph) {
  const nodes = [];
  const edges = [];

  graph.forEachNode((node, attributes) => {
    nodes.push({
      id: node,
      title: attributes.title,
      englishTitle: attributes.englishTitle,
      genres: attributes.genres,
      popularity: attributes.popularity,
      averageScore: attributes.averageScore,
      format: attributes.format,
      seasonYear: attributes.seasonYear,
      community: attributes.community,
      coverImage: attributes.coverImage,
      description: attributes.description
    });
  });

  graph.forEachEdge((edge, attributes, source, target) => {
    edges.push({
      source: parseInt(source),
      target: parseInt(target),
      weight: attributes.weight
    });
  });

  return { nodes, edges };
}

async function main() {
  console.log('=== Map of Anime - Recommendation-Based Similarity ===\n');

  // Ensure output directory exists
  await fs.mkdir(PROCESSED_DIR, { recursive: true });

  // Load anime with recommendations
  const recommendationsPath = path.join(RAW_DIR, 'anime_recommendations.json');
  console.log('Loading anime recommendations...');

  let animeList;
  try {
    const data = await fs.readFile(recommendationsPath, 'utf-8');
    animeList = JSON.parse(data);
  } catch (error) {
    console.error('Error: anime_recommendations.json not found!');
    console.log('Please run the new collection script first');
    process.exit(1);
  }

  console.log(`Loaded ${animeList.length} anime with recommendations.\n`);

  // Build graph from recommendations
  const graph = buildRecommendationGraph(animeList);

  // Detect communities using Louvain
  const communities = detectCommunities(graph);

  // Convert to JSON
  const graphJSON = graphToJSON(graph);

  console.log(`\nFinal output: ${graphJSON.nodes.length} nodes, ${graphJSON.edges.length} edges`);

  // Save graph
  await fs.writeFile(
    path.join(PROCESSED_DIR, 'graph.json'),
    JSON.stringify(graphJSON, null, 2)
  );

  // Save community data
  await fs.writeFile(
    path.join(PROCESSED_DIR, 'communities.json'),
    JSON.stringify(communities, null, 2)
  );

  console.log('\n=== Similarity computation complete! ===');
  console.log('Files saved:');
  console.log('  - data/processed/graph.json');
  console.log('  - data/processed/communities.json');
  console.log('\nNext step: Run "npm run layout" to generate positions');
}

main().catch(console.error);
