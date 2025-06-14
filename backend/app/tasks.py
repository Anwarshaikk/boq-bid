import json
import time
import os

def process_dwg(file_path):
    """Mock DWG parsing and return a Bill of Quantities."""
    print(f"🛠️ Worker is processing: {file_path}", flush=True)
    try:
        print(f"📂 Processing file: {file_path}")
        time.sleep(2)

        # Check if file exists (safety)
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"❌ File not found: {file_path}")

        # Return dummy BoQ data
        return {
            "file": file_path,
            "items": [
                {"item_code": "A001", "description": "Mock Item", "quantity": 1, "unit": "m"}
            ]
        }

    except Exception as e:
        print(f"❌ Error in task: {str(e)}")
        raise  # RQ will log it and mark job as failed
