# GymApp (PWA)

Offline workout, cardio and steps log. React + Vite + TypeScript, data in IndexedDB (idb), Excel export via exceljs.

- `npm run dev` – dev server
- `npm run build` – type-check and production build (`dist/`, includes the service worker)
- `npm test` – unit tests (vitest)
- `npm run lint` – oxlint
- `node scripts/make-icons.mjs` – regenerates the PNG icons
- `python -I -X utf8 scripts/xlsx_to_backup.py <xlsx> <out.json> [first_sheet_no]` – converts weekly Excel sheets to an importable backup
