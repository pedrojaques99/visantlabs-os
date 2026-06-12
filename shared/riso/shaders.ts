/**
 * Riso GLSL Shaders — thin re-export of @visant/print-fx.
 *
 * The vertex + fragment shader source now lives in the package
 * (`@visant/print-fx/riso`). Kept here as a re-export so existing importers
 * (client RisoRenderer, server risoRenderer) keep their path; client and server
 * run the identical shader source.
 */
export { RISO_VERTEX_SHADER, RISO_FRAGMENT_SHADER } from '@visant/print-fx/riso';
