# 📘 Codex Commands for BoQ-AI PoC

This file contains copy-paste-ready prompts for ChatGPT Codex, Gemini, or GitHub Copilot to help you implement features in your BoQ-AI project without manual coding.

---

## ✅ 1. Add Docker Compose (Backend + Frontend)

Prompt:
```
My Flask backend is in `/backend/app/`, and React frontend is in `/frontend/`. 
Create a `docker-compose.yml` file that:
- Builds and serves the Flask backend on port 8080
- Builds the Vite React frontend on port 5173
- Ensures CORS and cross-service communication works.
Also give me a Dockerfile for the backend.
```

---

## ✅ 2. Add Background Queue for Long Jobs

Prompt:
```
Modify my Flask app in `/backend/app/main.py` to:
- Accept a file upload
- Enqueue the job to an RQ queue
- Return a job ID
- Add `/status/<job_id>` endpoint to poll job status

Also generate:
- A Redis setup for local testing
- A worker runner script (e.g., `worker.py`)
```

---

## ✅ 3. Add Rule Extractor for Spec PDFs

Prompt:
```
Create a script `rule_extractor.py` that:
- Uses `pdfplumber` to extract text from a PDF
- Splits text into 1000-token chunks
- Sends each chunk to OpenAI GPT-4 with the prompt: 'Extract all construction rules'
- Output: JSON file with rule_id, description, value, unit, page
```

---

## ✅ 4. Add Item List Parser (PDF/DOC/XLS)

Prompt:
```
Create `item_parser.py` that:
- Detects file type (PDF, DOCX, XLSX)
- Extracts tabular data into JSON:
  {item_code, description, unit}
- Cleans merged rows, extra line breaks, etc.
```

---

## ✅ 5. Add Duplicate Guard (DWG Layers)

Prompt:
```
In `rules.py`, add a function to:
- Hash each entity using layer + type + centroid
- Store seen hashes in a set
- Skip duplicates when calculating quantities
```

---

## ✅ 6. Implement Site > Building > Floor Grouping

Prompt:
```
Update BoQ extraction so that:
- Drawing filenames like BldgA_L02_plan.dwg are parsed into hierarchy
- Output JSON groups quantities by:
  site > building > floor > item
```

---

## ✅ 7. Add Vendor/Client Cost Toggle

Prompt:
```
In the frontend React table, allow user to:
- Toggle between 'Gov Rates' and 'Vendor X Rates'
- Store cost datasets in a `vendors.json` file
- Recalculate total and margin dynamically
```

---

## ✅ 8. Deploy to Cloud Run

Prompt:
```
Write a GitHub Action that:
- Builds the Docker image from backend/
- Pushes it to Google Artifact Registry
- Deploys to Cloud Run on push to `main`
```

---

## ✅ 9. Generate Excel Report with Pricing

Prompt:
```
Update `excel_writer.py` to:
- Add columns: Unit Price, Line Cost
- Format headers bold, background grey
- Calculate total project cost at bottom
```

---

## ✅ 10. Summary Status Checker

Prompt:
```
Write a script that prints:
- Number of uploaded drawings
- Number of items parsed
- Number of mapped BoQ lines
- Total project cost (both vendor and gov rates)
```

---