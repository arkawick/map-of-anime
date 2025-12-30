const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const ANILIST_API = 'https://graphql.anilist.co';
const DATA_DIR = path.join(__dirname, '../data/raw');
const BATCH_SIZE = 50;
const DELAY_MS = 800;
const MAX_ANIME = 5000; // Increased to 5000

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

// Query to get anime with recommendations
const ANIME_RECOMMENDATIONS_QUERY = `
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
      coverImage {
        large
        medium
      }
      description
      format
      status
      genres
      averageScore
      popularity
      favourites
      season
      seasonYear
      recommendations(sort: RATING_DESC, perPage: 25) {
        edges {
          node {
            mediaRecommendation {
              id
              title {
                romaji
              }
            }
            rating
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
        timeout: 15000
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

      if (error.response?.status === 429) {
        const waitTime = DELAY_MS * Math.pow(2, i + 1);
        console.log(`Rate limited. Waiting ${Math.round(waitTime)}ms...`);
        await sleep(waitTime);
        continue;
      }

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

async function fetchAllAnime(maxAnime = MAX_ANIME) {
  console.log(`Fetching up to ${maxAnime} anime with recommendations from AniList...`);
  const allAnime = [];
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage && allAnime.length < maxAnime) {
    console.log(`Fetching page ${currentPage}... (${allAnime.length} anime collected)`);

    try {
      const data = await makeRequest(ANIME_RECOMMENDATIONS_QUERY, {
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
      if (currentPage % 10 === 0) {
        await fs.writeFile(
          path.join(DATA_DIR, 'anime_recommendations.json'),
          JSON.stringify(allAnime.slice(0, maxAnime), null, 2)
        );
        console.log(`Progress saved (${allAnime.length} anime)`);
      }

      await sleep(DELAY_MS);
    } catch (error) {
      console.error(`Error fetching page ${currentPage}:`, error.message);
      console.log(`Saving partial data (${allAnime.length} anime)...`);

      await fs.writeFile(
        path.join(DATA_DIR, 'anime_recommendations.json'),
        JSON.stringify(allAnime.slice(0, maxAnime), null, 2)
      );

      if (allAnime.length >= 500) {
        console.log(`\nContinuing with ${allAnime.length} anime (enough for visualization)`);
        break;
      } else {
        throw error;
      }
    }
  }

  // Trim to maxAnime
  const finalAnime = allAnime.slice(0, maxAnime);

  console.log(`\nCompleted! Fetched ${finalAnime.length} anime with recommendations.`);
  await fs.writeFile(
    path.join(DATA_DIR, 'anime_recommendations.json'),
    JSON.stringify(finalAnime, null, 2)
  );

  return finalAnime;
}

async function main() {
  await ensureDir(DATA_DIR);

  console.log('=== Map of Anime - Recommendation-Based Collection ===\n');
  console.log('This approach collects anime recommendation data');
  console.log('to build connections based on what users actually recommend together.\n');

  const recommendationsFile = path.join(DATA_DIR, 'anime_recommendations.json');

  try {
    const existing = await fs.readFile(recommendationsFile, 'utf-8');
    const anime = JSON.parse(existing);
    console.log(`Found existing data for ${anime.length} anime with recommendations.`);
    console.log('Delete data/raw/anime_recommendations.json to re-fetch.\n');
  } catch {
    await fetchAllAnime(MAX_ANIME);
  }

  console.log('\n=== Recommendation collection complete! ===');
  console.log('Next step: Run the new compute script to calculate similarities');
}

main().catch(console.error);
