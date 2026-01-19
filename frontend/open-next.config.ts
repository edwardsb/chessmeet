import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // Using dummy caches since we don't need ISR or tag-based revalidation
});
