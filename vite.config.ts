import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
      // Runtime types retype DOM globals (e.g. Response.json() becomes unknown) for client code too;
      // src/types/cloudflare-bindings.d.ts supplies the binding types instead.
      types: { includeRuntime: false },
    }),
  ],
});
