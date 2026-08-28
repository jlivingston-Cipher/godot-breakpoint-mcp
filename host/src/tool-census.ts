/**
 * The tool census — how many tools this process actually registered.
 *
 * 🔴 WHY A WRAPPER AND NOT A CONSTANT. The surface a client is offered is not
 * `292`: `BREAKPOINT_TOOLSETS` filters whole groups and `applyCapabilities` drops
 * individual tools before they reach the SDK, so the only honest count is the one
 * taken at the point of registration. Every number in the documentation is a
 * measurement of a configuration; this is the measurement of THIS one, printed at
 * startup because the count is what a capped client refuses on (`client-caps.ts`)
 * and until now it was observable from nowhere but a document.
 *
 * 🔴 INSTALLED FIRST, AND FIRST MEANS INNERMOST. Each `apply*` makes itself the
 * OUTERMOST `registerTool` wrapper, so the one installed earliest is the last in
 * the call chain and sees only what every outer wrapper let through —
 * `applyCapabilities` drops a tool by never calling inward. A census installed
 * after it would count 292 attempts on every configuration and be wrong exactly
 * when it matters: on the least-privileged surface, which is the default.
 *
 * 🔵 AND IT COUNTS ITS OWN CALLS RATHER THAN READING THE SDK'S REGISTRY. A private
 * field read (`_registeredTools`) answers `0` the day the SDK renames it — a
 * reader that cannot fail, reporting a surface nobody has, which is the shape this
 * tree has paid for repeatedly. A counter over calls we make ourselves can only be
 * wrong if registration itself is.
 */

/** What the census wraps: the two registration paths a tool can arrive by. */
interface CensusTarget {
  registerTool: (name: string, config: unknown, handler: unknown) => unknown;
  experimental?: {
    tasks?: { registerToolTask?: (name: string, config: unknown, handler: unknown) => unknown };
  };
}

/**
 * Wrap `server`'s registration paths with a counter and return the reader.
 *
 * The returned function is live: call it after the last `register*Tools` call to
 * get the surface this process is serving. D2 task-model tools register through
 * `experimental.tasks.registerToolTask` rather than `registerTool`, so both paths
 * are counted or the count is short by however many long-running tools ship.
 */
export function installToolCensus(server: unknown): () => number {
  let registered = 0;
  const s = server as CensusTarget;

  const count =
    (raw: (name: string, config: unknown, handler: unknown) => unknown) =>
    (name: string, config: unknown, handler: unknown) => {
      registered += 1;
      return raw(name, config, handler);
    };

  s.registerTool = count(s.registerTool.bind(server as object) as never);

  const tasks = s.experimental?.tasks;
  if (tasks?.registerToolTask) {
    tasks.registerToolTask = count(tasks.registerToolTask.bind(tasks) as never);
  }

  return () => registered;
}
