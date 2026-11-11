export const dynamic='force-dynamic';
export function GET(req:Request){return Response.redirect(new URL('/team/auth',req.url),302);}
