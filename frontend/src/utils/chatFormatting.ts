export function formatChatLine(raw: string) {
  const heading = /^\s{0,3}#{1,6}\s+/.test(raw)
  const list = /^\s*[-+*]\s+/.test(raw)
  const text = raw.replace(/^\s{0,3}#{1,6}\s+/, '').replace(/^\s*[-+*]\s+/, '')
  let bold = heading
  const parts = text.split(/(\*{2,}|_{2,})/).flatMap((part) => {
    if (/^(\*{2,}|_{2,})$/.test(part)) {
      bold = !bold
      return []
    }
    return part ? [{ text: part, bold }] : []
  })
  return { list, parts }
}
