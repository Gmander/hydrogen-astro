# Jeopardy Night setup

The `/jeopardy/` app uses the Firebase web configuration already present for Runtime Ready. Players sign in anonymously; saved boards and active rooms are stored in Firestore. No Firebase Admin key is used in the site.

## Firebase setup

1. In Firebase Authentication, enable **Anonymous** sign-in.
2. Publish the matching [`firestore.rules`](../firestore.rules) to the existing `riley-tracker-59212` Firestore database. Keep the Riley household rules in place; the Jeopardy collections have separate rules.
3. Ensure the four `PUBLIC_FIREBASE_*` values are present for Netlify production and Deploy Previews. They are browser-visible web settings, not admin credentials.
4. Deploy `/jeopardy/` and open it once to confirm the top bar says **Connected · live game sync**.

## How a game works

- A host builds or imports a two-round board (2–6 categories per round, five clues per category, plus one saved Final Jeopardy clue) and saves it to their anonymous account. Each board is stored as a JSON-shaped Firestore document with `rounds`, `categories`, `clues`, and `final`; host-only answer keys stay in Firestore and are copied into a private room snapshot when a game starts.
- Starting a game creates a four-character room code and invite link. Existing eight-character rooms remain joinable. Returning players on the same browser can rejoin as their saved player with their existing score.
- The host picks a clue and reads it aloud. Phone buzzes attempt a Firestore transaction on the shared room document; concurrent buzzes serialize, and only the first transaction accepted by Firestore claims the clue.
- The host judges spoken answers, reveals responses, and awards or deducts points. An incorrect response locks that player out of the current clue and lets the other eligible players buzz; a correct answer or exhausted buzzes closes the clue. Leaving asks for confirmation and preserves the player's room record and score. Final responses and wagers are private to the host and the submitting player until adjudication.
- Room and response documents remain in Firestore after a game; saved boards persist with the host's browser account. Anonymous accounts are browser/device-specific, so clearing site data can make saved boards inaccessible.

## Limits to know

- Internet access is required. This is a casual in-person buzzer, not a certified timing system; network delay and Firestore transaction arrival determine the winner.
- Anyone with a room link can join during the lobby. Use a fresh room for each game; no host moderation, account recovery, export, or room cleanup UI is included yet.
- Daily Double wagers are set by the host for the selected player. Final Jeopardy answers and wagers are entered privately on each phone; the host marks them correct/incorrect.
- Boards can be edited and deleted from the saved boards list. Pasting a Markdown board fills the editor for review before saving; imported answers are not published as static site files.
