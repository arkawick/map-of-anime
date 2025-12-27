const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const ANILIST_API = 'https://graphql.anilist.co';
const DATA_DIR = path.join(__dirname, '../data/raw');
const BATCH_SIZE = 50;
const DELAY_MS = 1500; // Rate limiting delay (increased to avoid rate limits)

// Ensure data directory exists
async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

// Query to fetch anime with pagination
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
      averageScore
      popularity
      favourites
      season
      seasonYear
      episodes
      studios(isMain: true) {
        nodes {
          name
        }
      }
    }
  }
}
`;

// Query to fetch users who have anime in their list
const ANIME_USERS_QUERY = `
query ($animeId: Int, $page: Int) {
  Page(page: $page, perPage: 50) {
    pageInfo {
      hasNextPage
      currentPage
    }
    mediaList(mediaId: $animeId, status_in: [COMPLETED, CURRENT, PLANNING]) {
      user {
        id
        name
      }
      status
      score
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
        }
      });

      if (response.data.errors) {
        console.error('GraphQL errors:', response.data.errors);
        if (i === retries - 1) throw new Error('GraphQL query failed');
        await sleep(DELAY_MS * (i + 1));
        continue;
      }

      if (!response.data.data) {
        console.error('No data in response:', response.data);
        if (i === retries - 1) throw new Error('No data in response');
        await sleep(DELAY_MS * (i + 1));
        continue;
      }

      return response.data.data;
    } catch (error) {
      if (error.response?.status === 429) {
        const waitTime = DELAY_MS * Math.pow(2, i + 1);
        console.log(`Rate limited, waiting ${waitTime}ms...`);
        await sleep(waitTime);
      } else {
        console.error(`Request error (attempt ${i + 1}/${retries}):`, error.message);
        if (i === retries - 1) {
          throw error;
        }
        await sleep(DELAY_MS * (i + 1));
      }
    }
  }
  throw new Error('All retries failed');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAllAnime() {
  console.log('Fetching anime list from AniList...');
  const allAnime = [];
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    console.log(`Fetching page ${currentPage}...`);

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

      console.log(`Fetched ${media.length} anime (total: ${allAnime.length}/${pageInfo.total})`);

      hasNextPage = pageInfo.hasNextPage;
      currentPage++;

      // Save progress periodically
      if (currentPage % 10 === 0) {
        await fs.writeFile(
          path.join(DATA_DIR, 'anime_partial.json'),
          JSON.stringify(allAnime, null, 2)
        );
        console.log(`Progress saved (${allAnime.length} anime)`);
      }

      await sleep(DELAY_MS);
    } catch (error) {
      console.error(`Error fetching page ${currentPage}:`, error.message);
      console.log(`Saving partial data (${allAnime.length} anime)...`);

      // Save what we have so far
      await fs.writeFile(
        path.join(DATA_DIR, 'anime_partial.json'),
        JSON.stringify(allAnime, null, 2)
      );

      throw error;
    }
  }

  console.log(`Completed! Fetched ${allAnime.length} total anime.`);
  await fs.writeFile(
    path.join(DATA_DIR, 'anime.json'),
    JSON.stringify(allAnime, null, 2)
  );

  return allAnime;
}

async function fetchAnimeUsers(animeId, animeTitle, limit = 1000) {
  console.log(`Fetching users for: ${animeTitle}`);
  const users = new Set();
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage && users.size < limit) {
    try {
      const data = await makeRequest(ANIME_USERS_QUERY, {
        animeId,
        page: currentPage
      });

      const { mediaList, pageInfo } = data.Page;

      for (const entry of mediaList) {
        if (entry.user) {
          users.add(entry.user.id);
        }
      }

      hasNextPage = pageInfo.hasNextPage;
      currentPage++;

      await sleep(DELAY_MS);
    } catch (error) {
      console.error(`Error fetching users for anime ${animeId}:`, error.message);
      break;
    }
  }

  return Array.from(users);
}

async function collectUserLists(anime, maxAnime = Infinity) {
  console.log('\nCollecting user lists for similarity computation...');
  const animeUsers = {};
  const processLimit = Math.min(anime.length, maxAnime);

  for (let i = 0; i < processLimit; i++) {
    const item = anime[i];
    console.log(`[${i + 1}/${processLimit}] Processing: ${item.title.romaji || item.title.english}`);

    const users = await fetchAnimeUsers(
      item.id,
      item.title.romaji || item.title.english,
      1000
    );

    animeUsers[item.id] = {
      id: item.id,
      title: item.title,
      genres: item.genres,
      popularity: item.popularity,
      users: users
    };

    // Save progress every 50 anime
    if ((i + 1) % 50 === 0) {
      await fs.writeFile(
        path.join(DATA_DIR, 'anime_users_partial.json'),
        JSON.stringify(animeUsers, null, 2)
      );
    }
  }

  await fs.writeFile(
    path.join(DATA_DIR, 'anime_users.json'),
    JSON.stringify(animeUsers, null, 2)
  );

  console.log(`\nCompleted! Collected user data for ${Object.keys(animeUsers).length} anime.`);
  return animeUsers;
}

async function main() {
  await ensureDir(DATA_DIR);

  console.log('=== Map of Anime Data Collection ===\n');

  // Step 1: Fetch all anime
  let anime;
  const animeFile = path.join(DATA_DIR, 'anime.json');
  const animePartialFile = path.join(DATA_DIR, 'anime_partial.json');

  try {
    const existing = await fs.readFile(animeFile, 'utf-8');
    anime = JSON.parse(existing);
    console.log(`Loaded ${anime.length} anime from existing file.`);
  } catch {
    try {
      // Try to load partial data
      const partial = await fs.readFile(animePartialFile, 'utf-8');
      anime = JSON.parse(partial);
      console.log(`Found partial data with ${anime.length} anime.`);
      console.log('You can continue with this data or restart to fetch more.\n');
    } catch {
      try {
        anime = await fetchAllAnime();
      } catch (error) {
        console.error('\nData collection failed, but partial data may be available.');
        // Try to load what we saved
        try {
          const partial = await fs.readFile(animePartialFile, 'utf-8');
          anime = JSON.parse(partial);
          console.log(`Using partial data with ${anime.length} anime.`);
        } catch {
          throw new Error('No data available. Please try again.');
        }
      }
    }
  }

  // Step 2: Collect user lists for top anime
  // For full implementation, use 1500 anime (takes ~4-6 hours)
  // For quick testing, use 200-300 anime (takes ~30-45 minutes)
  const targetCount = Math.min(200, anime.length); // CHANGE THIS: 200 for quick test, 1500 for full map
  console.log(`\nWill collect user data for top ${targetCount} anime...`);

  const topAnime = anime.slice(0, targetCount);
  await collectUserLists(topAnime, targetCount);

  console.log('\n=== Data collection complete! ===');
  console.log('Next step: Run "npm run compute" to calculate similarities');
}

main().catch(console.error);
