# Ltd Filer

An Excel add-in (Office.js task pane) plus a small filing service for preparing and submitting UK limited company
**annual accounts (Companies House)** and **CT600 returns (HMRC)**.

- `packages/core`: tax calculation, statements, iXBRL accounts, CT600/GovTalk XML, IRmark.
- `packages/server`: Express filing service. Holds credentials, submits to the gateways, stores history.
- `packages/addin`: React + Fluent UI task pane and `manifest.xml`.

## Run it
```
npm install
npm run dev:server        # http://localhost:4000
npm run dev:addin         # https://localhost:3000 (self-signed cert; trust it)
```
Sideload `packages/addin/manifest.xml` in Excel (Insert → My Add-ins → Upload My Add-in, or `npx office-addin-debugging start`).
In the pane: **Create template sheet**, fill the `Inputs` sheet, **Load from sheet**, review, submit.

## Modes
| Mode | Behaviour |
| --- | --- |
| mock | Nothing leaves your machine. Default. |
| test | Sends to the HMRC / Companies House **test** services (needs credentials). |
| live | Real filing. Needs `ENABLE_LIVE=true` on the server and an explicit confirmation in the pane. |

Server environment variables: `VENDOR_ID`, `DECLARANT_NAME`, `HMRC_SENDER_ID`, `HMRC_PASSWORD`,
`CH_PRESENTER_ID`, `CH_AUTH_CODE`, `ENABLE_LIVE`, `PORT`, `DATA_FILE`, plus optional `*_TEST_URL` / `*_LIVE_URL` overrides.

## Tests
```
npm run check       # typecheck + unit/integration (vitest)
npm run test:e2e    # Playwright against the add-in running outside Excel with sample data
```

## Before filing for real
This software is **not yet recognised** by HMRC or Companies House.
1. Register with HMRC's Software Developer Support Team for CT online filing and Companies House for an XML Gateway presenter ID. Both are free.
2. Validate the generated CT600 XML and iXBRL against their current schemas and taxonomies (the builders here are simplified, and the taxonomy namespaces in `ixbrl.ts` and the CT elements in `ct600.ts` must be checked).
3. Pass their test submissions, then enable live mode.
4. Have an accountant review the tax logic (small profits rate, marginal relief, associated companies, losses). Not covered: R&D, group relief, chargeable gains, loans to participators, etc.
