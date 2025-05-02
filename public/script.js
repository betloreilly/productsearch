const searchButton = document.getElementById('searchButton');
const searchQueryInput = document.getElementById('searchQuery');
const cityFilterInput = document.getElementById('cityFilter');
const categoryFilterInput = document.getElementById('categoryFilter');
const minPriceFilterInput = document.getElementById('minPriceFilter');
const maxPriceFilterInput = document.getElementById('maxPriceFilter');
const limitFilterInput = document.getElementById('limitFilter');
const resultsContainer = document.getElementById('resultsContainer');

searchButton.addEventListener('click', performSearch);

async function performSearch() {
    const query = searchQueryInput.value.trim();
    const city = cityFilterInput.value.trim();
    const category = categoryFilterInput.value.trim();
    const minPrice = minPriceFilterInput.value;
    const maxPrice = maxPriceFilterInput.value;
    const limit = limitFilterInput.value || 5; // Default limit if empty

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
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
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
            content += `<img src="${product.imageUrl}" alt="${product.name}" onerror="this.style.display='none'">`; // Hide image if it fails to load
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