const fs = require('fs').promises;
const path = require('path');
const { forceSimulation, forceLink, forceManyBody, forceCenter } = require('d3-force');
const _ = require('lodash');

const PROCESSED_DIR = path.join(__dirname, '../data/processed');

class LayoutNode {
  constructor(id, clusterId, tier) {
    this.id = id;
    this.clusterId = clusterId;
    this.tier = tier;
    this.x = 0;
    this.y = 0;
    this.hue = 0;
  }

  norm() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
}

class HierarchicalLayout {
  constructor(graph, communities) {
    this.graph = graph;
    this.communities = communities;
    this.currentTier = 0;
    this.maxTier = 3; // Number of hierarchical levels
    this.simulation = null;
    this.nodesByCommunity = this.buildCommunityMap();
    this.targetDensity = 0.00005; // Lower = more spread out
  }

  buildCommunityMap() {
    const map = {};
    this.graph.nodes.forEach(node => {
      const comm = node.community;
      if (!map[comm]) map[comm] = [];
      map[comm].push(node);
    });
    return map;
  }

  assignHues(nodes) {
    // Assign evenly distributed hues around the color wheel
    const sorted = _.sortBy(nodes, n => {
      const comm = this.nodesByCommunity[n.clusterId];
      return comm ? comm.length : 0;
    }).reverse();

    // Shuffle all but the two largest for better color distribution
    const shuffled = sorted.slice(0, 2).concat(_.shuffle(sorted.slice(2)));

    // Swap second with middle for better contrast
    if (shuffled.length > 2) {
      const mid = Math.floor(shuffled.length / 2);
      [shuffled[1], shuffled[mid]] = [shuffled[mid], shuffled[1]];
    }

    shuffled.forEach((node, i) => {
      node.hue = (360 * i / shuffled.length) % 360;
    });
  }

  createInitialNodes() {
    // Start with one node per community
    const communities = Object.keys(this.nodesByCommunity);
    const nodes = communities.map(comm =>
      new LayoutNode(parseInt(comm), parseInt(comm), 0)
    );

    this.assignHues(nodes);
    return nodes;
  }

  subdivideNodes(oldNodes) {
    // Each community node subdivides based on sub-communities
    // For simplicity, we'll create multiple nodes per community
    const newNodes = [];
    const nodesPerCommunity = Math.pow(2, this.currentTier + 1);

    oldNodes.forEach(parentNode => {
      const members = this.nodesByCommunity[parentNode.clusterId] || [];
      const subgroups = Math.min(nodesPerCommunity, Math.ceil(members.length / 50));

      for (let i = 0; i < subgroups; i++) {
        const nodeId = parentNode.clusterId * 1000 + i;
        const node = new LayoutNode(nodeId, parentNode.clusterId, this.currentTier);

        // Start near parent with small jitter
        node.x = parentNode.x + (Math.random() - 0.5) * 50;
        node.y = parentNode.y + (Math.random() - 0.5) * 50;
        node.hue = parentNode.hue;

        newNodes.push(node);
      }
    });

    return newNodes;
  }

  createEdges(nodes) {
    const edges = [];
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    // Create edges between nodes in different communities
    this.graph.edges.forEach(edge => {
      let sourceComm, targetComm;

      if (Array.isArray(edge)) {
        [sourceComm, targetComm] = edge;
      } else {
        sourceComm = edge.source;
        targetComm = edge.target;
      }

      const sourceNode = this.graph.nodes.find(n =>
        (n.id === sourceComm || String(n.id) === String(sourceComm))
      );
      const targetNode = this.graph.nodes.find(n =>
        (n.id === targetComm || String(n.id) === String(targetComm))
      );

      if (!sourceNode || !targetNode) return;

      const sourceCommunity = sourceNode.community;
      const targetCommunity = targetNode.community;

      if (sourceCommunity === targetCommunity) return;

      // Find layout nodes for these communities
      const sourceLayoutNodes = nodes.filter(n => n.clusterId === sourceCommunity);
      const targetLayoutNodes = nodes.filter(n => n.clusterId === targetCommunity);

      if (sourceLayoutNodes.length === 0 || targetLayoutNodes.length === 0) return;

      // Create edge between first nodes of each community
      edges.push({
        source: sourceLayoutNodes[0],
        target: targetLayoutNodes[0],
        weight: edge.weight || 0.5
      });
    });

    return edges;
  }

  normalizeDensity(nodes) {
    const maxNorm = Math.max(...nodes.map(n => n.norm()));
    if (maxNorm === 0) return;

    const area = Math.PI * maxNorm * maxNorm;
    const targetArea = nodes.length / this.targetDensity;
    const scale = Math.sqrt(targetArea / area);

    nodes.forEach(node => {
      node.x *= scale;
      node.y *= scale;
    });
  }

  async runSimulation() {
    console.log('Starting hierarchical layout simulation...\n');

    // Tier 0: Initial community nodes
    console.log('Tier 0: Laying out top-level communities...');
    let nodes = this.createInitialNodes();
    let edges = this.createEdges(nodes);

    await this.runTier(nodes, edges, 500);

    // Subsequent tiers: Progressive refinement
    for (this.currentTier = 1; this.currentTier <= this.maxTier; this.currentTier++) {
      console.log(`\nTier ${this.currentTier}: Subdividing clusters...`);
      nodes = this.subdivideNodes(nodes);
      edges = this.createEdges(nodes);

      await this.runTier(nodes, edges, 300);
    }

    console.log('\nHierarchical layout complete!');
    return this.finalizeLayout(nodes);
  }

  async runTier(nodes, edges, iterations) {
    return new Promise((resolve) => {
      this.simulation = forceSimulation(nodes)
        .force('link', forceLink(edges)
          .strength(d => d.weight * 0.5)
          .distance(100))
        .force('charge', forceManyBody()
          .strength(-200)
          .distanceMax(500))
        .force('center', forceCenter(0, 0))
        .alphaDecay(0.005)
        .velocityDecay(0.4);

      let tickCount = 0;
      const ticksPerUpdate = 10;

      this.simulation.on('tick', () => {
        tickCount++;
        if (tickCount % ticksPerUpdate === 0) {
          this.normalizeDensity(nodes);

          if (tickCount % 50 === 0) {
            process.stdout.write(`\r  Progress: ${tickCount}/${iterations} iterations`);
          }
        }

        if (tickCount >= iterations) {
          this.simulation.stop();
          console.log(`\r  Completed ${iterations} iterations`);
          resolve();
        }
      });
    });
  }

  finalizeLayout(layoutNodes) {
    // Map layout nodes back to original graph nodes
    const positionMap = new Map();

    // Assign positions from layout nodes to actual nodes
    layoutNodes.forEach(layoutNode => {
      const members = this.nodesByCommunity[layoutNode.clusterId] || [];
      const nodesPerLayoutNode = Math.ceil(members.length / layoutNodes.filter(n => n.clusterId === layoutNode.clusterId).length);

      const layoutNodesInCommunity = layoutNodes.filter(n => n.clusterId === layoutNode.clusterId);
      const layoutNodeIndex = layoutNodesInCommunity.indexOf(layoutNode);
      const startIdx = layoutNodeIndex * nodesPerLayoutNode;
      const assignedMembers = members.slice(startIdx, startIdx + nodesPerLayoutNode);

      assignedMembers.forEach((member, i) => {
        const angle = (Math.PI * 2 * i) / assignedMembers.length;
        const radius = 20 + Math.random() * 30;

        positionMap.set(String(member.id), {
          x: layoutNode.x + Math.cos(angle) * radius,
          y: layoutNode.y + Math.sin(angle) * radius,
          hue: layoutNode.hue
        });
      });
    });

    // Update graph nodes with positions
    this.graph.nodes.forEach(node => {
      const pos = positionMap.get(String(node.id));
      if (pos) {
        node.x = pos.x;
        node.y = pos.y;
        node.hue = pos.hue;
      } else {
        // Fallback: place at community center
        const layoutNode = layoutNodes.find(n => n.clusterId === node.community);
        if (layoutNode) {
          node.x = layoutNode.x + (Math.random() - 0.5) * 100;
          node.y = layoutNode.y + (Math.random() - 0.5) * 100;
          node.hue = layoutNode.hue;
        }
      }
    });

    return this.graph;
  }
}

async function main() {
  console.log('=== Hierarchical Layout Generation ===\n');

  // Load graph data
  const graphPath = path.join(PROCESSED_DIR, 'graph.json');
  console.log('Loading graph data...');
  const graph = JSON.parse(await fs.readFile(graphPath, 'utf-8'));
  console.log(`Loaded ${graph.nodes.length} nodes, ${graph.edges.length} edges\n`);

  // Load communities
  const communitiesPath = path.join(PROCESSED_DIR, 'communities.json');
  const communities = JSON.parse(await fs.readFile(communitiesPath, 'utf-8'));

  // Run hierarchical layout
  const layout = new HierarchicalLayout(graph, communities);
  const positionedGraph = await layout.runSimulation();

  // Normalize to standard space
  console.log('\nNormalizing coordinates to world space...');
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;

  positionedGraph.nodes.forEach(node => {
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
  });

  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  const scale = 20000;

  const output = {
    nodes: positionedGraph.nodes.map(node => ({
      id: String(node.id),
      t: node.title,
      et: node.englishTitle,
      g: node.genres,
      p: node.popularity,
      c: node.community,
      h: Math.round(node.hue || 0),
      x: Math.round(((node.x - minX) / rangeX) * scale),
      y: Math.round(((node.y - minY) / rangeY) * scale),
      img: node.coverImage,
      desc: node.description
    })),
    edges: positionedGraph.edges.map(edge => {
      if (Array.isArray(edge)) {
        return edge;
      }
      return [edge.source, edge.target, edge.weight];
    }),
    bounds: { width: scale, height: scale }
  };

  // Save
  await fs.writeFile(
    path.join(PROCESSED_DIR, 'layout.compact.json'),
    JSON.stringify(output)
  );

  console.log(`\nSaved layout with ${output.nodes.length} positioned nodes`);
  console.log('Layout file: data/processed/layout.compact.json');
  console.log('\n=== Layout generation complete! ===');
}

main().catch(console.error);
