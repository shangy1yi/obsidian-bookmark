export interface FeaturedBackgroundStyleCandidate {
  title?: string
  credit?: string
  provider?: string
  metadata?: string[]
}

const FEATURED_BACKGROUND_STYLE_POSITIVE_PATTERNS: Array<{ pattern: RegExp; weight: number }> = [
  {
    pattern: /\b(?:hubble|webb|jwst|spitzer|chandra|earth|earthrise|aurora|mars|moon|orbit|orbital|atmosphere|night sky)\b/i,
    weight: 4
  },
  {
    pattern: /\b(?:nebula|galaxy|milky way|jupiter|saturn|planet|cosmic|space|star(?:s|field)?)\b/i,
    weight: 2
  },
  { pattern: /\b(?:landscape|seascape|waterscape|cityscape|panorama|vista|horizon|scenery|photograph|photo)\b/i, weight: 6 },
  {
    pattern: /\b(?:mountain|river|forest|garden|field|meadow|valley|waterfall|falls|shore|coast|beach|ocean|sea|sky|clouds?|storm|wave|waves|harbor|harbour|island|canyon|desert|glacier|volcano|tree|trees|wooded|woods|lake|kashmir|niagara)\b/i,
    weight: 4
  },
  { pattern: /\b(?:sunrise|sunset|dawn|dusk|night sky|starry night)\b/i, weight: 3 },
  { pattern: /\b(?:featured picture|quality image|high resolution|high-resolution)\b/i, weight: 2 }
]

const FEATURED_BACKGROUND_STYLE_NEGATIVE_PATTERNS: Array<{ pattern: RegExp; weight: number }> = [
  { pattern: /\b(?:tempera|paper|silk|parchment|monotype|print|prints|drawing|drawings|illustration|illustrated|poster)\b/i, weight: 3 },
  { pattern: /\bself-portrait\b/i, weight: 6 },
  { pattern: /\bportrait\b/i, weight: 5 },
  { pattern: /\bstill life\b/i, weight: 5 },
  { pattern: /\b(?:wall painting|fresco|mural|relief|sculpture|statue|statuette|ceramic|textile|fragment|votive|manuscript|miniature)\b/i, weight: 5 },
  { pattern: /\b(?:sepia|monochrome|black and white|black-and-white|b&w)\b/i, weight: 5 },
  { pattern: /\b(?:interior|room|kitchen|bedroom|dining room)\b/i, weight: 4 },
  { pattern: /\b(?:vase|pitcher|jar|bowl|plate|box|table|chair|bottle|teapot|vessel|scroll|handscroll|hanging scroll|album leaf|screen|fan)\b/i, weight: 4 },
  {
    pattern: /\b(?:bust|head|face|figure|figures|person|people|members|group|crew|astronauts?|man|woman|boy|girl|child|children|couple|family|dancer|dance class|class|nude|seated|standing|ink|wash|brush|calligraphy|watercolor|watercolour|sketch|pastel|charcoal|pencil|etching|engraving|lithograph|woodblock|woodcut|sumi-?e|gongbi|ukiyo-?e)\b/i,
    weight: 3
  }
]
const FEATURED_BACKGROUND_STYLE_PROVIDER_BASELINE: Record<string, number> = {
  nasa: 1,
  wikimedia: 0,
  met: -1,
  cleveland: -1
}
const FEATURED_BACKGROUND_STYLE_REJECT_PATTERNS = [
  /\b(?:scroll|handscroll|hanging scroll|album leaf|calligraphy|woodblock|woodcut|ukiyo-?e|sumi-?e|gongbi)\b/i,
  /\b(?:portrait|self-portrait|still life|vase|pitcher|dancer|dance class|nude)\b/i,
  /\b(?:media day|group portrait|payload bay|spacecraft interior|gsfc_\d|pace_\d)\b/i,
  /\b(?:drawings? and prints|print(?:s)?|drawing(?:s)?|etching|engraving|lithograph|pastel|charcoal|pencil|monotype)\b/i
]

function getFeaturedBackgroundStyleScore(candidate: FeaturedBackgroundStyleCandidate): number {
  const text = normalizeFeaturedBackgroundStyleText(candidate)
  if (!text) {
    return 0
  }

  let score = FEATURED_BACKGROUND_STYLE_PROVIDER_BASELINE[String(candidate.provider || '').toLowerCase()] || 0
  for (const { pattern, weight } of FEATURED_BACKGROUND_STYLE_POSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      score += weight
    }
  }
  for (const { pattern, weight } of FEATURED_BACKGROUND_STYLE_NEGATIVE_PATTERNS) {
    if (pattern.test(text)) {
      score -= weight
    }
  }
  return score
}

export function isFeaturedBackgroundStyleSuitable(candidate: FeaturedBackgroundStyleCandidate): boolean {
  const text = normalizeFeaturedBackgroundStyleText(candidate)
  if (!text || FEATURED_BACKGROUND_STYLE_REJECT_PATTERNS.some((pattern) => pattern.test(text))) {
    return false
  }
  const provider = String(candidate.provider || '').toLowerCase()
  const minimumScore = provider === 'nasa'
    ? 5
    : ['met', 'cleveland'].includes(provider)
      ? 3
      : 4
  return getFeaturedBackgroundStyleScore(candidate) >= minimumScore
}

function normalizeFeaturedBackgroundStyleText(candidate: FeaturedBackgroundStyleCandidate): string {
  return [
    candidate.title,
    candidate.credit,
    ...(candidate.metadata || [])
  ].flatMap(value => { const mappedResult = String(value || '').trim(); return mappedResult ? [mappedResult] : [] })
    .join(' ')
    .toLowerCase()
}
