const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const ANILIST_API = 'https://graphql.anilist.co';
const DATA_DIR = path.join(__dirname, '../data/raw');
const BATCH_SIZE = 50;
const DELAY_MS = 1000;

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

// Enhanced query with more metadata for similarity
const ANIME_QUERY = `
query ($page: Int, $perPage: Int) {
  Page(page: $page, perPage: $perPage) {
    pageInfo {
      total
      currentPage
      lastPage
      hasNextPage
    }
    media(type: ANIME, sort: POPULARITY_DESC) {
      id
      title {
        romaji
        english
        native
      }
      format
      status
      genres
      tags {
        name
        rank
        isMediaSpoiler
      }
      averageScore
      popularity
      favourites
      season
      seasonYear
      episodes
      duration
      studios(isMain: true) {
        nodes {
          name
          id
        }
      }
      staff(sort: RELEVANCE, perPage: 5) {
        edges {
          role
          node {
            id
            name {
              full
            }
          }
        }
      }
      relations {
        edges {
          relationType
          node {
            id
            type
          }
        }
      }
    }
  }
}
`;

async function makeRequest(query, variables, retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await axios.post(ANILIST_API, {
        query,
        variables
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        timeout: 10000
      });

      if (response.data.errors) {
        console.error('GraphQL errors:', response.data.errors);
        if (i === retries - 1) throw new Error('GraphQL query failed');
        await sleep(DELAY_MS * (i + 1));
        continue;
      }

      if (!response.data.data) {
        console.error('No data in response');
        if (i === retries - 1) throw new Error('No data in response');
        await sleep(DELAY_MS * (i + 1));
        continue;
      }

      return response.data.data;
    } catch (error) {
      const errorMsg = error.response?.status || error.code || error.message;
      console.error(`Request error (attempt ${i + 1}/${retries}):`, errorMsg);

      if (i === retries - 1) {
        throw error;
      }

      const waitTime = DELAY_MS * Math.pow(1.5, i + 1);
      console.log(`Waiting ${Math.round(waitTime)}ms before retry...`);
      await sleep(waitTime);
    }
  }
  throw new Error('All retries failed');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllAnime(maxAnime = 1500) {
  console.log(`Fetching up to ${maxAnime} anime from AniList...`);
  const allAnime = [];
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage && allAnime.length < maxAnime) {
    console.log(`Fetching page ${currentPage}... (${allAnime.length} anime collected)`);

    try {
      const data = await makeRequest(ANIME_QUERY, {
        page: currentPage,
        perPage: BATCH_SIZE
      });

      if (!data || !data.Page) {
        console.error('Invalid response structure');
        break;
      }

      const { media, pageInfo } = data.Page;
      allAnime.push(...media);

      console.log(`✓ Fetched ${media.length} anime (total: ${allAnime.length})`);

      hasNextPage = pageInfo.hasNextPage && allAnime.length < maxAnime;
      currentPage++;

      // Save progress periodically
      if (currentPage % 5 === 0) {
        await fs.writeFile(
          path.join(DATA_DIR, 'anime_metadata.json'),
          JSON.stringify(allAnime.slice(0, maxAnime), null, 2)
        );
        console.log(`Progress saved (${allAnime.length} anime)`);
      }

      await sleep(DELAY_MS);
    } catch (error) {
      console.error(`Error fetching page ${currentPage}:`, error.message);
      console.log(`Saving partial data (${allAnime.length} anime)...`);

      await fs.writeFile(
        path.join(DATA_DIR, 'anime_metadata.json'),
        JSON.stringify(allAnime.slice(0, maxAnime), null, 2)
      );

      if (allAnime.length >= 200) {
        console.log(`\nContinuing with ${allAnime.length} anime (enough for visualization)`);
        break;
      } else {
        throw error;
      }
    }
  }

  // Trim to maxAnime
  const finalAnime = allAnime.slice(0, maxAnime);

  console.log(`\nCompleted! Fetched ${finalAnime.length} anime with full metadata.`);
  await fs.writeFile(
    path.join(DATA_DIR, 'anime_metadata.json'),
    JSON.stringify(finalAnime, null, 2)
  );

  return finalAnime;
}

async function main() {
  await ensureDir(DATA_DIR);

  console.log('=== Map of Anime - Metadata Collection ===\n');
  console.log('This approach uses anime metadata (genres, tags, studios)');
  console.log('instead of user lists for much faster collection.\n');

  const metadataFile = path.join(DATA_DIR, 'anime_metadata.json');

  try {
    const existing = await fs.readFile(metadataFile, 'utf-8');
    const anime = JSON.parse(existing);
    console.log(`Found existing metadata for ${anime.length} anime.`);
    console.log('Delete data/raw/anime_metadata.json to re-fetch.\n');
  } catch {
    await fetchAllAnime(1500);
  }

  console.log('\n=== Metadata collection complete! ===');
  console.log('Next step: Run "npm run compute" to calculate similarities');
}

main().catch(console.error);
