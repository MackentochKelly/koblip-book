// The fields in a WhatsApp message's text, written {key} in what Book keeps
// and {label} in the reader's own words while they edit. Shared, so a
// business's editor and the admin's show and save fields the same way.

const FIELD = /\{(\w+)\}/g

// Book's {key} as the reader's {label}; unknown keys stay as written.
export function fieldsToLabels(text: string, labels: Record<string, string>) {
  return text.replace(FIELD, (whole, key: string) => (key in labels ? `{${labels[key]}}` : whole))
}

// The reader's {label} back to Book's {key}, whatever the letter case.
export function fieldsFromLabels(text: string, labels: Record<string, string>) {
  const byLabel = new Map(Object.entries(labels).map(([key, label]) => [label.toLowerCase(), key]))
  return text.replace(FIELD, (whole, label: string) => {
    const key = byLabel.get(label.toLowerCase())
    return key ? `{${key}}` : whole
  })
}

// Each {key} filled with its value, such as a sample for a preview.
export function fillFields(text: string, values: Record<string, string>) {
  return text.replace(FIELD, (whole, key: string) => values[key] ?? whole)
}
