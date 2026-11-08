import { z } from "zod";

// CSP produksi melarang eval; tanpa ini zod mencoba Function("") dan CSP melaporkan pelanggaran.
z.config({ jitless: true });
