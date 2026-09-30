/**
 * The articles featured on the home page. A copy of their titles, so the app doesn't load every
 * article (src/site/articles.ts); a test checks they match.
 */
export const FEATURED: { slug: string; title: string; text: string }[] = [
  { slug: 'beginner-full-body-workout', title: 'A 20-minute beginner full-body workout (no equipment)', text: 'Five moves, three rounds, and a four-week plan.' },
  { slug: 'knees-caving-in-squat', title: 'Knees caving in when you squat? How to fix it', text: 'Why it happens, and five cues that fix it.' },
  { slug: 'how-ai-form-tracking-works', title: 'How AI form tracking works', text: 'From camera frames to spoken cues, all on your phone.' },
];
