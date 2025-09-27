console.log("[Prisma:pkg] @workspace/db loaded");
export { prisma } from "./client.js";
// Re-export types from the generated client to ensure consumers get the exact models for this package build
export type * from "../generated/prisma/index.js";