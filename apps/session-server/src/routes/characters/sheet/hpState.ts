/**
 * @deprecated The authoritative sheet state outgrew HP.
 * Import from "./characterState" in new code.
 *
 * This compatibility shim intentionally remains during the staged rename so
 * already-deployed clients/workers and older internal imports keep compiling.
 */
export * from "./characterState";
