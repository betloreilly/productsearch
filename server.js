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
    const { query, city, minPrice, maxPrice, category, limit = 10, page = 1 } = req.body; 
    const parsedLimit = parseInt(limit, 10);
    const parsedPage = parseInt(page, 10);
    const skip = (parsedPage - 1) * parsedLimit;

    console.log('Received search request:', { ...req.body, page: parsedPage, limit: parsedLimit });

    const queryVector = await getEmbedding(query);

    const filter = {};
    if (category) filter.category = category;
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice !== undefined) filter.price.$lte = parseFloat(maxPrice);
    }

    // Fetch one extra document to check for next page
    const fetchLimit = parsedLimit + 1; 

    // Define base options
    let findOptions = {
      limit: fetchLimit,
      skip: skip,
      projection: { '$vector': 0 },
      // Initialize sort object
      sort: {}
    };

    let cursor;
    if (queryVector) {
        // Vector Search - Add vector sort
        findOptions.sort = { $vector: queryVector };
        console.log('Performing vector search with filter:', filter, `Options:`, findOptions);
        cursor = productsCollection.find(filter, findOptions);
    } else {
        // Filter-based or initial load search - Add default sort by _id
        findOptions.sort = { _id: 1 }; // Default sort for consistent skipping
        console.log('Performing filter/initial search:', filter, `Options:`, findOptions);
        cursor = productsCollection.find(filter, findOptions);
    }

    // Execute the find operation
    const results = await cursor.toArray();

    const hasNextPage = results.length > parsedLimit;
    const pageResults = hasNextPage ? results.slice(0, parsedLimit) : results;

    console.log(`Found ${results.length} raw results. Returning ${pageResults.length} for page ${parsedPage}. HasNextPage: ${hasNextPage}`);
    res.json({ 
        data: pageResults, 
        hasNextPage: hasNextPage, 
        currentPage: parsedPage 
    });

  } catch (error) {
      console.error('Search endpoint error:', error);
      // Log the error more verbosely if possible
      // e.g., console.error(error.stack);
      if (error.message === 'Failed to generate search embedding.') {
          res.status(500).json({ message: 'Error generating search embedding.' });
      } else {
           // Provide a slightly more specific default message if needed
          res.status(500).json({ message: 'An error occurred during the search process.' });
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