import "server-only"

// The last task waiting or running for each key. It never rejects, so a
// failed task doesn't stop the ones after it.
const tails = new Map<string, Promise<void>>()

// Runs `task` once every earlier task with the same key has finished: one
// at a time, in the order they came. Tasks with different keys run
// together. In memory, like the assistant's pending actions and rate
// limits: the app runs as one process.
export async function runInTurn<T>(
  key: string,
  task: () => Promise<T>
): Promise<T> {
  const run = (tails.get(key) ?? Promise.resolve()).then(task)
  const tail = run.then(
    () => {},
    () => {}
  )
  tails.set(key, tail)
  try {
    return await run
  } finally {
    // The last one out leaves nothing behind.
    if (tails.get(key) === tail) {
      tails.delete(key)
    }
  }
}
