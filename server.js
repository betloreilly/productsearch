require('dotenv').config();
const express = require('express');
const { DataAPIClient } = require('@datastax/astra-db-ts');
const { OpenAI } = require('openai');
const path = require('path');

// Initialize Clients with Error Handling
let client, db, openai, productsCollection;
let initializationError = null;

try {
  if (!process.env.ASTRA_DB_APPLICATION_TOKEN || !process.env.ASTRA_DB_API_ENDPOINT || !process.env.OPENAI_API_KEY) {
    throw new Error("Missing required environment variables (ASTRA_DB_APPLICATION_TOKEN, ASTRA_DB_API_ENDPOINT, OPENAI_API_KEY)");
  }

  client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN);
  db = client.db(process.env.ASTRA_DB_API_ENDPOINT);
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY }); // Use OPENAI_API_KEY consistently

  console.log(`Successfully initialized clients. DB Endpoint: ${process.env.ASTRA_DB_API_ENDPOINT}`);

  // Get collection reference immediately after successful client init
  productsCollection = db.collection('products');
  console.log('Got reference to Astra DB \'products\' collection.');

} catch (e) {
  initializationError = e; // Store the error
  console.error('FATAL: Failed to initialize clients or get collection:', e);
  // Don't exit immediately, let requests be handled (and return error)
}

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// --- Serve Static Files from 'public' directory ---
// Vercel handles this automatically for the root, but good practice
// to keep it explicit for clarity or if root differs.
app.use(express.static(path.join(__dirname, 'public')));

// Basic route - Now serves the index.html by default via express.static
// app.get('/', (req, res) => {
//   res.send('Hello Product Finder! Use POST /search to find products.');
// });

// Start the server only if run directly (e.g., locally with `node server.js`)
// Vercel will import the `app` object instead of running this directly.
if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server listening locally at http://localhost:${port}`);
  });
}

// Export the app for Vercel's build process
module.exports = app;

// --- Helper Functions (Embedding) ---
// Re-use or refactor embedding logic from loadData.js if needed
async function getEmbedding(text) {
  if (initializationError) { // Check if initialization failed
     throw new Error("Server initialization failed, cannot generate embedding.");
  }
  if (!openai) { // Check if openai client is specifically missing
      throw new Error("OpenAI client not initialized.");
  }
  if (!text) return null;
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.trim(), // Ensure no leading/trailing whitespace
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error(`Error getting embedding for search query: ${text.substring(0, 50)}...`, error);
    // Handle error appropriately for API request (e.g., return 500)
    throw new Error('Failed to generate search embedding.'); 
  }
}

// --- Search Endpoint ---
app.post('/search', async (req, res) => {
  // Check for initialization error first
  if (initializationError) {
    return res.status(503).json({ message: `Server initialization failed: ${initializationError.message}` });
  }
  if (!productsCollection) {
    // This case might be redundant now if init fails earlier, but keep as safety
    return res.status(503).json({ message: 'Database collection not available.' });
  }

  try {
    const { query, city, minPrice, maxPrice, category, limit = 5 } = req.body;

    console.log('Received search request:', req.body);

    // 1. Generate embedding for the search query (if provided)
    const queryVector = await getEmbedding(query);

    // 2. Construct Filter (for hybrid search)
    const filter = {};
    if (city) filter.city = city;
    if (category) filter.category = category;
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice !== undefined) filter.price.$lte = parseFloat(maxPrice);
    }

    // 3. Perform the search
    let searchResults;
    const options = {
      limit: parseInt(limit, 10),
      // Exclude the vector from the results unless needed
      projection: { '$vector': 0 }, 
    };

    if (queryVector) {
      // --- Vector Search (with optional filtering) ---
      console.log('Performing vector search with filter:', filter);
      searchResults = await productsCollection.find(filter, {
        sort: {
          $vector: queryVector,
        },
        ...options
      }).toArray();

    } else if (Object.keys(filter).length > 0) {
       // --- Filter-Only Search (no vector query) ---
      console.log('Performing filter-only search:', filter);
      searchResults = await productsCollection.find(filter, options).toArray();

    } else {
      // --- No query and no filters - maybe return error or featured items? ---
      console.log('No search query or filters provided.');
      // For now, return empty results or a specific message
      return res.status(400).json({ message: 'Please provide a search query or filters.' });
      // Alternatively, return some default items:
      // searchResults = await productsCollection.find({}, options).toArray(); 
    }

    // 4. Return results
    console.log(`Found ${searchResults.length} results.`);
    res.json(searchResults);

  } catch (error) {
    console.error('Search endpoint error:', error);
    if (error.message === 'Failed to generate search embedding.') {
        res.status(500).json({ message: 'Error generating search embedding.' });
    } else {
        res.status(500).json({ message: 'An error occurred during the search.' });
    }
  }
});

// TODO: Add search endpoint (/search)

// TODO: Define Collection and use it in search endpoint
/* 
let collection;
async function initializeDb() {
  try {
    // Example: Access or create a collection 
    // collection = await db.collection('products');
    // console.log('Connected to Astra DB and collection is ready.');
  } catch (e) {
    console.error('Failed to initialize Astra DB connection:', e);
    process.exit(1); // Exit if DB connection fails
  }
}

initializeDb();
*/ 