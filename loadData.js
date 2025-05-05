require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { DataAPIClient, Db, Collection } = require('@datastax/astra-db-ts');

// --- Type Definition for Product ---
/**
 * @typedef {object} ProductDocument
 * @property {string} productId
 * @property {string} name
 * @property {string} description
 * @property {number} price
 * @property {string} currency
 * @property {string} category
 * @property {string} imageUrl
 * @property {number[]} [$vector] - Added by script
 */

// --- Configuration ---
const ASTRA_ENDPOINT = process.env.ASTRA_DB_API_ENDPOINT;
const ASTRA_TOKEN = process.env.ASTRA_DB_APPLICATION_TOKEN;
const COLLECTION_NAME = 'product';
const PRODUCT_DATA_PATH = path.join(__dirname, 'data', 'products.json');

// Check for required environment variables
if (!ASTRA_ENDPOINT || !ASTRA_TOKEN) {
  console.error('Error: Missing required environment variables (ASTRA_DB_API_ENDPOINT, ASTRA_DB_APPLICATION_TOKEN).');
  process.exit(1);
}

// --- Initialize Clients ---
/** @type {DataAPIClient | null} */
const astraClient = new DataAPIClient(ASTRA_TOKEN);
/** @type {Db | null} */
const db = astraClient.db(ASTRA_ENDPOINT);

// --- Helper Functions ---
async function createVectorCollectionIfNotExists(dbInstance, name) {
  try {
    const collections = await dbInstance.listCollections();
    const collectionExists = collections.some(c => c.name === name);

    if (!collectionExists) {
      console.log(`Creating collection '${name}' with NVIDIA vectorization (dim 1024) and NVIDIA reranking...`);
      const createOptions = {
        vector: {
          dimension: 1024,
          metric: "cosine",
          service: {
            provider: "nvidia",
            modelName: "NV-Embed-QA"
          }
        },
        lexical: {
          enabled: true,
          analyzer: {
            tokenizer: { name: "standard", args: {} },
            filters: [
              { name: "lowercase" },
              { name: "stop" },
              { name: "porterstem" },
              { name: "asciifolding" }
            ],
            charFilters: []
          }
        },
        rerank: {
          enabled: true,
          service: {
            provider: "nvidia",
            modelName: "nvidia/llama-3.2-nv-rerankqa-1b-v2"
          }
        },
        indexing: {
          allow: ["_id", "category", "price"]
        }
      };
      await dbInstance.createCollection(name, createOptions);
      console.log(`Collection '${name}' created successfully with hybrid search (NVIDIA vectors / NVIDIA rerank) enabled.`);
    } else {
      console.log(`Collection '${name}' already exists.`);
    }
    /** @type {Collection<ProductDocument>} */
    const collection = dbInstance.collection(name);
    return collection;
  } catch (error) {
    console.error(`Error creating or accessing collection '${name}':`, error);
    throw error;
  }
}

// --- Main Loading Logic ---
async function loadData() {
  console.log('Starting data loading process...');

  try {
    // 1. Create or get the collection
    /** @type {Collection<ProductDocument>} */
    const collection = await createVectorCollectionIfNotExists(db, COLLECTION_NAME);

    // 2. Read product data from JSON file
    console.log(`Reading product data from ${PRODUCT_DATA_PATH}...`);
    const rawData = await fs.readFile(PRODUCT_DATA_PATH, 'utf-8');
    /** @type {ProductDocument[]} */
    const products = JSON.parse(rawData);
    console.log(`Found ${products.length} products.`);

    // Insert each product individually using insertOne
    let insertedCount = 0;
    for (const product of products) {
      try {
        const descriptionText = typeof product.description === 'string' ? product.description : '';
        const doc = {
          ...product,
          $vectorize: descriptionText,
          $lexical: descriptionText
        };
        await collection.insertOne(doc);
        insertedCount++;
        console.log(`  - Inserted product: ${product.productId} (${insertedCount}/${products.length})`);
      } catch (err) {
        console.error(`  ✖ Failed to insert product ${product.productId}:`, err.message);
      }
    }
    console.log(`\nData loading complete! ${insertedCount} products inserted into collection '${COLLECTION_NAME}'.`);

  } catch (error) {
    console.error('\n--- Data Loading Failed --- ');
    console.error(error);
    process.exit(1);
  }
}

// --- Run the Script ---
loadData(); 