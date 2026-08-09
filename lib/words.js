// Play-mode word list + endless random word stream — pure ESM, no DOM, no
// Node-only APIs. Imported by both the browser (served at /lib/) and
// node:test.
//
// Anti-memorization requirement (owner call): Play mode must never replay a
// fixed passage. wordStream() hands out words from WORDS in random order
// with a repeat guard, so no two rounds — and no two moments within a
// round — look the same.

// 150+ kid-friendly words, uppercase, A-Z only, 2-7 letters. Animals, food,
// family, colors, actions, and silly-fun words. No real people's names,
// nothing scary or inappropriate.
export const WORDS = [
  // Animals
  "OX", "CAT", "DOG", "PIG", "COW", "HEN", "FOX", "OWL", "BAT", "ANT",
  "BEE", "RAM", "ELK", "EWE", "YAK", "FISH", "BIRD", "LION", "BEAR",
  "WOLF", "DEER", "GOAT", "DUCK", "FROG", "CRAB", "SEAL", "MOLE", "MULE",
  "TOAD", "HAWK", "SWAN", "DOVE", "LAMB", "CALF", "COLT", "KIWI", "PANDA",
  "TIGER", "ZEBRA", "MOUSE", "HORSE", "SHEEP", "SNAKE", "SHARK", "WHALE",
  "EAGLE", "ROBIN", "RAVEN", "OTTER", "CAMEL", "MONKEY", "RABBIT",
  "TURTLE", "DONKEY", "PUPPY", "KITTEN", "CHICK", "GOOSE", "PONY",
  "MOOSE", "BISON", "GECKO", "IGUANA", "CHEETAH", "DOLPHIN", "PENGUIN",
  "HAMSTER", "GORILLA", "RACCOON", "OSTRICH", "PELICAN", "LOBSTER",
  "CRICKET", "LIZARD", "PARROT", "FALCON", "SALMON", "TROUT", "PYTHON",
  "COBRA", "PUFFIN", "WALRUS", "BADGER", "FERRET",

  // Food
  "EGG", "PIE", "JAM", "TEA", "BUN", "HAM", "BEAN", "CORN", "RICE",
  "CAKE", "SOUP", "MILK", "MEAT", "PLUM", "LIME", "PEAR", "MINT", "TACO",
  "BREAD", "APPLE", "GRAPE", "MANGO", "PEACH", "LEMON", "HONEY", "PIZZA",
  "BACON", "TOAST", "CANDY", "CHEESE", "CARROT", "POTATO", "PASTA",
  "PICKLE", "WAFFLE", "MUFFIN", "BURGER", "COOKIE", "BANANA", "NOODLE",
  "PUDDING", "PANCAKE", "YOGURT", "CEREAL", "BUTTER", "PEANUT", "WALNUT",
  "MELON", "BERRY", "CHERRY", "COCONUT", "PRETZEL", "POPCORN", "OATMEAL",
  "MUSTARD", "KETCHUP", "SPINACH", "PUMPKIN", "CABBAGE", "AVOCADO",

  // Family
  "MOM", "DAD", "SON", "KID", "BABY", "AUNT", "UNCLE", "NANA", "PAPA",
  "SISTER", "BROTHER", "COUSIN", "GRANDPA", "GRANDMA", "FAMILY",
  "FRIEND", "BUDDY", "NEPHEW", "NIECE",

  // Colors
  "RED", "TAN", "PINK", "BLUE", "GRAY", "GOLD", "TEAL", "NAVY", "AQUA",
  "CORAL", "GREEN", "BLACK", "WHITE", "BROWN", "PURPLE", "YELLOW",
  "ORANGE", "SILVER", "VIOLET", "MAROON", "CRIMSON", "MAGENTA", "INDIGO",
  "AMBER", "IVORY", "OLIVE",

  // Actions
  "GO", "RUN", "HOP", "JUMP", "SKIP", "WALK", "SWIM", "PLAY", "SING",
  "DANCE", "LAUGH", "SMILE", "CLIMB", "THROW", "CATCH", "KICK", "DRAW",
  "PAINT", "BUILD", "JUGGLE", "WIGGLE", "GIGGLE", "SPIN", "WAVE", "CLAP",
  "CRAWL", "SLIDE", "FLOAT", "DRIFT", "BOUNCE", "TICKLE", "WOBBLE",
  "DOODLE", "SPARKLE", "WHISTLE", "STRETCH", "TWIRL", "SKATE", "SHOUT",
  "WHISPER", "MARCH", "GALLOP", "POUNCE", "NIBBLE", "SNUGGLE", "CUDDLE",
  "SPLASH", "SPROUT", "WANDER",

  // Silly & fun
  "WIGGLY", "GOOFY", "SILLY", "ZANY", "WACKY", "BUBBLE", "ZOOM", "POP",
  "BOOM", "ZAP", "BUZZ", "FIZZ", "WHIZ", "SQUISH", "PUDDLE", "WIZARD",
  "ROBOT", "ROCKET", "PLANET", "COMET", "STAR", "MOON", "CLOUD",
  "RAINBOW", "THUNDER", "CASTLE", "UNICORN", "PIRATE", "KNIGHT",
  "DRAGON", "FAIRY", "MAGIC", "SPARKLY", "GLITTER", "SNOWMAN", "BALLOON",
  "BICYCLE", "SCOOTER", "PUZZLE", "CRAYON", "MARBLE", "BLANKET",
  "PILLOW", "SLIPPER", "SNEAKER", "JACKET", "MITTEN", "BEANIE", "SCARF",
  "WAGON", "TRAIN", "TRUCK", "PLANE",
];

// Never repeat any of the last 10 words drawn (also covers "never the same
// word twice in a row"). Guaranteed by construction — history can hold at
// most 10 words and WORDS has 150+, so the candidate pool is never empty.
const NO_REPEAT_WINDOW = 10;

// wordStream(rng) → { next() } — an endless sequence of random words, drawn
// from WORDS, that never repeats any of the last 10 words. `rng` defaults
// to Math.random but accepts a seeded generator for deterministic tests.
export function wordStream(rng = Math.random) {
  const history = [];
  return {
    next() {
      const candidates = WORDS.filter((word) => !history.includes(word));
      const pool = candidates.length > 0 ? candidates : WORDS;
      const word = pool[Math.floor(rng() * pool.length)];
      history.push(word);
      if (history.length > NO_REPEAT_WINDOW) history.shift();
      return word;
    },
  };
}

// Typing-convention words-per-minute: correct characters ÷ 5, rounded to 1
// decimal place.
export function wpm(correctChars) {
  return Math.round((correctChars / 5) * 10) / 10;
}
