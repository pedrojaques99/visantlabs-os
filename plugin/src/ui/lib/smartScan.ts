/**
 * Addressing for the smart-scan round-trip.
 *
 * `SMART_SCAN_SELECTION` → `SMART_SCAN_RESULT` is a broadcast: the sandbox posts the result to
 * the whole UI, and every listener sees every result. That was survivable while the two
 * requesters lived in tabs that unmounted each other, but they now sit in the same scroll —
 * so a scan fired from Tools › Extract would silently repopulate the logo matrix's assets.
 *
 * The requester stamps its id on the request; the sandbox echoes it back; each listener
 * ignores anything not addressed to it. Ids are literals, not generated: there is exactly one
 * of each requester mounted, and a stable id is debuggable in the message log. They live here
 * so a typo between sender and listener is a type error rather than a silent no-op — routing
 * on a mistyped string just makes the feature quietly stop working.
 */
export const SMART_SCAN_REQUESTER = {
  toolsIntelligence: 'tools-intelligence',
  brandMatrix: 'brand-matrix',
} as const;

export type SmartScanRequester = (typeof SMART_SCAN_REQUESTER)[keyof typeof SMART_SCAN_REQUESTER];

/** True when this result answers `requester`'s own request. */
export function isSmartScanFor(msg: { requester?: string }, requester: SmartScanRequester): boolean {
  return msg.requester === requester;
}
