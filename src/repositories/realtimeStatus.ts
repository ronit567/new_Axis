// postgres_changes has no replay. When the socket drops — the app is
// backgrounded for a minute, the phone moves from campus wifi to cellular —
// realtime-js reconnects and re-joins the channel on its own, but whatever was
// inserted in between is never delivered, and nothing tells the app a gap
// happened: the cached thread simply has a hole in it.
//
// This turns the channel's status stream into the one signal that matters: "you
// were away and are back". It is silent for the first join, because the
// queries that mount alongside the subscription have just fetched; firing there
// would only double them.
export function resubscribeDetector(onResubscribed?: () => void): (status: string) => void {
  let joined = false
  return (status) => {
    if (status !== 'SUBSCRIBED') return
    if (joined) onResubscribed?.()
    joined = true
  }
}
