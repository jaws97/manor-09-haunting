/**
 * Numbers spelled out, for the copy that says the size of the cast aloud —
 * the title card, the teaser, the keeper's lines.
 *
 * It lives here, apart from the resident data, because the public gate page
 * needs the word but must never import `@/data/residents`: the titles are the
 * surprise and may not ship in a public client bundle before the reveal.
 */
const WORDS = [
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen",
  "nineteen", "twenty", "twenty-one", "twenty-two", "twenty-three", "twenty-four",
  "twenty-five", "twenty-six", "twenty-seven", "twenty-eight", "twenty-nine", "thirty",
  "thirty-one", "thirty-two", "thirty-three", "thirty-four", "thirty-five",
];

/** `countInWords(28)` → "twenty-eight"; `capital` for the start of a sentence. */
export const countInWords = (n: number, capital = false) => {
  const w = WORDS[n] ?? String(n);
  return capital ? w[0].toUpperCase() + w.slice(1) : w;
};
