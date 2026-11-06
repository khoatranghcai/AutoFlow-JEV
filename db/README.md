# Database

Postgres on Supabase. `migrations/` holds the schema; apply files in order.

- Staging project: `autoflow-jev-staging` (ref `hqmskicaaxjdnwekxdeq`, ap-southeast-1). Migration `0001_init.sql` is applied.
- Production project: not created yet. It must exist, with its own keys, before any real-money mode is enabled.
- Money is integer cents. `capital_ledger` and `approvals` are append-only (triggers); balances come from the `capital_balances` view.
- RLS is on for every table with no policies: only the API's service role can read or write. Never expose the service-role key to the browser.
