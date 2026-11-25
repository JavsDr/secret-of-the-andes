# Secret of the Andes

The [website](https://secret-of-the-andes.politebrioche2.chatgpt.site/) features [Estancias & Glaciers](https://secret-of-the-andes.politebrioche2.chatgpt.site/patagonia/). The printable itinerary uses the product page’s print stylesheet. The gallery identifies the original photographers and licences.

## Production

This repository is the source for the public pages and the hosted enquiry service. The Sites worker serves the public files, confirms accepted enquiries after committing to D1, and exposes an authenticated pull-and-ack interface to OpenClaw. The private importer uses the reference as a durable CRM key. After acknowledgment, the pending queue clears the contact fields. The legacy GitHub Pages address forwards viewers with their query and section intact.

To publish updates, stage the public files from a clean checkout with Python 3 and Pillow: `python _hosting/stage.py /path/to/sites-checkout`. That destination must have the existing Sites project identity. From the staged checkout run `node build.mjs` and publish using the Sites versioning workflow. The runtime secret is configured in the hosting environment and in the private CRM importer. Never include it in a source checkout. Generate new migrations in `_hosting` with `pnpm run db:generate` before staging.

The enquiry queue API is private. Travellers can also use the direct email link on the itinerary. Review routes, supplier arrangements, occupancy and current pricing before publishing a confirmed departure.

## Itinerary visit-to-enquiry rate

OpenClaw can read `GET /api/internal/funnel?days=30` with the same bearer token as the enquiry queue. The default is 30 days and the supported range is 1–90. The result gives the rolling UTC interval (`from`, `through`), `totals` and `by_source`. Each row reports measured `sessions`, distinct `enquiring_sessions` and their ratio `conversion_rate` (0–1, or null when there are no visits).

A session begins on a measured visit to the eight-day itinerary in a browser tab. Refreshes and repeat visits in that tab reuse a random key for up to 24 hours. A confirmed form submission during that period counts once for the original visit's channel. The report selects sessions by the time of their first visit. Email enquiries, unmeasured visits, the research campaigns `usability_test` and `user_test`, and authenticated test submissions are excluded. With JavaScript or session storage blocked, the visitor can still use the direct email link. With storage blocked, the online form also accepts enquiries without measurement.

The metrics table contains a random session key, a fixed channel label and two timestamps. It keeps no contact fields, IPs, referrer URLs or raw campaign strings. Rows older than 90 days are cleared at the next measured visit or report request.
