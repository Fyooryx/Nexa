export function normalizeKeyword(value) {
  return String(value || '').trim().toLocaleLowerCase('id-ID').slice(0, 80)
}

export function addKeyword(group, value) {
  const keyword = normalizeKeyword(value)
  if (!keyword) return false
  group.filters ??= []
  if (group.filters.includes(keyword)) return false
  group.filters.push(keyword)
  group.filters.sort()
  return true
}

export function removeKeyword(group, value) {
  const keyword = normalizeKeyword(value)
  if (!keyword || !Array.isArray(group.filters)) return false
  const before = group.filters.length
  group.filters = group.filters.filter(item => item !== keyword)
  return group.filters.length !== before
}

export function listKeywords(group) {
  return Array.isArray(group.filters) ? [...group.filters] : []
}

export function findMatchedKeyword(text, group) {
  const haystack = String(text || '').toLocaleLowerCase('id-ID')
  return listKeywords(group).find(keyword => haystack.includes(keyword)) || null
}
