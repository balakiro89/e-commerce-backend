export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}

export function generateOrderNumber(): string {
  const now = Date.now().toString(36).toUpperCase()
  return `BK-${now}`
}
