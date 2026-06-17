from flask import Flask, jsonify, render_template, request
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
import requests
import re
import time
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Simple in-memory cache
cache = {
    "data": None,
    "last_updated": 0
}
CACHE_DURATION_SECS = 300  # 5 minutes cache for standard requests

def parse_release_notes():
    """Fetches the Google Cloud feed and parses individual release items."""
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    logger.info("Fetching release notes from Google Cloud feed...")
    response = requests.get(url, headers=headers, timeout=15)
    response.raise_for_status()
    
    logger.info("Successfully fetched feed. Parsing XML...")
    root = ET.fromstring(response.content)
    
    # Atom namespace
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = []
    
    for entry in root.findall('atom:entry', ns):
        # Extract title (which acts as the date of release notes group)
        title_el = entry.find('atom:title', ns)
        date_str = title_el.text if title_el is not None else "Unknown Date"
        
        # Extract ISO updated timestamp
        updated_el = entry.find('atom:updated', ns)
        iso_date = updated_el.text if updated_el is not None else ""
        
        # Extract alternate link to official release notes site
        link_el = entry.find("atom:link[@rel='alternate']", ns)
        if link_el is None:
            link_el = entry.find("atom:link", ns)
        link_url = link_el.attrib.get('href', 'https://cloud.google.com/bigquery/docs/release-notes') if link_el is not None else ''
        
        # Extract HTML content
        content_el = entry.find('atom:content', ns)
        if content_el is None or not content_el.text:
            continue
            
        content_html = content_el.text
        
        # Parse content_html to split into multiple release note items based on <h3> elements
        soup = BeautifulSoup(content_html, 'html.parser')
        
        # Resolve any relative links to absolute links
        for a in soup.find_all('a', href=True):
            href = a['href']
            if href.startswith('/'):
                a['href'] = 'https://cloud.google.com' + href
                a['target'] = '_blank'
                a['rel'] = 'noopener noreferrer'
            elif href.startswith('http'):
                a['target'] = '_blank'
                a['rel'] = 'noopener noreferrer'

        # Look for category headings (<h3>)
        h3s = soup.find_all('h3')
        
        if not h3s:
            # Fallback if there are no <h3> tags inside the entry
            text_content = soup.get_text(separator=' ').strip()
            text_content = re.sub(r'\s+', ' ', text_content)
            
            entries.append({
                "id": f"{date_str.replace(' ', '_')}_general",
                "date": date_str,
                "iso_date": iso_date,
                "link": link_url,
                "category": "Update",
                "content_html": str(soup),
                "content_text": text_content
            })
            continue
            
        # Extract each <h3> (category) and its corresponding body (all siblings until next <h3>)
        for idx, h3 in enumerate(h3s):
            category = h3.get_text().strip()
            
            sibling_htmls = []
            sibling_texts = []
            curr = h3.next_sibling
            
            while curr and curr.name != 'h3':
                if curr.name:
                    # Clean links inside the current sibling tag
                    for a in curr.find_all('a', href=True):
                        href = a['href']
                        if href.startswith('/'):
                            a['href'] = 'https://cloud.google.com' + href
                        a['target'] = '_blank'
                        a['rel'] = 'noopener noreferrer'
                        
                    sibling_htmls.append(str(curr))
                    sibling_texts.append(curr.get_text(separator=' ').strip())
                elif isinstance(curr, str) and curr.strip():
                    sibling_htmls.append(curr.strip())
                    sibling_texts.append(curr.strip())
                curr = curr.next_sibling
                
            item_html = "".join(sibling_htmls).strip()
            item_text = " ".join(sibling_texts).strip()
            item_text = re.sub(r'\s+', ' ', item_text)
            # Clean up spaces before punctuation marks (e.g. "Explorer ." -> "Explorer.")
            item_text = re.sub(r'\s+([.,;:!?])', r'\1', item_text)
            
            # Make a robust, unique item ID
            clean_category = re.sub(r'[^a-zA-Z0-9]', '', category).lower()
            item_id = f"{date_str.replace(' ', '_')}_{clean_category}_{idx}"
            
            entries.append({
                "id": item_id,
                "date": date_str,
                "iso_date": iso_date,
                "link": link_url,
                "category": category,
                "content_html": item_html,
                "content_text": item_text
            })
            
    logger.info(f"Successfully parsed {len(entries)} release note items.")
    return entries

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    current_time = time.time()
    
    # Check if cache is valid and refresh is not forced
    if cache["data"] is not None and not force_refresh and (current_time - cache["last_updated"] < CACHE_DURATION_SECS):
        logger.info("Serving release notes from cache.")
        return jsonify({
            "status": "success",
            "source": "cache",
            "last_updated": cache["last_updated"],
            "data": cache["data"]
        })
        
    try:
        data = parse_release_notes()
        cache["data"] = data
        cache["last_updated"] = current_time
        
        return jsonify({
            "status": "success",
            "source": "live",
            "last_updated": current_time,
            "data": data
        })
    except Exception as e:
        logger.error(f"Error occurred: {str(e)}")
        
        # If live fetch fails but cache has data, fall back to cache
        if cache["data"] is not None:
            logger.warning("Live fetch failed. Serving stale data from cache.")
            return jsonify({
                "status": "partial_success",
                "source": "stale_cache",
                "last_updated": cache["last_updated"],
                "error": str(e),
                "data": cache["data"]
            })
            
        return jsonify({
            "status": "error",
            "message": "Failed to retrieve release notes",
            "error": str(e)
        }), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
