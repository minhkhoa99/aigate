export declare const DEFAULT_MAX_BODY_BYTES: number;
export declare function readBoundedText(body: ReadableStream<Uint8Array> | null, maxBytes?: number): Promise<string>;
