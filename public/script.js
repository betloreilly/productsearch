const searchButton = document.getElementById('searchButton');
const searchQueryInput = document.getElementById('searchQuery');
const cityFilterInput = document.getElementById('cityFilter');
const categoryFilterInput = document.getElementById('categoryFilter');
const minPriceFilterInput = document.getElementById('minPriceFilter');
const maxPriceFilterInput = document.getElementById('maxPriceFilter');
const limitFilterInput = document.getElementById('limitFilter');
const resultsContainer = document.getElementById('resultsContainer');
const paginationControlsDiv = document.getElementById('paginationControls');
const prevButton = document.getElementById('prevButton');
const nextButton = document.getElementById('nextButton');
const pageInfoSpan = document.getElementById('pageInfo');

// --- State --- 
let currentPage = 1;
let currentSearchPayload = {}; // Store the last used search filters/query

// Add event listener for DOMContentLoaded to load initial products
document.addEventListener('DOMContentLoaded', () => {
    // Load initial products for page 1
    fetchAndDisplayPage(1, {}, true); 
});

searchButton.addEventListener('click', () => {
    // Reset to page 1 when a new search is performed
    currentPage = 1;
    performSearchAndDisplay(); 
});

prevButton.addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        fetchAndDisplayPage(currentPage, currentSearchPayload); // Fetch previous page with current filters
    }
});

nextButton.addEventListener('click', () => {
    currentPage++;
    fetchAndDisplayPage(currentPage, currentSearchPayload); // Fetch next page with current filters
});

// Function to load initial products
async function fetchAndDisplayPage(page, searchPayload = {}, isInitialLoad = false) {
    console.log(`Fetching page ${page} with payload:`, searchPayload);
    resultsContainer.innerHTML = `<p>${isInitialLoad ? 'Loading products...' : 'Fetching results...'}</p>`;
    paginationControlsDiv.style.display = 'none'; // Hide controls while loading

    // Ensure limit and page are set in the payload for the API call
    const limit = parseInt(limitFilterInput.value, 10) || 10; // Use input value or default
    const payloadWithPaging = {
        ...searchPayload,
        limit: limit,
        page: page
    };

    try {
        const response = await fetch('/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payloadWithPaging),
        });

        if (!response.ok) {
            let errorMsg = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.message || errorMsg;
            } catch (parseError) { /* Ignore */ }
            throw new Error(errorMsg);
        }

        const responseData = await response.json(); 
        displayResults(responseData.data); // Display only the data array
        
        // Update current page state ONLY after successful fetch
        currentPage = responseData.currentPage; 
        updatePaginationControls(responseData.hasNextPage);

    } catch (error) {
        console.error(`Fetch failed for page ${page}:`, error);
        resultsContainer.innerHTML = `<p style="color: red;">Error loading results: ${error.message}</p>`;
        // Keep pagination hidden on error
    }
}

// Gets filters, resets page, stores filters, and fetches page 1
function performSearchAndDisplay() {
    const query = searchQueryInput.value.trim();
    const city = cityFilterInput.value.trim();
    const category = categoryFilterInput.value.trim();
    const minPrice = minPriceFilterInput.value;
    const maxPrice = maxPriceFilterInput.value;
    // Limit is handled within fetchAndDisplayPage

    // Store the current search criteria for pagination
    currentSearchPayload = {};
    if (query) currentSearchPayload.query = query;
    if (city) currentSearchPayload.city = city;
    if (category) currentSearchPayload.category = category;
    if (minPrice !== '') currentSearchPayload.minPrice = parseFloat(minPrice);
    if (maxPrice !== '') currentSearchPayload.maxPrice = parseFloat(maxPrice);

    console.log('Storing search payload for pagination:', currentSearchPayload);
    
    // Fetch the first page with the new criteria
    fetchAndDisplayPage(1, currentSearchPayload); 
}

function displayResults(results) {
    resultsContainer.innerHTML = ''; // Clear previous results or loading message

    if (!results || results.length === 0) {
        // Check if it was an initial load or a search with no results
        if (currentPage === 1 && Object.keys(currentSearchPayload).length === 0) {
             resultsContainer.innerHTML = '<p>No products found in the database.</p>';
        } else {
             resultsContainer.innerHTML = '<p>No products found matching your criteria.</p>';
        }
        return;
    }

    results.forEach(product => {
        const productDiv = document.createElement('div');
        productDiv.classList.add('product-item');

        let content = '';
        if (product.imageUrl) {
            // Remove 'public/' prefix if it exists for the image src attribute
            const imageSrc = product.imageUrl.startsWith('public/')
                             ? product.imageUrl.substring(7) // Remove 'public/' (7 chars)
                             : product.imageUrl;
            content += `<img src="${imageSrc}" alt="${product.name}" onerror="this.style.display='none'">`;
        }
        content += `<h3>${product.name}</h3>`;
        if (product.description) {
            // Truncate long descriptions for display
            const shortDesc = product.description.length > 150 
                              ? product.description.substring(0, 147) + '...' 
                              : product.description;
            content += `<p>${shortDesc}</p>`;
        }
        if (product.price !== undefined && product.price !== null) {
            content += `<p class="price">${product.currency || '$'}${product.price.toFixed(2)}</p>`;
        }
        if (product.category) {
            content += `<span class="category">Category: ${product.category}</span>`;
        }
        if (product.city) {
            content += `<span class="city">City: ${product.city}</span>`;
        }

        productDiv.innerHTML = content;
        resultsContainer.appendChild(productDiv);
    });
}

// --- UI Update Functions ---
function updatePaginationControls(hasNextPage) {
    if (currentPage === 1 && !hasNextPage) {
        // Hide if only one page of results
        paginationControlsDiv.style.display = 'none';
        return;
    }

    paginationControlsDiv.style.display = 'flex'; // Show the controls
    pageInfoSpan.textContent = `Page ${currentPage}`;
    prevButton.disabled = currentPage <= 1;
    nextButton.disabled = !hasNextPage;
} 