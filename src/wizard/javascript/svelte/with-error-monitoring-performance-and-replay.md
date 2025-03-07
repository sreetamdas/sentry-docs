---
name: Svelte
doc_link: https://docs.sentry.io/platforms/javascript/guides/svelte/
support_level: production
type: framework
---

## Install

Sentry captures data by using an SDK within your application’s runtime.

```bash
# Using yarn
yarn add @sentry/svelte

# Using npm
npm install --save @sentry/svelte
```

## Configure

Initialize Sentry as early as possible in your application's lifecycle.

```javascript
import "./app.css";
import App from "./App.svelte";

import * as Sentry from "@sentry/svelte";

Sentry.init({
  dsn: "___PUBLIC_DSN___",
  integrations: [new Sentry.BrowserTracing(), new Sentry.Replay()],
  // Performance Monitoring
  tracesSampleRate: 1.0, // Capture 100% of the transactions, reduce in production!
  // Session Replay
  replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
  replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
});

const app = new App({
  target: document.getElementById("app"),
});

export default app;
```

## Verify

This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected.

```html
// SomeComponent.svelte
<button type="button" on:click="{unknownFunction}">Break the world</button>
```

---

## Next Steps

- [Source Maps](https://docs.sentry.io/platforms/javascript/guides/svelte/sourcemaps/): Learn how to enable readable stack traces in your Sentry errors.
- [Svelte Features](https://docs.sentry.io/platforms/javascript/guides/svelte/features/): Learn about our first class integration with the Svelte framework.
