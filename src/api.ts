/** Base URL of the TRACK AI server's API. Same origin by default; override with VITE_COACH_API_URL. */
export const API_BASE = (import.meta.env.VITE_COACH_API_URL as string | undefined)?.replace(/\/$/, '') ?? '';
