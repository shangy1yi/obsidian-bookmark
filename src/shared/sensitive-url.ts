import ipaddr from 'ipaddr.js'

export type SensitiveExternalUrlReason =
  | 'invalid-url'
  | 'unsupported-scheme'
  | 'local-network'
  | 'capability-action'
  | 'account-login-page'
  | 'email-page'
  | 'financial-page'
  | 'medical-page'
  | 'document-collaboration-page'

export interface SensitiveExternalUrlDecision {
  sensitive: boolean
  reason: SensitiveExternalUrlReason | ''
  warning: string
}

const ACCOUNT_PATH_RE = /(?:^|\/)(?:login|log-in|signin|sign-in|signup|sign-up|account|accounts|auth|oauth|sso|session|sessions)(?:\/|$)/i
const FINANCIAL_PATH_RE = /(?:^|\/)(?:checkout|billing|bill|payment|payments|pay|bank|wallet|invoice|invoices|subscription|subscriptions)(?:\/|$)/i
const MEDICAL_PATH_RE = /(?:^|\/)(?:medical|health|patient|patients|clinic|hospital|mychart)(?:\/|$)/i
const DOCUMENT_PATH_RE = /(?:^|\/)(?:document|documents|doc|docs|workspace|workspaces|share|shared)(?:\/|$)/i
const CAPABILITY_ACTION_PATH_RE = /(?:^|\/)(?:logout|log[-_]?out|signout|sign[-_]?out|unsubscribe|reset|password[-_]?reset|reset[-_]?password|verify|verification|confirm|confirmation|delete|remove|activate|magic[-_]?(?:link|login)|accept[-_]?invite|(?:verify|confirm|activate)[-_]?(?:email|account|invite))(?:\/|$)/i
const CAPABILITY_QUERY_KEY_RE = /^(?:(?:access|refresh|id|auth|session)[_-]?token|token|code|oob[_-]?code|jwt|ticket|credential|credentials|key|api[_-]?key|secret|signature|sig|auth|authorization|password|passwd|reset[_-]?password[_-]?token|confirmation[_-]?token|verification[_-]?token|invitation[_-]?token|x-amz-.+|x-goog-.+)$/i
const CAPABILITY_ACTION_QUERY_KEY_RE = /^(?:action|operation|op|cmd|command|do)$/i
const CAPABILITY_ACTION_QUERY_VALUE_RE = /^(?:accept[-_]?(?:invite|invitation)|activate(?:[-_]?(?:account|email))?|cancel|confirm(?:[-_]?(?:account|email|invite))?|delete|disable|logout|log[-_]?out|remove|reset(?:[-_]?password)?|revoke|signout|sign[-_]?out|unsubscribe|verify(?:[-_]?(?:account|email|invite))?)$/i
const PRIVATE_DNS_ALIAS_HOSTS = [
  'home.arpa',
  'local.gd',
  'localtest.me',
  'localhost.direct',
  'lvh.me',
  'nip.io',
  'sslip.io',
  'traefik.me',
  'vcap.me',
  'vcaps.me',
  'xip.io'
]

const EMAIL_HOSTS = [
  'mail.google.com',
  'outlook.live.com',
  'outlook.office.com',
  'mail.yahoo.com',
  'proton.me',
  'protonmail.com',
  'icloud.com'
]

const DOCUMENT_COLLAB_HOSTS = [
  'docs.google.com',
  'drive.google.com',
  'onedrive.live.com',
  'sharepoint.com',
  'notion.so',
  'notion.site',
  'coda.io',
  'airtable.com',
  'figma.com'
]

const FINANCIAL_HOST_PARTS = [
  'bank',
  'paypal',
  'stripe',
  'wise',
  'revolut',
  'alipay',
  'wechatpay',
  'pay.google',
  'payments.google',
  'checkout'
]

const MEDICAL_HOST_PARTS = [
  'health',
  'medical',
  'clinic',
  'hospital',
  'mychart'
]

const WARNING_BY_REASON: Record<SensitiveExternalUrlReason, string> = {
  'invalid-url': '网页地址无效，已跳过外部请求。',
  'unsupported-scheme': '该链接类型不适合外部检测或远程解析，已跳过外部请求。',
  'local-network': '该链接属于本机、内网或私有网络地址，已按敏感 URL 保护跳过外部请求。',
  'capability-action': '该链接可能包含一次性凭据或触发账号操作，已按敏感 URL 保护跳过外部请求。',
  'account-login-page': '该链接看起来是登录、账号或鉴权入口，已按敏感 URL 保护跳过外部请求。',
  'email-page': '该链接看起来是邮箱页面，已按敏感 URL 保护跳过外部请求。',
  'financial-page': '该链接看起来是银行、支付或账单页面，已按敏感 URL 保护跳过外部请求。',
  'medical-page': '该链接看起来是医疗或健康页面，已按敏感 URL 保护跳过外部请求。',
  'document-collaboration-page': '该链接看起来是文档协作或私有工作区页面，已按敏感 URL 保护跳过外部请求。'
}

export function assessSensitiveExternalUrl(url: unknown): SensitiveExternalUrlDecision {
  const parsedUrl = parseUrl(url)
  if (!parsedUrl) {
    return buildSensitiveDecision('invalid-url')
  }

  if (!/^https?:$/i.test(parsedUrl.protocol)) {
    return buildSensitiveDecision('unsupported-scheme')
  }

  if (parsedUrl.username || parsedUrl.password) {
    return buildSensitiveDecision('capability-action')
  }

  const hostname = normalizeHostname(parsedUrl.hostname)
  const pathname = decodePathname(parsedUrl.pathname)

  if (isLocalOrPrivateHostname(hostname)) {
    return buildSensitiveDecision('local-network')
  }

  if (
    CAPABILITY_ACTION_PATH_RE.test(pathname) ||
    hasCapabilityParameter(parsedUrl)
  ) {
    return buildSensitiveDecision('capability-action')
  }

  if (matchesHost(hostname, EMAIL_HOSTS)) {
    return buildSensitiveDecision('email-page')
  }

  if (matchesHost(hostname, DOCUMENT_COLLAB_HOSTS)) {
    return buildSensitiveDecision('document-collaboration-page')
  }

  if (hostIncludesAny(hostname, FINANCIAL_HOST_PARTS) || FINANCIAL_PATH_RE.test(pathname)) {
    return buildSensitiveDecision('financial-page')
  }

  if (hostIncludesAny(hostname, MEDICAL_HOST_PARTS) || MEDICAL_PATH_RE.test(pathname)) {
    return buildSensitiveDecision('medical-page')
  }

  if (ACCOUNT_PATH_RE.test(pathname)) {
    return buildSensitiveDecision('account-login-page')
  }

  if (DOCUMENT_PATH_RE.test(pathname) && isLikelyPrivateWorkspaceHost(hostname)) {
    return buildSensitiveDecision('document-collaboration-page')
  }

  return {
    sensitive: false,
    reason: '',
    warning: ''
  }
}

export function isExternallyCheckableUrl(url: unknown): boolean {
  return !assessSensitiveExternalUrl(url).sensitive
}

function buildSensitiveDecision(reason: SensitiveExternalUrlReason): SensitiveExternalUrlDecision {
  return {
    sensitive: true,
    reason,
    warning: WARNING_BY_REASON[reason]
  }
}

function parseUrl(url: unknown): URL | null {
  try {
    return new URL(String(url || '').trim())
  } catch {
    return null
  }
}

function normalizeHostname(hostname: string): string {
  return String(hostname || '')
    .trim()
    .replace(/^\.+|\.+$/g, '')
    .replace(/^www\./i, '')
    .toLowerCase()
}

function decodePathname(pathname: string): string {
  try {
    return decodeURIComponent(String(pathname || ''))
  } catch {
    return String(pathname || '')
  }
}

function hasCapabilityParameter(url: URL): boolean {
  if (
    [...url.searchParams].some(([key, value]) => {
      return (
        CAPABILITY_QUERY_KEY_RE.test(key) ||
        (
          CAPABILITY_ACTION_QUERY_KEY_RE.test(key) &&
          CAPABILITY_ACTION_QUERY_VALUE_RE.test(String(value || '').trim())
        )
      )
    })
  ) {
    return true
  }

  const rawHash = decodePathname(url.hash.replace(/^#/, ''))
  const fragmentQuery = rawHash.includes('?')
    ? rawHash.slice(rawHash.indexOf('?') + 1)
    : rawHash
  return [...new URLSearchParams(fragmentQuery)].some(([key, value]) => {
    return (
      CAPABILITY_QUERY_KEY_RE.test(key) ||
      (
        CAPABILITY_ACTION_QUERY_KEY_RE.test(key) &&
        CAPABILITY_ACTION_QUERY_VALUE_RE.test(String(value || '').trim())
      )
    )
  })
}

function matchesHost(hostname: string, hosts: string[]): boolean {
  return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`))
}

function hostIncludesAny(hostname: string, fragments: string[]): boolean {
  return fragments.some((fragment) => hostname.includes(fragment))
}

function isLikelyPrivateWorkspaceHost(hostname: string): boolean {
  return matchesHost(hostname, [
    'google.com',
    'microsoft.com',
    'office.com',
    'live.com',
    'notion.so',
    'notion.site',
    'coda.io',
    'airtable.com',
    'figma.com'
  ])
}

function isLocalOrPrivateHostname(hostname: string): boolean {
  if (!hostname) {
    return false
  }

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    matchesHost(hostname, PRIVATE_DNS_ALIAS_HOSTS)
  ) {
    return true
  }

  const address = hostname.replace(/^\[|\]$/g, '')
  if (!ipaddr.isValid(address)) {
    return false
  }

  return !isPublicNetworkAddress(address)
}

export function isPublicNetworkAddress(value: unknown): boolean {
  const address = String(value || '').trim().replace(/^\[|\]$/g, '')
  if (!ipaddr.isValid(address)) {
    return false
  }
  return ipaddr.process(address).range() === 'unicast'
}

export function isVerifiedHttpsLoopbackProxyResponse({
  url,
  resolvedAddress,
  connectedAddress,
  statusCode
}: {
  url: unknown
  resolvedAddress: unknown
  connectedAddress: unknown
  statusCode: unknown
}): boolean {
  const normalizedConnectedAddress = String(connectedAddress || '')
    .trim()
    .replace(/^\[|\]$/g, '')
  const normalizedStatusCode = Number(statusCode)

  if (
    !isPublicNetworkAddress(resolvedAddress) ||
    !ipaddr.isValid(normalizedConnectedAddress) ||
    ipaddr.process(normalizedConnectedAddress).range() !== 'loopback' ||
    !Number.isInteger(normalizedStatusCode) ||
    normalizedStatusCode < 100 ||
    normalizedStatusCode > 599
  ) {
    return false
  }

  try {
    return new URL(String(url || '').trim()).protocol === 'https:'
  } catch {
    return false
  }
}
