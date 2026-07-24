import assert from 'node:assert/strict'
import {
  assessSensitiveExternalUrl,
  isPublicNetworkAddress,
  isVerifiedHttpsLoopbackProxyResponse
} from './sensitive-url.js'

for (const url of [
  'http://[::ffff:127.0.0.1]/',
  'http://[::ffff:7f00:1]/',
  'http://[fe81::1]/',
  'http://[febf::1]/',
  'http://100.64.0.1/',
  'http://printer.home.arpa/',
  'http://127.0.0.1.nip.io/admin',
  'http://127.0.0.1.sslip.io/admin',
  'http://anything.localtest.me/admin',
  'http://service.lvh.me/admin',
  'http://localhost.direct/admin',
  'http://service.local.gd/admin'
]) {
  assert.equal(
    assessSensitiveExternalUrl(url).reason,
    'local-network',
    `${url} must not bypass private-network protection`
  )
}

for (const url of [
  'https://example.com/unsubscribe?user=1',
  'https://example.com/reset-password?user=1',
  'https://example.com/password_reset/SECRET',
  'https://example.com/magic-login/SECRET',
  'https://example.com/verify-email/SECRET',
  'https://example.com/confirm-email/SECRET',
  'https://example.com/activate-account/SECRET',
  'https://example.com/download?token=secret',
  'https://example.com/download?jwt=secret',
  'https://example.com/callback?refresh_token=secret',
  'https://example.com/callback?id_token=secret',
  'https://example.com/callback?auth-token=secret',
  'https://example.com/callback?session_token=secret',
  'https://example.com/verify?oobCode=secret',
  'https://example.com/#access_token=secret',
  'https://example.com/#refresh-token=secret',
  'https://example.com/path?action=delete&id=1',
  'https://example.com/path?operation=unsubscribe&id=1',
  'https://example.com/#cmd=activate-account&id=1',
  'https://example.com/file?X-Amz-Signature=secret',
  'https://user:password@example.com/'
]) {
  assert.equal(
    assessSensitiveExternalUrl(url).reason,
    'capability-action',
    `${url} must not be requested as an availability probe`
  )
}

assert.equal(
  assessSensitiveExternalUrl('https://example.com/articles?topic=typescript').sensitive,
  false
)
assert.equal(isPublicNetworkAddress('8.8.8.8'), true)
assert.equal(isPublicNetworkAddress('127.0.0.1'), false)
assert.equal(isPublicNetworkAddress('::ffff:10.0.0.1'), false)
assert.equal(
  isVerifiedHttpsLoopbackProxyResponse({
    url: 'https://user.mihoyo.com/passport/index.html',
    resolvedAddress: '61.170.77.87',
    connectedAddress: '127.0.0.1',
    statusCode: 200
  }),
  true,
  'an authenticated HTTPS response may arrive through a loopback proxy'
)
assert.equal(
  isVerifiedHttpsLoopbackProxyResponse({
    url: 'http://user.mihoyo.com/passport/index.html',
    resolvedAddress: '61.170.77.87',
    connectedAddress: '127.0.0.1',
    statusCode: 200
  }),
  false,
  'an unauthenticated HTTP response must not relax the private endpoint boundary'
)
assert.equal(
  isVerifiedHttpsLoopbackProxyResponse({
    url: 'https://user.mihoyo.com/passport/index.html',
    resolvedAddress: '61.170.77.87',
    connectedAddress: '127.0.0.1',
    statusCode: 0
  }),
  false,
  'a loopback connection without response headers must remain unverified'
)
assert.equal(
  isVerifiedHttpsLoopbackProxyResponse({
    url: 'https://user.mihoyo.com/passport/index.html',
    resolvedAddress: '127.0.0.1',
    connectedAddress: '127.0.0.1',
    statusCode: 200
  }),
  false,
  'a hostname that resolves directly to loopback must remain protected'
)
assert.equal(
  isVerifiedHttpsLoopbackProxyResponse({
    url: 'https://user.mihoyo.com/passport/index.html',
    resolvedAddress: '61.170.77.87',
    connectedAddress: '192.168.1.10',
    statusCode: 200
  }),
  false,
  'non-loopback private endpoints must not be inferred to be local proxies'
)

console.log('Sensitive URL boundary tests passed.')
