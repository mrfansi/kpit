import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Every page reads D1 per request, so no ISR/incremental cache is needed.
export default defineCloudflareConfig({});
