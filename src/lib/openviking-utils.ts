export function deriveCategoryFromUri(uri: string): string {
  const parts = uri.replace('viking://', '').split('/')
  // resources/memories/business.md → business
  if (parts[0] === 'resources' && parts[1] === 'memories' && parts[2]) {
    return parts[2].replace('.md', '').replace(/\/.+/, '')
  }
  // resources/daily-logs → daily-logs
  if (parts[0] === 'resources' && parts[1]) return parts[1]
  // user/default/memories/X → X or 'user'
  if (parts[0] === 'user') return parts[3] || 'user'
  // agent, session → scope category
  return parts[0] || 'uncategorized'
}