# Product Search with Astra DB Hybrid Search

This project demonstrates a product search application using Node.js, Express, and Astra DB.
It showcases hybrid search capabilities combining vector and lexical search using the `@datastax/astra-db-ts` library.

## Features

*   Backend API using Express and `@datastax/astra-db-ts`.
*   Astra DB collection configured for automatic vectorization (NVIDIA) and hybrid search.
*   Data loading script to populate the database.
*   Simple frontend UI to search products by text query and price range.
*   Pagination for search results.

## Setup

1.  **Clone the Repository (if needed):**
    ```bash
    git clone <your-repo-url>
    cd product_search
    ```

2.  **Install Dependencies:**
    ```bash
    npm install
    ```

3.  **Environment Variables:**
    Create a `.env` file in the project root directory and add your Astra DB credentials:
    ```env
    ASTRA_DB_API_ENDPOINT="your_astra_db_api_endpoint"
    ASTRA_DB_APPLICATION_TOKEN="your_astra_db_application_token"
    ```
    *   Replace the placeholder values with your actual Astra DB API Endpoint and an Application Token (Client Token).
    *   You can get these from your Astra DB database dashboard.

4.  **Load Data:**
    Before running the application for the first time, or if you need to reset the data, run the data loading script. **Note:** This will drop the existing `product` collection if it exists and create a new one with the correct configuration.
    ```bash
    node loadData.js
    ```

## Running the Application

1.  **Start the Server:**
    ```bash
    node server.js
    ```
    The server will typically start on `http://localhost:3002` (or the port specified by the `PORT` environment variable).

2.  **Access the UI:**
    Open your web browser and navigate to `http://localhost:3002`.

## Technology Stack

*   **Backend:** Node.js, Express.js
*   **Database:** DataStax Astra DB (Serverless Cassandra)
*   **Astra DB Client:** `@datastax/astra-db-ts`
*   **Frontend:** HTML, CSS, Vanilla JavaScript
*   **Vectorization/Reranking:** NVIDIA (via Astra DB integration) 