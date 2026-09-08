import "server-only";

/**
 * admin domain service (master §10). Guards + audit from Phase 3; the Phase 11
 * dashboard reads (orders / tasks / customers / settings / activity / bulk) and
 * the bounded bulk runner. Every mutation still flows through the owning domain
 * service (orders / payments / shipping / refunds / returns / inventory) — this
 * module never re-implements a lifecycle rule.
 */
export * from "./guards";
export { auditLog } from "./audit";
export * from "./orders";
export * from "./tasks";
export * from "./customers";
export * from "./settings";
export * from "./activity";
export * from "./bulk";
