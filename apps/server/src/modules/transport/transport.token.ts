// Kept separate from the Nest module so controllers can inject it without an ESM import cycle.
export const HTTP_TRANSPORT = Symbol("HTTP_TRANSPORT");
