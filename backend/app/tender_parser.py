import requests
from bs4 import BeautifulSoup
import datetime

# The target URL for the Central Public Procurement Portal's latest active tenders.
# This is a real, public-facing government website.
TENDER_URL = "https://eprocure.gov.in/eprocure/app?page=FrontEndLatestActiveTenders&service=page"

def scan_tender_portal():
    """
    Scrapes the government's e-procurement portal for the latest active tenders.
    This replaces the placeholder function with a real web scraper.
    """
    print("🔎 Scraping tender portal for active contracts...", flush=True)
    
    try:
        # Set a timeout to prevent the request from hanging indefinitely.
        # Use a user-agent to mimic a real browser visit.
        headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}
        response = requests.get(TENDER_URL, timeout=20, headers=headers)
        # Raise an exception if the request was not successful (e.g., 404, 500)
        response.raise_for_status()
    except requests.RequestException as e:
        print(f"🔥 Failed to fetch tender data: {e}", flush=True)
        # Return a structured error that the frontend can display
        return {
            "error": "Could not connect to the tender portal. It may be down or your connection has an issue.",
            "scan_date": datetime.date.today().isoformat(),
            "tenders": []
        }

    soup = BeautifulSoup(response.text, 'html.parser')
    
    tenders = []
    # Find the table containing the latest tenders by its ID
    tender_table = soup.find('table', id='latestTenders')
    
    if not tender_table:
        print("🔥 Could not find the tender table on the page. The portal's HTML structure may have changed.", flush=True)
        return {"error": "Could not parse the tender portal page.", "tenders": []}

    # Extract tender data from each row in the table body, skipping the header
    for row in tender_table.find('tbody').find_all('tr'):
        cols = row.find_all('td')
        # Ensure the row has the expected number of columns
        if len(cols) > 4:
            try:
                title = cols[2].text.strip()
                # The link is inside an 'onclick' attribute, so we extract the URL part
                link_raw = cols[2].find('a')['onclick']
                link = "https://eprocure.gov.in/eprocure/app" + link_raw.split("=")[1].split("'")[0]
                
                # The portal uses 'DD-Mon-YYYY HH:MM AM/PM' format
                closing_date_str = cols[4].text.strip()
                deadline = datetime.datetime.strptime(closing_date_str, '%d-%b-%Y %I:%M %p').isoformat()

                tenders.append({
                    "id": f"TNDR-{row.find_all('td')[0].text.strip()}", # Use S.No as part of a unique ID
                    "title": title,
                    "deadline": deadline,
                    "link": link
                })
            except (TypeError, KeyError, IndexError, ValueError) as e:
                 # Log if a specific row is malformed, but continue processing others
                 print(f"⚠️  Skipping a row due to a parsing error: {e}", flush=True)
                 continue

    print(f"✅ Found {len(tenders)} active tenders.", flush=True)
    return {
        "scan_date": datetime.date.today().isoformat(),
        "portal_name": "Central Public Procurement Portal",
        # Return the top 10 tenders to keep the UI clean
        "tenders": tenders[:10]
    }
