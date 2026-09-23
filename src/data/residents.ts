export type PortraitTier = "A" | "B" | "C";

export type Resident = {
  /** 1-based number on the plaque, also the room in the manor */
  no: number;
  slug: string;
  /** the creature title on the portrait */
  title: string;
  /** known by day as */
  name: string;
  /** the legend being riffed on — shown in HTML only, never sent to image prompts */
  lore: string;
  /** day of September */
  day: number;
  /** the line on the plaque; also the announcer's line. Placeholder office humour — swap in real inside jokes. */
  tagline: string;
  tier: PortraitTier;
  portrait?: string;
  clip?: string;
};

const raw: [title: string, name: string, lore: string, day: number][] = [
  ["Navaneetha Nevermore", "Navaneetha Krishnan Suresh", "the raven", 2],
  ["Sai-nister", "Harivenkata Sai CV", "the sinister stranger", 5],
  ["Phanthima", "Prathima Kalegowda", "the phantom", 5],
  ["Snehaferatu", "Sneha Sridharan", "the vampire's shadow", 5],
  ["The Gautham Reaper", "Gautham Krishnan", "the grim reaper", 6],
  ["Ananth the Undying", "Ananthmoorthy Nayak", "the immortal", 6],
  ["Ankitenstein", "Ankit Pandey", "the mad doctor's creation", 6],
  ["Skeleketan", "R Ketan Kumar", "the skeleton chef", 7],
  ["Sharantula", "Sharan Babu", "the giant spider", 7],
  ["Ban-Shweta", "Shweta Dave", "the banshee", 8],
  ["Mothmanish", "Manish Kushwaha", "the mothman", 8],
  ["Aviracula", "Aviral Tyagi", "the vampire count", 9],
  ["The Abhay-minable Snowman", "Abhay Garani Ananthakrishna", "the yeti", 10],
  ["The Haunted Mansi-on", "Mansi Gupta", "the haunted house", 12],
  ["Urmila, the Sea Witch", "Urmila Chowdhury", "the sea witch", 12],
  ["Anil-o'-Lantern", "Anil Kumar", "the jack-o'-lantern", 12],
  ["The Mad Sai-entist", "Saikumar Sanikala", "the mad scientist", 17],
  ["Ashish the Ghoulish", "Ashish Peri", "the ghoul", 19],
  ["Swapnil the Sandman", "Swapnil Narad", "the sandman", 20],
  ["Animesh, Reanimated", "Animesh Anand", "the zombie", 20],
  ["The Phantom Singh", "Parikshit Singh", "the phantom of the opera house", 21],
  ["The Ghost Ship Shubhankar", "Shubhankar Khanda", "the ghost ship", 22],
  ["Puneetergeist", "Puneet Juneja", "the poltergeist", 23],
  ["The Bhandaged Mummy", "Aniruddha Bhandari", "the mummy", 27],
  ["Siddnight", "Siddharth Lakhara", "the witching hour", 28],
  ["The Legend of Dilip Hollow", "Dilip Samanta", "the headless horseman", 29],
  ["Abhicadabra", "Abhijit Prasad", "the sorcerer", 30],
];

const taglines = [
  "Quoth the raven: “per my last email”.",
  "Always lurking at the end of the corridor. Usually near the coffee machine.",
  "Walks through walls. Still can't get through the VPN.",
  "Casts a long shadow. Mostly over the sprint board.",
  "Comes for everyone eventually. Deadlines first.",
  "Has been in this meeting since the dawn of time. Will be here after.",
  "It's alive! The build, for once, is alive.",
  "No flesh, no bones to pick. Just a very strong opinion on biryani.",
  "Eight legs. Eight tabs. Eight parallel workstreams.",
  "The voice carries. So does the inbox.",
  "Seen only at night, near the vending machine, right before every incident.",
  "Never seen in daylight. Never seen a stand-up before ten.",
  "Fearless by name. Abominable by reputation. Warm by nature.",
  "Every window is lit. Nobody's home. Classic work-from-home.",
  "Trades voices for wishes. Currently holding thirty-one voices and a mute button.",
  "Glows brightest on a deadline. Hollow inside by Friday.",
  "It's not mad science. It's just untested in production.",
  "Never grew up. Never grew old. The to-do list did both.",
  "Puts the whole room to sleep. It's called a status update.",
  "Rose from the desk at six. The stand-up was at nine.",
  "Everything the candlelight touches is the kingdom. The rest is the backlog.",
  "Sails under a green flag. The build server sails under a red one.",
  "Throws chairs. Also throws exceptions. Both unhandled.",
  "Wrapped in three thousand years of process documentation.",
  "The clock strikes twelve. The release strikes back.",
  "Rides through the hollow every night. Still can't find a parking spot.",
  "One word, and the whole roadmap disappears. Flawless finale.",
];

/**
 * Residents whose portrait exists in public/portraits as NN.webp (+ NN-sm.webp for
 * the gallery wall, NN-bg.webp for the room's ambient wash). The art carries no
 * text: titles are laid over it in HTML.
 */
const withPortrait = new Set(Array.from({ length: 27 }, (_, i) => i + 1));

const slugify = (s: string) =>
  s.toLowerCase().replace(/['’.,“”]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export const residents: Resident[] = raw.map(([title, name, lore, day], i) => ({
  no: i + 1,
  slug: slugify(title),
  title,
  name,
  lore,
  day,
  tagline: taglines[i],
  // Until a photo arrives everyone is a "mystery billing" portrait: no face, all atmosphere.
  tier: "C",
  portrait: withPortrait.has(i + 1) ? `/portraits/${String(i + 1).padStart(2, "0")}.webp` : undefined,
}));

export const pad2 = (n: number) => String(n).padStart(2, "0");
/** skips initials, so "R Ketan Kumar" is Ketan rather than R */
export const firstName = (r: Resident) => r.name.split(" ").find((w) => w.length > 2) ?? r.name;
export const portraitThumb = (r: Resident) => r.portrait?.replace(".webp", "-sm.webp");
export const portraitBg = (r: Resident) => r.portrait?.replace(".webp", "-bg.webp");
/** placeholder art class until real portraits land (a1..a9) */
export const artClass = (r: Resident) => `art a${((r.no - 1) % 9) + 1}`;
