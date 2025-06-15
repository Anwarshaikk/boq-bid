import pdfplumber
import re
import json
import os

# --- Configuration ---
# Path to the input DAR PDF file.
# This script assumes the PDF is in the same directory.
INPUT_PDF_PATH = 'DAR_Vol1_UPDATE_DEC_2021.pdf' 

# Path for the final JSON output file.
# It will be saved in the backend app directory to be used by the main application.
OUTPUT_JSON_PATH = '../backend/app/dar_cost_library.json'

def parse_dar_pdf():
    """
    Parses the CPWD DAR 2021 PDF to extract item codes, descriptions, units, and rates.
    
    This is a utility script to be run once to generate a clean JSON data file
    for the main application. It uses regular expressions to find lines that match
    the typical format of an item in the DAR document.
    """
    if not os.path.exists(INPUT_PDF_PATH):
        print(f"Error: Input PDF not found at '{INPUT_PDF_PATH}'")
        return

    print(f"🔍 Starting parsing of '{INPUT_PDF_PATH}'...")
    
    # This regex is designed to capture lines that start with an item code (e.g., 1.1, 1.2.3)
    # followed by a description, and ending with a unit and a rate.
    # It looks for:
    #   ^(\d{1,2}(?:\.\d{1,2}){1,2})\s+  - Group 1: Item code (e.g., 4.1.3)
    #   (.+?)                           - Group 2: Description (non-greedy)
    #   \s+(each|sqm|cum|quintal|...)\s+ - Group 3: Unit (common construction units)
    #   (\d+\.\d{2})$                    - Group 4: Rate (a number ending in .xx)
    item_regex = re.compile(
        r"^(\d{1,2}(?:\.\d{1,2}){1,3})\s+(.+?)\s+(each|sqm|cum|quintal|tonne|metre|day|Nos|kg)\s+(\d+\.\d{2})$", 
        re.IGNORECASE
    )

    extracted_items = []

    with pdfplumber.open(INPUT_PDF_PATH) as pdf:
        for i, page in enumerate(pdf.pages):
            print(f"  -> Processing page {i + 1}/{len(pdf.pages)}...")
            text = page.extract_text()
            if not text:
                continue

            for line in text.split('\n'):
                match = item_regex.match(line)
                if match:
                    # Extract the captured groups
                    code = match.group(1).strip()
                    description = match.group(2).strip()
                    unit = match.group(3).strip()
                    rate = float(match.group(4))

                    # Perform a basic sanity check to avoid unwanted lines
                    if len(description) > 10 and not description.lower().startswith("total"):
                        item_data = {
                            "code": code,
                            "description": description,
                            "unit": unit,
                            "rate": rate
                        }
                        extracted_items.append(item_data)

    print(f"\n✅ Parsing complete. Found {len(extracted_items)} items.")

    # Save the extracted data to the JSON file
    try:
        # Create the directory if it doesn't exist
        output_dir = os.path.dirname(OUTPUT_JSON_PATH)
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)

        with open(OUTPUT_JSON_PATH, 'w') as f:
            json.dump(extracted_items, f, indent=2)
        
        print(f"💾 Successfully saved cost library to '{OUTPUT_JSON_PATH}'")
    except Exception as e:
        print(f"🔥 Error saving JSON file: {e}")

if __name__ == "__main__":
    parse_dar_pdf()

