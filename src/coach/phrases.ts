/** Generic coaching lines. Exercise-specific cues live with each exercise definition. */

export const PHRASES = {
  ready: ["Got you! Let's go.", "Perfect, I can see you. Let's go!", "You're all set. Go!"],
  readyWithTarget: (n: number, name: string) => [
    `Got you! ${n} ${name.toLowerCase()}. Let's go!`,
    `Perfect. ${n} reps — let's go!`,
    `I can see you. ${n} reps, nice and controlled. Go!`,
  ],
  holdReady: (seconds: number | null) =>
    seconds ? [`Hold it for ${seconds} seconds. Timer starts now!`, `Timer's running — ${seconds} seconds. Hold it!`] : ["Timer's running. Hold it!"],
  holdResume: ['Timer running again.', "That's it, back in position."],
  cleanAfterFault: ['Better!', "That's it — much better!", 'Nice fix!', 'Yes, like that!'],
  streak: ['Looking strong!', 'Great rhythm!', "You're on fire!", 'Keep it up!'],
  halfway: ['Halfway there!', "Halfway — you've got this!"],
  twoLeft: ['Two more!', 'Two left!'],
  lastOne: ['Last one!', 'Last rep — make it count!'],
  done: ['Done! Great set.', 'Set complete — nice work!', "That's the set. Well done!"],
  holdDone: ['Time! Great hold.', "Time's up — awesome plank!"],
  lost: ["I lost you — step back into view.", "I can't see you. Move back into the frame."],
  found: ['Got you again.', 'There you are!'],
  idleFirst: ["Keep going when you're ready.", 'Take a breath, then keep going.'],
  idleLater: ["Still with me? Let's finish strong.", "Whenever you're ready — let's finish the set."],
  countdown: ['Five', 'Four', 'Three', 'Two', 'One'],
} as const;

const NUMBER_WORDS = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty',
];

/** Rep numbers as words: speech engines read "1." inconsistently. */
export function countWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

/** Picks a random line, avoiding the one used last time for the same pool. */
export class Picker {
  private last = new Map<readonly string[], string>();
  constructor(private readonly rand: () => number = Math.random) {}

  pick(pool: readonly string[]): string {
    if (pool.length === 1) return pool[0];
    const prev = this.last.get(pool);
    let choice = pool[Math.floor(this.rand() * pool.length)];
    if (choice === prev) choice = pool[(pool.indexOf(choice) + 1) % pool.length];
    this.last.set(pool, choice);
    return choice;
  }
}
