# Secret of the Andes

The [website](https://secret-of-the-andes.politebrioche2.chatgpt.site/) features [Estancias & Glaciers](https://secret-of-the-andes.politebrioche2.chatgpt.site/patagonia/). The printable itinerary uses the product page’s print stylesheet. The gallery identifies the original photographers and licences.

## Production

This repository is the source for the public pages and the hosted enquiry service. The Sites worker serves the public files, confirms accepted enquiries after committing to D1, and exposes an authenticated pull-and-ack interface to OpenClaw. The private importer uses the reference as a durable CRM key. After acknowledgment, the pending queue clears the contact fields. The legacy GitHub Pages address forwards viewers with their query and section intact.

To publish updates, stage the public files from a clean checkout with Python 3 and Pillow: `python _hosting/stage.py /path/to/sites-checkout`. That destination must have the existing Sites project identity. From the staged checkout run `node build.mjs` and publish using the Sites versioning workflow. The runtime secret is configured in the hosting environment and in the private CRM importer. Never include it in a source checkout. Generate new migrations in `_hosting` with `pnpm run db:generate` before staging.

The enquiry queue API is private. Travellers can also use the direct email link on the itinerary. Review routes, supplier arrangements, occupancy and current pricing before publishing a confirmed departure.
