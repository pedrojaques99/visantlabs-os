// Ambient declarations for optional/untyped peer modules.
// `potrace` ships no types; `jsdom` types aren't installed in every consumer.
// We only touch a tiny, dynamically-imported surface, so `any` is intentional.
declare module 'potrace';
declare module 'jsdom';
