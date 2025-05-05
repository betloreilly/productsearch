require('dotenv').config();
const express = require('express');
const { DataAPIClient, Db, Collection, DataAPIResponseError } = require('@datastax/astra-db-ts');
const { OpenAI } = require('openai');
const path = require('path');

// --- Type Definition for Product Results ---
/**
 * @typedef {object} ProductDocument
 * @property {string} _id - Typically the productId
 * @property {string} productId
 * @property {string} name
 * @property {string} description
 * @property {number} price
 * @property {string} currency
 * @property {string} category
 * @property {string} imageUrl
 */

let client = null;
let db = null;
let openai = null;
let productsCollection = null;
let initializationError = null;
const COLLECTION_NAME = 'product';

try {
  if (!process.env.ASTRA_DB_APPLICATION_TOKEN || !process.env.ASTRA_DB_API_ENDPOINT || !process.env.OPENAI_API_KEY) {
    throw new Error("Missing required environment variables");
  }

  client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN);
  db = client.db(process.env.ASTRA_DB_API_ENDPOINT);
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  console.log(`Initialized clients. DB Endpoint: ${process.env.ASTRA_DB_API_ENDPOINT}`);
  productsCollection = db.collection(COLLECTION_NAME);
  console.log(`Connected to collection '${COLLECTION_NAME}'.`);

} catch (e) {
  initializationError = e;
  console.error('Initialization failed:', e);
}

const app = express();
const port = process.env.PORT || 3002;
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

module.exports = app;

async function getEmbedding(text) {
  if (initializationError) throw new Error("Server initialization failed");
  if (!openai) throw new Error("OpenAI client not initialized");
  if (!text) return null;

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.trim(),
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error(`Embedding error for query: ${text}`, error);
    throw new Error('Failed to generate search embedding.'); 
  }
}

app.post('/search', async (req, res) => {
  if (initializationError) {
    return res.status(503).json({ message: `Initialization failed: ${initializationError.message}` });
  }
  if (!productsCollection) {
    return res.status(503).json({ message: 'Collection not available.' });
  }

  try {
    const { query, category, minPrice, maxPrice, limit = 10, page = 1 } = req.body;
    const parsedLimit = parseInt(limit, 10);
    const parsedPage = parseInt(page, 10);
    const skip = (parsedPage - 1) * parsedLimit;
    const fetchLimit = parsedLimit + 1;

    const filter = {};
    if (category) filter.category = category;
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter.price = {};
      if (minPrice !== undefined) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice !== undefined) filter.price.$lte = parseFloat(maxPrice);
    }

    const baseOptions = {
      limit: fetchLimit,
      skip: skip,
      projection: { '$vector': 0 }
    };

    let cursor;
    if (query) {
      console.log(`Performing HYBRID search for: "${query}"`);

      const hybridFilter = { ...filter };
      const hybridOptions = {
        ...baseOptions,
        sort: {
          $hybrid: query
        }
      };

      console.log("Hybrid filter:", JSON.stringify(hybridFilter));
      console.log("Hybrid options:", JSON.stringify(hybridOptions));
      cursor = productsCollection.findAndRerank(hybridFilter, hybridOptions);
    } else {
      console.log('Performing standard search.');
      const standardOptions = {
        ...baseOptions,
        sort: { _id: 1 }
      };
      cursor = productsCollection.find({}, standardOptions);
    }

    const results = await cursor.toArray();
    const hasNextPage = results.length > parsedLimit;
    const pageResults = hasNextPage ? results.slice(0, parsedLimit) : results;

    res.json({
      products: pageResults,
      hasNextPage,
      currentPage: parsedPage,
      totalPages: 1 // Placeholder, update if you have total count logic
    });

  } catch (error) {
    console.error('Search error:', error);
    if (error instanceof DataAPIResponseError) {
      res.status(500).json({ message: `DB error: ${error.message}` });
    } else {
      res.status(500).json({ message: 'Search failed.' });
    }
  }
});