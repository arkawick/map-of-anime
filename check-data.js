const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./public/data/processed/layout.compact.json', 'utf-8'));

console.log('Nodes:', data.nodes.length);
console.log('Edges:', data.edges?.length || 0);
console.log('Bounds:', data.bounds);
console.log('\nSample node:', JSON.stringify(data.nodes[0], null, 2));
console.log('\nNode has community?', 'c' in data.nodes[0]);
