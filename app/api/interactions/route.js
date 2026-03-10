const notFoundResponse = () =>
  Response.json({ error: "Not Found" }, { status: 404 });

export async function GET() {
  return notFoundResponse();
}

export async function POST() {
  return notFoundResponse();
}

export async function PUT() {
  return notFoundResponse();
}

export async function PATCH() {
  return notFoundResponse();
}

export async function DELETE() {
  return notFoundResponse();
}
