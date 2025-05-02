require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { DataAPIClient } = require('@datastax/astra-db-ts');
const OpenAI = require('openai');

// --- Configuration ---
const ASTRA_ENDPOINT = process.env.ASTRA_DB_API_ENDPOINT;
const ASTRA_TOKEN = process.env.ASTRA_DB_APPLICATION_TOKEN;
const OPENAI_KEY = process.env.OPENAI_API_KEY;
const COLLECTION_NAME = 'products';
const VECTOR_DIMENSION = 1536; // Dimension for text-embedding-3-small
const SIMILARITY_METRIC = 'cosine';
const PRODUCT_DATA_PATH = path.join(__dirname, 'data', 'products.json');

// Check for required environment variables
if (!ASTRA_ENDPOINT || !ASTRA_TOKEN || !OPENAI_KEY) {
  console.error('Error: Missing required environment variables (ASTRA_DB_API_ENDPOINT, ASTRA_DB_APPLICATION_TOKEN, OPENAI_API_KEY).');
  process.exit(1);
}

// --- Initialize Clients ---
const astraClient = new DataAPIClient(ASTRA_TOKEN);
const db = astraClient.db(ASTRA_ENDPOINT);
const openai = new OpenAI({ apiKey: OPENAI_KEY });

// --- Helper Functions ---
async function getEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error(`Error getting embedding for text: ${text.substring(0, 50)}...`, error);
    throw error; // Re-throw to stop the process if embedding fails
  }
}

async function createVectorCollectionIfNotExists(dbInstance, name, dimension, metric) {
  try {
    const collections = await dbInstance.listCollections();
    const collectionExists = collections.some(c => c.name === name);

    if (!collectionExists) {
      console.log(`Creating collection '${name}' with vector dimension ${dimension}...`);
      await dbInstance.createCollection(name, {
        vector: {
          dimension: dimension,
          metric: metric,
        },
        // Optional: Add indexing for filterable fields for better performance
        // indexing: {
        //   allow: ["city", "category", "price"],
        // },
      });
      console.log(`Collection '${name}' created successfully.`);
    } else {
      console.log(`Collection '${name}' already exists.`);
      // Optional: Add check here to ensure existing collection has vector enabled with correct dimension/metric
    }
    return dbInstance.collection(name);
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
    const collection = await createVectorCollectionIfNotExists(db, COLLECTION_NAME, VECTOR_DIMENSION, SIMILARITY_METRIC);

    // 2. Read product data from JSON file
    console.log(`Reading product data from ${PRODUCT_DATA_PATH}...`);
    const rawData = await fs.readFile(PRODUCT_DATA_PATH, 'utf-8');
    const products = JSON.parse(rawData);
    console.log(`Found ${products.length} products.`);

    // 3. Process and insert each product
    console.log('Generating embeddings and inserting data...');
    let insertedCount = 0;
    for (const product of products) {
      // Generate embedding for the description
      const embedding = await getEmbedding(product.description);
      product.$vector = embedding;

      // Use productId as the document _id
      const docId = product.productId;

      // Insert/update the document
      // Using updateOne with upsert=true to avoid duplicates if script is run multiple times
      await collection.updateOne(
        { _id: docId }, // Filter by document ID
        { $set: product }, // Data to insert/update
        { upsert: true } // Create if not exists, update if exists
      );
      insertedCount++;
      console.log(`  - Upserted product: ${product.productId} (${insertedCount}/${products.length})`);

      // Optional: Add a small delay to avoid hitting rate limits, especially for free tiers
      // await new Promise(resolve => setTimeout(resolve, 100)); 
    }

    console.log(`
Data loading complete! ${insertedCount} products processed and upserted into collection '${COLLECTION_NAME}'.`);

  } catch (error) {
    console.error('\n--- Data Loading Failed --- ');
    console.error(error);
    process.exit(1);
  }
}

// --- Run the Script ---
loadData(); 