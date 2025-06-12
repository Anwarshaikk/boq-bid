import json
import time


def process_dwg(file_path):
    """Mock DWG parsing and return a Bill of Quantities."""
    # Simulate time-consuming work
    time.sleep(2)
    # Return dummy BoQ data
    return {
        "file": file_path,
        "items": [
            {"item_code": "A001", "description": "Mock Item", "quantity": 1, "unit": "m"}
        ]
    }
