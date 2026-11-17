// Deliberately no answer weights or correct-answer key. The ceremony is the joke.
export const questions = [
  ['You discover a sealed letter addressed to someone you distrust. What do you do?', ['Deliver it unopened.', 'Open it. There may be a good reason to distrust them.', 'Ask a friend what they would do.', 'Keep it safe until you understand the situation.']],
  ['A classmate takes credit for your work. Your first instinct is to…', ['Confront them directly.', 'Quietly gather proof.', 'Speak to them in private.', 'Make sure your next achievement is impossible to miss.']],
  ['You can save one thing from a room before the door locks. Which do you choose?', ['A book containing knowledge thought lost.', 'A small creature trapped in a cage.', 'An heirloom entrusted to your care.', 'A key whose purpose nobody knows.']],
  ['A rule prevents you from helping someone. What matters most?', ['Whether breaking it will actually help.', 'Why the rule exists.', 'Who else could be affected.', 'Whether you can find a way around it.']],
  ['Your group is lost after dark. You…', ['Choose a direction and lead.', 'Look for landmarks.', 'Make sure everyone stays together.', 'Climb somewhere high to see the bigger picture.']],
  ['Which would you find hardest to forgive?', ['A broken promise.', 'A deliberate cruelty.', 'A wasted opportunity.', 'A lie told for your own good.']],
  ['You are offered a glimpse of your future. What do you ask to see?', ['The person I become.', 'The people beside me.', 'The thing I accomplish.', 'Nothing. I would rather find out.']],
  ['At the end of a long corridor, four doors await. Which draws you in?', ['The one with warm light underneath.', 'The one with a lock on the inside.', 'The one slightly ajar.', 'The one you are certain was not there before.']],
  ['Which sound feels most like an answer?', ['Rain against a greenhouse.', 'A match being struck.', 'Footsteps on an empty staircase.', 'A page turning in another room.']],
  ['A stranger says, “You have been here before.” You reply…', ['“Then you know why I returned.”', '“How long ago?”', '“Are you sure it was me?”', '“Is that good?”']],
  ['Which would you rather hold in your hand?', ['A warm stone.', 'A cold key.', 'A feather that is heavier than it looks.', 'An unopened envelope that is faintly humming.']],
  ['Which shape seems most trustworthy?', ['A circle with a small gap.', 'A triangle pointing left.', 'A square with rounded corners.', 'Two lines that almost meet.']],
  ['It is Thursday, but only in one room of your house. Which room?', ['Kitchen.', 'Bedroom.', 'Bathroom.', 'The room I do not remember having.']],
  ['How many geese would need to enter a room before you suspected a plan?', ['One particularly focused goose.', 'Three.', 'Seven.', 'I would need to hear them out first.']],
  ['Solve for x: 3x + 7 = 22.', ['3', '5', '7', '22']],
  ['Tequila originates from which country?', ['Spain', 'Mexico', 'Portugal', 'Argentina']],
  ['A train leaves at 14:10 and travels for 95 minutes. When does it arrive?', ['15:35', '15:45', '16:05', 'The train has not earned my trust.']],
  ['Which of these is the chemical symbol for potassium?', ['P', 'Po', 'K', 'Pt']],
  ['Select the printer setting that best describes your inner life.', ['Fit to page.', 'Actual size.', 'Print on both sides.', 'Paper jam in tray 2.']],
  ['For administrative purposes, please select the number 4.', ['4', '4', '4', '4']],
].map(([prompt, options]) => ({ prompt, options }));

export const houses = [
  { name: 'Gryffindor', animal: 'THE LION', color: '#d28e76', motto: 'A little nerve goes a long way.', traits: 'Courage · daring · determination', description: 'There is a place for those who take the first step, even when the stairs look questionable. Your seat is waiting.' },
  { name: 'Hufflepuff', animal: 'THE BADGER', color: '#dcc27b', motto: 'Good company. Steady hearts.', traits: 'Loyalty · patience · fairness', description: 'There is a place for those who show up, stay kind, and make room at the table. Your seat is waiting.' },
  { name: 'Ravenclaw', animal: 'THE EAGLE', color: '#8db5d3', motto: 'Stay curious. Ask one more question.', traits: 'Curiosity · wit · imagination', description: 'There is a place for those who follow an interesting thought long past a sensible bedtime. Your seat is waiting.' },
  { name: 'Slytherin', animal: 'THE SERPENT', color: '#91baa0', motto: 'Know what you want. Find a way.', traits: 'Ambition · resourcefulness · resolve', description: 'There is a place for those who see a possibility where others see a locked door. Your seat is waiting.' },
];

// 2^32 is divisible by four: each house receives exactly one quarter of outcomes.
// No answers, timings, or other user information enter this function.
export function drawHouse(random = globalThis.crypto) {
  return houses[random.getRandomValues(new Uint32Array(1))[0] % houses.length];
}
