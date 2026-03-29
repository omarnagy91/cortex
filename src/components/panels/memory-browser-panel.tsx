'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { MemoryGraph } from '@/components/panels/memory-graph'

// --- Types ---

type CategoryName = 
  | 'personal' | 'business' | 'technical' | 'decision' | 'relationship' | 'temporal' | 'uncategorized'
  | 'profile' | 'preferences' | 'entities' | 'events' | 'cases' | 'patterns' | 'tools' | 'skills'
  | 'agent' | 'resources' | 'user' | 'session'

const CATEGORY_COLORS: Record<CategoryName, string> = {
  // Legacy Mnemonic categories
  personal: '#4CAF50', business: '#2196F3', technical: '#FF9800',
  decision: '#9C27B0', relationship: '#E91E63', temporal: '#607D8B', uncategorized: '#795548',
  // OpenViking categories
  profile: '#00BCD4', preferences: '#8BC34A', entities: '#3F51B5',
  events: '#FF5722', cases: '#009688', patterns: '#CDDC39',
  tools: '#FFC107', skills: '#673AB7',
  // Scope categories
  agent: '#1E88E5', resources: '#43A047', user: '#FB8C00', session: '#8E24AA'
}
function getCategoryColor(cat: string): string {
  return CATEGORY_COLORS[cat as CategoryName] ?? '#795548'
}

interface Stats {
  total_memories: number
  categories: Record<string, number>
  by_source: Record<string, number>
  importance_distribution: Record<string, number>
  recent_24h: number
  recent_7d: number
  average_importance: number
}

interface TimelineEntry {
  memory: string
  category: string
  importance: number
  created_at: string
}

interface CategoryInfo {
  category: string
  l0_summary: string
  l1_summary: string
  memory_count: number
  importance_avg: number
}

interface SearchResult {
  memory: string
  category: string
  importance: number
  created_at: string
  score?: number
}

// --- Tab types ---
type Tab = 'overview' | 'graph' | 'timeline' | 'categories' | 'search'

// --- Overview Tab ---
function OverviewTab() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/memory/stats')
      .then(r => r.json())
      .then(d => { setStats(d); setLoading(false) })
      .catch(() => { setError('Failed to load stats'); setLoading(false) })
  }, [])

  if (loading) return <div className="text-muted-foreground text-sm py-8 text-center">Loading stats...</div>
  if (error) return <div className="text-red-400 text-sm py-8 text-center">{error}</div>
  if (!stats) return null

  const categoryEntries = Object.entries(stats.categories || {}).sort((a, b) => b[1] - a[1])
  const sourceEntries = Object.entries(stats.by_source || {}).sort((a, b) => b[1] - a[1])

  return (
    <div className="space-y-6 p-4">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Memories" value={stats.total_memories} />
        <StatCard label="Today" value={stats.recent_24h} />
        <StatCard label="Avg Importance" value={stats.average_importance?.toFixed(2) ?? '—'} />
        <StatCard label="Categories" value={Object.keys(stats.categories || {}).length} />
      </div>

      {/* Category breakdown */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Categories</h3>
        <div className="space-y-2">
          {categoryEntries.map(([cat, count]) => (
            <div key={cat} className="flex items-center gap-3">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: getCategoryColor(cat) }}
              />
              <span className="text-sm text-foreground capitalize flex-1">{cat}</span>
              <span className="text-sm font-mono text-muted-foreground">{count}</span>
              <div className="w-24 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${stats.total_memories > 0 ? (count / stats.total_memories) * 100 : 0}%`,
                    backgroundColor: getCategoryColor(cat),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Source distribution */}
      {sourceEntries.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Sources</h3>
          <div className="space-y-2">
            {sourceEntries.map(([src, count]) => (
              <div key={src} className="flex items-center gap-3">
                <span className="text-sm text-foreground flex-1 truncate font-mono text-xs">{src}</span>
                <span className="text-sm font-mono text-muted-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-card border border-border rounded-lg p-3">
      <div className="text-lg font-bold text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  )
}

// --- Timeline Tab ---
function TimelineTab() {
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('')
  const [minImportance, setMinImportance] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({ user_id: 'omar', limit: '100' })
    if (categoryFilter) params.set('category', categoryFilter)
    if (minImportance) params.set('min_importance', minImportance)
    fetch(`/api/memory/timeline?${params}`)
      .then(r => r.json())
      .then(d => { setEntries(d.entries || []); setLoading(false) })
      .catch(() => { setError('Failed to load timeline'); setLoading(false) })
  }, [categoryFilter, minImportance])

  useEffect(() => { load() }, [load])

  // Group by day
  const byDay: Record<string, TimelineEntry[]> = {}
  for (const entry of entries) {
    const day = entry.created_at ? entry.created_at.split('T')[0] : 'Unknown'
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(entry)
  }
  const days = Object.keys(byDay).sort((a, b) => b.localeCompare(a))

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 p-4 border-b border-border shrink-0">
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="bg-surface-1 border border-border rounded px-2 py-1 text-sm text-foreground"
        >
          <option value="">All categories</option>
          {Object.keys(CATEGORY_COLORS).map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          value={minImportance}
          onChange={e => setMinImportance(e.target.value)}
          className="bg-surface-1 border border-border rounded px-2 py-1 text-sm text-foreground"
        >
          <option value="">Any importance</option>
          <option value="3">3+</option>
          <option value="5">5+</option>
          <option value="7">7+</option>
          <option value="9">9+</option>
        </select>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {loading ? (
          <div className="text-muted-foreground text-sm text-center py-8">Loading...</div>
        ) : error ? (
          <div className="text-red-400 text-sm text-center py-8">{error}</div>
        ) : days.length === 0 ? (
          <div className="text-muted-foreground text-sm text-center py-8">No memories found</div>
        ) : (
          days.map(day => (
            <div key={day}>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 sticky top-0 bg-background py-1">{day}</div>
              <div className="space-y-2">
                {byDay[day].map((entry, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-lg bg-card border border-border">
                    <span
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: getCategoryColor(entry.category) }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{entry.memory}</p>
                      <div className="flex gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground capitalize">{entry.category}</span>
                        <span className="text-[10px] text-muted-foreground">imp: {entry.importance}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// --- Categories Tab ---
function CategoriesTab() {
  const [categories, setCategories] = useState<CategoryInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/memory/categories?user_id=omar')
      .then(r => r.json())
      .then(d => { setCategories(d.categories || []); setLoading(false) })
      .catch(() => { setError('Failed to load categories'); setLoading(false) })
  }, [])

  if (loading) return <div className="text-muted-foreground text-sm py-8 text-center">Loading...</div>
  if (error) return <div className="text-red-400 text-sm py-8 text-center">{error}</div>

  return (
    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
      {categories.map(cat => (
        <div key={cat.category} className="bg-card border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: getCategoryColor(cat.category) }}
            />
            <span className="text-sm font-semibold text-foreground capitalize">{cat.category}</span>
            <span className="ml-auto text-xs text-muted-foreground">{cat.memory_count} memories</span>
          </div>
          {cat.l0_summary && (
            <p className="text-xs text-muted-foreground mb-1 line-clamp-2">{cat.l0_summary}</p>
          )}
          {cat.l1_summary && (
            <p className="text-xs text-muted-foreground/70 line-clamp-3">{cat.l1_summary}</p>
          )}
          <div className="mt-2 text-[10px] text-muted-foreground">
            avg importance: {cat.importance_avg?.toFixed(1) ?? '—'}
          </div>
        </div>
      ))}
      {categories.length === 0 && (
        <div className="col-span-2 text-muted-foreground text-sm text-center py-8">No categories found</div>
      )}
    </div>
  )
}

// --- Search Tab ---
function SearchTab() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setSearched(true)
    try {
      const res = await fetch('/api/memory/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), user_id: 'omar', limit: 20 }),
      })
      const data = await res.json()
      setResults(data.results || data.entries || [])
    } catch {
      setError('Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      <form onSubmit={handleSearch} className="flex gap-2 p-4 border-b border-border shrink-0">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search memories..."
          className="flex-1 bg-surface-1 border border-border rounded px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
        />
        <Button type="submit" size="sm" disabled={loading || !query.trim()}>
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </form>
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {error && <div className="text-red-400 text-sm">{error}</div>}
        {searched && !loading && results.length === 0 && (
          <div className="text-muted-foreground text-sm text-center py-8">No results found</div>
        )}
        {results.map((r, i) => (
          <div key={i} className="flex gap-3 p-3 rounded-lg bg-card border border-border">
            <span
              className="w-2 h-2 rounded-full mt-1.5 shrink-0"
              style={{ backgroundColor: getCategoryColor(r.category) }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground">{r.memory}</p>
              <div className="flex gap-2 mt-1">
                <span className="text-[10px] text-muted-foreground capitalize">{r.category}</span>
                <span className="text-[10px] text-muted-foreground">imp: {r.importance}</span>
                {r.score !== undefined && (
                  <span className="text-[10px] text-muted-foreground">score: {r.score.toFixed(3)}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// --- Main Panel ---
export function MemoryBrowserPanel() {
  const [activeTab, setActiveTab] = useState<Tab>('overview')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'graph', label: 'Graph' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'categories', label: 'Categories' },
    { id: 'search', label: 'Search' },
  ]

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <h2 className="text-sm font-semibold text-foreground">Memory</h2>
        <span className="text-[10px] text-muted-foreground font-mono">OpenViking v4</span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 px-4 py-2 border-b border-border shrink-0 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'bg-primary/15 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'overview' && <div className="overflow-y-auto h-full"><OverviewTab /></div>}
        {activeTab === 'graph' && (
          <div className="h-full">
            <MemoryGraph />
          </div>
        )}
        {activeTab === 'timeline' && <TimelineTab />}
        {activeTab === 'categories' && <div className="overflow-y-auto h-full"><CategoriesTab /></div>}
        {activeTab === 'search' && <SearchTab />}
      </div>
    </div>
  )
}
