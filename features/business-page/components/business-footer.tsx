// Who the page belongs to, where its Google details come from, and who built it.
export function BusinessFooter({
  name,
  fromGoogle,
}: {
  name: string
  fromGoogle: boolean
}) {
  return (
    <footer className="flex flex-col items-center gap-1 pt-4 text-center text-xs text-muted-foreground">
      <p>
        © {new Date().getFullYear()} {name}. All rights reserved.
      </p>
      {fromGoogle && (
        <p>
          Photos, opening times and reviews from{" "}
          <span translate="no">Google Maps</span>.
        </p>
      )}
      <p>
        Built by <span className="font-medium text-foreground">Koblip</span>
      </p>
    </footer>
  )
}
