<a href="https://demo-nextjs-with-supabase.vercel.app/">
  <img alt="Schwer Online Management" src="https://demo-nextjs-with-supabase.vercel.app/opengraph-image.png">
  <h1 align="center">Schwer Online Management</h1>
</a>

<p align="center">
 Department-first operations portal with Next.js and Supabase
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#demo"><strong>Demo</strong></a> ·
  <a href="#deploy-to-vercel"><strong>Deploy to Vercel</strong></a> ·
  <a href="#clone-and-run-locally"><strong>Clone and run locally</strong></a> ·
  <a href="#feedback-and-issues"><strong>Feedback and issues</strong></a>
  <a href="#more-supabase-examples"><strong>More Examples</strong></a>
</p>
<br/>

## Current Behavior

- `/` is a public landing page with Login and Sign up calls to action.
- Protected routes redirect unauthenticated users to `/auth/login` and preserve intended destination via `redirectTo`.
- Post-auth routing converges to:
  - `/auth/choose-department` when department is missing
  - `/protected/{department}` when department is set
- Profile self-healing is enabled via server-side ensurement fallback and schema-backed RLS policy support.

## Feature 004: Sales Dashboard UI Overhaul

The sales workspace under `/protected/sales` now includes:

- Responsive sales navigation with tabbed sections for clients, quotations, and purchase orders.
- Client management with generated client codes, searchable table UI, and detail dialogs.
- Quotation approval workflow with role-based submit/approve/reject actions.
- Purchase-order tracking with collection recording and running recognized totals.
- Improved form validation and accessibility polish (inline errors, keyboard row activation, Esc-close dialogs).

### Feature 004 test commands

```bash
npm run test:unit
npm run test:integration
npx playwright test tests/e2e/sales-dashboard-layout.spec.ts tests/e2e/clients-create-search.spec.ts tests/e2e/quotations-approval-workflow.spec.ts tests/e2e/purchase-orders-collection.spec.ts
```

Authenticated Playwright specs require environment variables such as `E2E_SALES_LOGIN_EMAIL` / `E2E_SALES_LOGIN_PASSWORD` and role-specific approver credentials.

## Feature 005: Executive Dashboard

The executive workspace under `/protected/executive` now includes:

- Revenue YTD vs target, weighted YTD margin, and PO summary cards.
- Period-filtered revenue breakdown (`monthly`, `quarterly`, `ytd`) with URL-based filter state.
- Sales performance overview ranked by PO owner for the selected period.
- Yearly target editing with Target Editor authorization checks and server-side updates.

### Executive access model

- Viewer (read): `profiles.is_executive_viewer = true` and `profiles.is_active = true`
- Target Editor (write): `profiles.role in ('owner', 'executive')` and `profiles.is_active = true`

### Feature 005 test commands

```bash
npx vitest run tests/unit/executive/period.test.ts tests/unit/executive/metrics.test.ts tests/unit/executive/targets-validation.test.ts tests/unit/executive/sales-performance.test.ts tests/integration/executive-dashboard-kpis.test.ts tests/integration/executive-targets.test.ts tests/integration/executive-sales-performance.test.ts
npx playwright test tests/e2e/executive-dashboard.spec.ts tests/e2e/executive-dashboard-target.spec.ts tests/e2e/executive-dashboard-performance.spec.ts
```

## Features

- Works across the entire [Next.js](https://nextjs.org) stack
  - App Router
  - Pages Router
  - Proxy
  - Client
  - Server
  - It just works!
- supabase-ssr. A package to configure Supabase Auth to use cookies
- Password-based authentication block installed via the [Supabase UI Library](https://supabase.com/ui/docs/nextjs/password-based-auth)
- Styling with [Tailwind CSS](https://tailwindcss.com)
- Components with [shadcn/ui](https://ui.shadcn.com/)
- Optional deployment with [Supabase Vercel Integration and Vercel deploy](#deploy-your-own)
  - Environment variables automatically assigned to Vercel project

## Demo

You can view a fully working demo at [demo-nextjs-with-supabase.vercel.app](https://demo-nextjs-with-supabase.vercel.app/).

## Deploy to Vercel

Vercel deployment will guide you through creating a Supabase account and project.

After installation of the Supabase integration, all relevant environment variables will be assigned to the project so the deployment is fully functioning.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fnext.js%2Ftree%2Fcanary%2Fexamples%2Fwith-supabase&project-name=nextjs-with-supabase&repository-name=nextjs-with-supabase&demo-title=nextjs-with-supabase&demo-description=This+starter+configures+Supabase+Auth+to+use+cookies%2C+making+the+user%27s+session+available+throughout+the+entire+Next.js+app+-+Client+Components%2C+Server+Components%2C+Route+Handlers%2C+Server+Actions+and+Middleware.&demo-url=https%3A%2F%2Fdemo-nextjs-with-supabase.vercel.app%2F&external-id=https%3A%2F%2Fgithub.com%2Fvercel%2Fnext.js%2Ftree%2Fcanary%2Fexamples%2Fwith-supabase&demo-image=https%3A%2F%2Fdemo-nextjs-with-supabase.vercel.app%2Fopengraph-image.png)

The above will also clone the Starter kit to your GitHub, you can clone that locally and develop locally.

If you wish to just develop locally and not deploy to Vercel, [follow the steps below](#clone-and-run-locally).

## Clone and run locally

1. You'll first need a Supabase project which can be made [via the Supabase dashboard](https://database.new)

2. Create a Next.js app using the Supabase Starter template npx command

   ```bash
   npx create-next-app --example with-supabase with-supabase-app
   ```

   ```bash
   yarn create next-app --example with-supabase with-supabase-app
   ```

   ```bash
   pnpm create next-app --example with-supabase with-supabase-app
   ```

3. Use `cd` to change into the app's directory

   ```bash
   cd with-supabase-app
   ```

4. Rename `.env.example` to `.env.local` and update the following:

  ```env
  NEXT_PUBLIC_SUPABASE_URL=[INSERT SUPABASE PROJECT URL]
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=[INSERT SUPABASE PROJECT API PUBLISHABLE OR ANON KEY]
  ```
  > [!NOTE]
  > This example uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, which refers to Supabase's new **publishable** key format.
  > Both legacy **anon** keys and new **publishable** keys can be used with this variable name during the transition period. Supabase's dashboard may show `NEXT_PUBLIC_SUPABASE_ANON_KEY`; its value can be used in this example.
  > See the [full announcement](https://github.com/orgs/supabase/discussions/29260) for more information.

  Both `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` can be found in [your Supabase project's API settings](https://supabase.com/dashboard/project/_?showConnect=true)

5. You can now run the Next.js local development server:

   ```bash
   npm run dev
   ```

   The starter kit should now be running on [localhost:3000](http://localhost:3000/).

6. This template comes with the default shadcn/ui style initialized. If you instead want other ui.shadcn styles, delete `components.json` and [re-install shadcn/ui](https://ui.shadcn.com/docs/installation/next)

> Check out [the docs for Local Development](https://supabase.com/docs/guides/getting-started/local-development) to also run Supabase locally.

## Feedback and issues

Please file feedback and issues over on the [Supabase GitHub org](https://github.com/supabase/supabase/issues/new/choose).

## More Supabase examples

- [Next.js Subscription Payments Starter](https://github.com/vercel/nextjs-subscription-payments)
- [Cookie-based Auth and the Next.js 13 App Router (free course)](https://youtube.com/playlist?list=PL5S4mPUpp4OtMhpnp93EFSo42iQ40XjbF)
- [Supabase Auth and the Next.js App Router](https://github.com/supabase/supabase/tree/master/examples/auth/nextjs)
