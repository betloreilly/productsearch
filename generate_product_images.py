import os
import json
import requests
from openai import OpenAI
import time

# --- Configuration ---
PRODUCTS_JSON_PATH = 'data/products2.json' # Changed temporarily for batch 2
IMAGE_SIZE = "1024x1024"  # DALL-E 3 supports 1024x1024, 1792x1024, 1024x1792
IMAGE_QUALITY = "standard" # options: standard, hd
DALLE_MODEL = "dall-e-3"
# --- End Configuration ---

# --- Helper Functions ---
def generate_dalle_prompt(product):
    """Creates a DALL-E prompt from product details."""
    # More descriptive prompt for better results
    return f"High-quality e-commerce product photo of '{product['name']}'. Product details: {product['description']}. Clean white background, studio lighting. Realistic style."

def download_image(image_url, save_path):
    """Downloads an image from a URL and saves it locally."""
    try:
        response = requests.get(image_url, stream=True, timeout=60)
        response.raise_for_status()  # Raise an exception for bad status codes

        # Ensure the directory exists
        os.makedirs(os.path.dirname(save_path), exist_ok=True)

        with open(save_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        print(f"Successfully downloaded: {save_path}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"Error downloading {image_url}: {e}")
        return False
    except IOError as e:
        print(f"Error saving image to {save_path}: {e}")
        return False

# --- Main Script ---
def main():
    # Initialize OpenAI client (fetches key from OPENAI_API_KEY env var)
    try:
        client = OpenAI()
    except Exception as e:
        print(f"Error initializing OpenAI client: {e}")
        print("Ensure the OPENAI_API_KEY environment variable is set correctly.")
        return

    # Load product data
    try:
        with open(PRODUCTS_JSON_PATH, 'r') as f:
            products = json.load(f)
    except FileNotFoundError:
        print(f"Error: Product data file not found at {PRODUCTS_JSON_PATH}")
        return
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from {PRODUCTS_JSON_PATH}")
        return

    print(f"Found {len(products)} products. Starting image generation...")

    for product in products:
        product_id = product.get('productId', 'unknown_product')
        image_path = product.get('imageUrl')

        if not image_path:
            print(f"Skipping product {product_id}: missing 'imageUrl'.")
            continue

        # Check if image already exists
        if os.path.exists(image_path):
            print(f"Skipping product {product_id}: Image already exists at {image_path}")
            continue

        print(f"\nProcessing product: {product_id} ({product.get('name', 'N/A')})")

        # Generate DALL-E prompt
        dalle_prompt = generate_dalle_prompt(product)
        print(f"  -> DALL-E Prompt: {dalle_prompt}")

        # Generate image with DALL-E
        try:
            print("  -> Requesting image from DALL-E...")
            response = client.images.generate(
                model=DALLE_MODEL,
                prompt=dalle_prompt,
                size=IMAGE_SIZE,
                quality=IMAGE_QUALITY,
                n=1, # Generate one image
                response_format='url' # Get URL to download from
            )

            # DALL-E 3 gives the URL directly
            generated_image_url = response.data[0].url
            print(f"  -> DALL-E URL: {generated_image_url}")

            # Download the generated image
            print(f"  -> Downloading image to: {image_path}")
            if not download_image(generated_image_url, image_path):
                 print(f"  -> Failed to download image for {product_id}.")

        except Exception as e:
            print(f"Error generating/downloading image for {product_id}: {e}")

        # Optional: Add a small delay to avoid hitting rate limits if generating many images
        # time.sleep(1)

    print("\nImage generation process complete.")

if __name__ == "__main__":
    main() 