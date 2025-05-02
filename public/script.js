const searchButton = document.getElementById('searchButton');
const searchQueryInput = document.getElementById('searchQuery');
const cityFilterInput = document.getElementById('cityFilter');
const categoryFilterInput = document.getElementById('categoryFilter');
const minPriceFilterInput = document.getElementById('minPriceFilter');
const maxPriceFilterInput = document.getElementById('maxPriceFilter');
const limitFilterInput = document.getElementById('limitFilter');
const resultsContainer = document.getElementById('resultsContainer');

// Add event listener for DOMContentLoaded to load initial products
document.addEventListener('DOMContentLoaded', () => {
    loadInitialProducts();
});

searchButton.addEventListener('click', performSearch);

// Function to load initial products
async function loadInitialProducts() {
    console.log('Loading initial products...');
    resultsContainer.innerHTML = '<p>Loading products...</p>'; // Update initial message

    const initialPayload = {
        limit: 10 // Load a few more initially, adjust as needed
        // Add default filters here if desired
    };

    try {
        const response = await fetch('/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(initialPayload),
        });

        if (!response.ok) {
            // Try to parse error, fallback to status text
            let errorMsg = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.message || errorMsg;
            } catch (parseError) { /* Ignore if error response isn't JSON */ }
            throw new Error(errorMsg);
        }

        const results = await response.json();
        displayResults(results);

    } catch (error) {
        console.error('Initial load failed:', error);
        // Clear loading message and show error
        resultsContainer.innerHTML = `<p style="color: red;">Error loading initial products: ${error.message}</p>`;
    }
}

async function performSearch() {
    const query = searchQueryInput.value.trim();
    const city = cityFilterInput.value.trim();
    const category = categoryFilterInput.value.trim();
    const minPrice = minPriceFilterInput.value;
    const maxPrice = maxPriceFilterInput.value;
    const limit = limitFilterInput.value || 10; // Match initial load default or use input

    const searchPayload = {};
    if (query) searchPayload.query = query;
    if (city) searchPayload.city = city;
    if (category) searchPayload.category = category;
    if (minPrice !== '') searchPayload.minPrice = parseFloat(minPrice);
    if (maxPrice !== '') searchPayload.maxPrice = parseFloat(maxPrice);
    searchPayload.limit = parseInt(limit, 10);

    console.log('Sending search payload:', searchPayload);
    resultsContainer.innerHTML = '<p>Searching...</p>'; // Provide feedback

    try {
        const response = await fetch('/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(searchPayload),
        });

        if (!response.ok) {
            // Try to parse error, fallback to status text
            let errorMsg = `HTTP error! status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg = errorData.message || errorMsg;
            } catch (parseError) { /* Ignore if error response isn't JSON */ }
            throw new Error(errorMsg);
        }

        const results = await response.json();
        displayResults(results);

    } catch (error) {
        console.error('Search failed:', error);
        resultsContainer.innerHTML = `<p style="color: red;">Error during search: ${error.message}</p>`;
    }
}

function displayResults(results) {
    resultsContainer.innerHTML = ''; // Clear previous results or searching message

    if (!results || results.length === 0) {
        resultsContainer.innerHTML = '<p>No products found matching your criteria.</p>';
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