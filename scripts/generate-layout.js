const fs = require('fs').promises;
const path = require('path');
const Graph = require('graphology');
const forceAtlas2 = require('graphology-layout-forceatlas2');

const PROCESSED_DIR = path.join(__dirname, '../data/processed');

async function generateLayout() {
  console.log('=== Map of Anime Layout Generation ===\n');

  // Load graph data
  console.log('Loading graph data...');
  const graphData = JSON.parse(
    await fs.readFile(path.join(PROCESSED_DIR, 'graph.json'), 'utf-8')
  );

  console.log(`Graph has ${graphData.nodes.length} nodes and ${graphData.edges.length} edges`);

  // Create graphology instance
  const graph = new Graph();

  // Add nodes
  console.log('Adding nodes to graph...');
  graphData.nodes.forEach(node => {
    graph.addNode(node.id, {
      ...node,
      x: Math.random() * 1000,
      y: Math.random() * 1000
    });
  });

  // Add edges
  console.log('Adding edges to graph...');
  graphData.edges.forEach((edge, index) => {
    try {
      graph.addEdge(edge.source, edge.target, {
        weight: edge.weight
      });
    } catch (err) {
      // Skip duplicate edges or edges with missing nodes
    }
  });

  console.log(`Graph initialized with ${graph.order} nodes and ${graph.size} edges\n`);

  // Run ForceAtlas2 layout
  console.log('Running ForceAtlas2 layout algorithm...');
  console.log('This may take several minutes for large graphs...\n');

  const settings = {
    iterations: 500,
    settings: {
      barnesHutOptimize: true,
      strongGravityMode: false,
      gravity: 0.05,
      scalingRatio: 10,
      slowDown: 1,
      linLogMode: false,
      outboundAttractionDistribution: false,
      adjustSizes: false,
      edgeWeightInfluence: 1
    }
  };

  // Run layout with progress updates
  const iterationsPerBatch = 50;
  for (let i = 0; i < settings.iterations; i += iterationsPerBatch) {
    forceAtlas2.assign(graph, {
      iterations: iterationsPerBatch,
      settings: settings.settings
    });
    console.log(`Completed ${i + iterationsPerBatch}/${settings.iterations} iterations`);
  }

  console.log('\nLayout computation complete!');

  // Normalize coordinates
  console.log('Normalizing coordinates...');
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  graph.forEachNode((node, attrs) => {
    minX = Math.min(minX, attrs.x);
    maxX = Math.max(maxX, attrs.x);
    minY = Math.min(minY, attrs.y);
    maxY = Math.max(maxY, attrs.y);
  });

  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  const scale = 10000; // Scale to 10000x10000 space

  // Extract positioned nodes
  const positionedNodes = [];
  graph.forEachNode((nodeId, attrs) => {
    positionedNodes.push({
      id: attrs.id,
      title: attrs.title,
      englishTitle: attrs.englishTitle,
      genres: attrs.genres,
      popularity: attrs.popularity,
      userCount: attrs.userCount,
      community: attrs.community,
      x: ((attrs.x - minX) / rangeX) * scale,
      y: ((attrs.y - minY) / rangeY) * scale
    });
  });

  // Save positioned graph
  const output = {
    nodes: positionedNodes,
    edges: graphData.edges,
    bounds: {
      width: scale,
      height: scale
    }
  };

  await fs.writeFile(
    path.join(PROCESSED_DIR, 'layout.json'),
    JSON.stringify(output, null, 2)
  );

  console.log(`\nSaved layout with ${positionedNodes.length} positioned nodes`);

  // Generate compact version for web (remove less important data)
  const compactNodes = positionedNodes.map(node => ({
    id: node.id,
    t: node.title,
    et: node.englishTitle,
    g: node.genres,
    p: node.popularity,
    c: node.community,
    x: Math.round(node.x),
    y: Math.round(node.y)
  }));

  const compactEdges = graphData.edges.map(edge => [
    edge.source,
    edge.target,
    Math.round(edge.weight * 1000) / 1000
  ]);

  const compactOutput = {
    nodes: compactNodes,
    edges: compactEdges,
    bounds: output.bounds
  };

  await fs.writeFile(
    path.join(PROCESSED_DIR, 'layout.compact.json'),
    JSON.stringify(compactOutput)
  );

  console.log(`Saved compact layout (${JSON.stringify(compactOutput).length} bytes)`);

  console.log('\n=== Layout generation complete! ===');
  console.log('Next step: Run "npm run dev" to view the visualization');
}

generateLayout().catch(console.error);
