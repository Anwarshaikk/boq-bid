# BOQ‑BID • CONTEXT.md  

*Reference sheet for every AI chat and human collaborator*

---

## 1  Project Goal

> **Automate generation of a Bill of Quantities (BoQ) and a Bid Value** from multi‑drawing DWG/DXF uploads, government rule/spec PDFs, material cost sheets, and vendor price lists — delivered as a styled Excel report and live dashboard.

---

## 2  Tech Stack (PoC)

| Layer                | Choice                             | Notes                                       |
| -------------------- | ---------------------------------- | ------------------------------------------- |
| **Backend API**      | Python 3.11 + **Flask**            | `/api/boq`, `/status/<job>`                 |
| **Async Queue**      | **Redis + RQ**                     | One worker container                        |
| **Drawing Parser**   | `ezdxf` + rules.py                 | Duplicate‑hash guard                        |
| **Doc Intelligence** | `pdfplumber` + **GPT‑4**           | Rule & material extraction                  |
| **Merge Engine**     | `pandas` / custom merge\_engine.py | Joins quantities ↔ rules ↔ cost             |
| **Front‑end**        | React 18 + Vite + Tailwind         | Multi‑file upload, status grid, cost toggle |
| **Excel Export**     | `openpyxl`                         | Styled, totals, margin                      |
| **Runtime**          | **Docker Compose**                 | backend, frontend, redis, worker            |

---

## 3  Locked PoC Features

1. **Multi‑DWG ingestion** (ZIP or multiple selects)
2. **Async job queue** with status polling
3. **Duplicate geometry guard**
4. **Hierarchy grouping** — Site › Building › Floor
5. **PDF Material Schedule → JSON catalogue**
6. **PDF/XLS Rule Spec → JSON rules**
7. **Cost sheet parse** (Gov) + **Vendor toggle**
8. **Styled Excel export & margin calc**
9. **Single‑page React dashboard** (uploads • rules • BoQ)

---

## 4  Acceptance Tests

| ID       | Scenario                       | Pass Criteria                                         |
| -------- | ------------------------------ | ----------------------------------------------------- |
| **AT‑1** | Upload ZIP w/ 3 DWGs           | UI shows 3 rows → status `finished` w/o error         |
| **AT‑2** | Duplicate entity across 2 DWGs | BoQ counts it **once**                                |
| **AT‑3** | Upload `materials.pdf`         | ≥ 95 % rows appear in Materials tab                   |
| **AT‑4** | Upload `rules_spec.pdf`        | ≥ 80 % rules extracted, editable                      |
| **AT‑5** | Toggle **Gov ↔ Vendor**        | Total cost updates, margin card recalcs               |
| **AT‑6** | Download Excel                 | File opens; header bold; total & margin cells present |

---

## 5  Prompt Template (for all AI chats)

```
You are {role} for BOQ‑BID.
Refer to CONTEXT.md below between the fences.
---
[PASTE THIS FILE]
---
Task: {clear, outcome‑oriented request}
Acceptance: {reference AT‑X if relevant}
```
