// Keep Worker-only runtime imports scoped: globally loading workers-types would
// replace the DOM types used by the Svelte client. Only this base constructor is
// used here; its implementation is supplied by workerd, never a browser shim.
declare module 'cloudflare:workers' {
  export abstract class DurableObject {
    constructor(ctx: import('@cloudflare/workers-types').DurableObjectState, env: unknown);
  }
}
