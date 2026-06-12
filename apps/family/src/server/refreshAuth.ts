// Authorization for the mutating POST /api/refresh endpoint.
//
// The server binds to localhost by default, so refresh is unreachable off-box
// unless the operator opts into LAN exposure with HOST=0.0.0.0. For that case,
// setting REFRESH_TOKEN locks it down: callers must present the token in an
// `X-Refresh-Token` header or `?token=` query param. With no token configured
// the endpoint stays open (fine on a trusted single-host LAN).
export function isRefreshAuthorized(
  token: string | undefined,
  provided: { header?: string | null; query?: unknown },
): boolean {
  if (!token) return true;
  return provided.header === token || provided.query === token;
}
