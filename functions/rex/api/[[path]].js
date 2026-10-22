export function onRequest() {
  return Response.json(
    { error: 'Set the private Mac manager address in Rex Settings and connect WireGuard.' },
    { status: 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
