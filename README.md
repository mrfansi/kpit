This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Dependency Notes

**next-auth**: Currently pinned to `^5.0.0-beta.30` (beta). Stable `4.24.13` uses a different API (v4 vs v5). Do **not** upgrade to stable without a migration — the session/auth API differs significantly. Monitor https://authjs.dev for v5 stable release.

## Monthly Reports

The platform supports the internal monthly-report memo dated October 4, 2026.
Open **Laporan Bulanan** in the admin navigation (`/admin/reports/monthly`),
choose an existing domain and month, and explicitly map it to a memo division.

- Save a revisioned report snapshot with 2–4 main points plus one worst outcome
  (3–5 summary points total), KPI definitions/targets, deviation evidence,
  risks/escalation owners, next-month actions/PIC/deadlines, and optional C-level
  decisions. Editing the report does not overwrite the original KPI entries.
- Current and previous observations use exact reporting months. YTD supports
  explicitly chosen sum, average, month-end value, or numerator/denominator
  ratio; missing inputs are never replaced with zero or estimated. Known targets
  remain available independently of untracked actuals.
- Cite actuals, targets, and narrative numbers. Confirm untracked metrics as
  `belum dilacak`. Declare shared metric keys to reconcile sourced current,
  previous, and YTD figures across saved division reports.
- Save incomplete drafts and answer the displayed clarification questions.
  Final HTML presentation is blocked until required facts and confirmations are
  complete. Unsaved edits cannot be exported as if they were saved.
- Core decks contain 6 slides (7 with decisions), Finance 9 (10 with decisions,
  including income statement, cash flow, and balance sheet), and HR & Strategic
  Partnership 5. Allow approximately 10–15 minutes per division.
- Appendix history, raw data, channel breakdowns, and non-KPI activities are
  separate from core slides and their counter. **Buka lampiran** opens them;
  **Cetak mode ini** prints either the core deck or appendix mode.

The read-only report (`/report/{domain}?period=YYYY-MM-01`), domain Markdown
exports, presentation prompt, and HTML deck all use the same saved snapshot.
The portfolio report still provides raw organization-wide `full`/`brief` exports;
presentation exports require a selected domain.

**Periksa / Bantu dengan AI** returns clarification questions before making any
provider call. Once a saved report is complete, it can generate factual draft
speaker notes using the existing Cloudflare Workers AI configuration in
`.env.example`. No configured provider returns an explicit unavailable error;
manual reporting and deterministic HTML export do not require AI. Review AI
notes before use. The exported presentation prompt also supports clarification
in an external conversational AI tool.

### Database upgrade

Apply migrations before starting the updated application:

```bash
DATABASE_URL=/absolute/path/kpit.db corepack pnpm db:migrate
```

The migration runner preserves original SQL hashes in the Drizzle ledger,
handles historical multi-statement SQL, and skips applied migrations regardless
of old journal timestamps. Back up existing databases first. Databases with
unmanaged tables, unknown hashes, or incomplete migration history fail closed;
inspect and reconcile their baseline rather than blindly replaying migrations.
Do not use `db:seed` to upgrade an existing database.

