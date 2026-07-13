/** Check if an ID is a persisted MongoDB ObjectId (24 hex chars). */
export const isPersistedId = (id: string | null): id is string =>
  !!id && /^[a-f0-9]{24}$/i.test(id);
