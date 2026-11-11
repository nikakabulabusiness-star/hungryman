/** A native bearer is never a browser cookie. Presence is not authorization: the
 * session lookup and existing per-endpoint permissions still validate it. */
export function mobileBearer(headers:Headers):string|null {
 const match=/^Bearer (hmw_[0-9a-f]{64})$/i.exec(headers.get('authorization')||'');
 return match?.[1]||null;
}

export function nativeAuthRequest(request:Request):boolean {
 const path=new URL(request.url).pathname;
 return ['/api/mobile/auth/login','/api/mobile/auth/register','/api/mobile/auth/email-code/request','/api/mobile/auth/email-code/verify','/api/mobile/auth/password-reset'].includes(path)
  && !request.headers.has('origin') && !request.headers.has('sec-fetch-site')
  && request.headers.get('content-type')?.split(';')[0].trim()==='application/json';
}
