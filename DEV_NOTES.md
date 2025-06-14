# Dev Notes

## Multi-file Upload Component
- Added `frontend/src/Upload.jsx` implementing drag/drop or multi-select of DWG/DXF or ZIP files.
- Each file uploads individually to `/api/boq` with Axios `onUploadProgress` reporting progress.
- Table lists **File**, **Status**, and **Progress %** while polling `/status/<job_id>` every 2s until completion.
- `App.jsx` imports and renders this component alongside existing BoQ UI.
- Vite proxy configured in `vite.config.js` to forward `/api` requests to `VITE_API_URL`.
