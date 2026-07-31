const baseUrl = process.env.SMOKE_BASE_URL || "http://localhost:5173";

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let body = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed with ${response.status}: ${JSON.stringify(body)}`);
  }

  return body;
}

async function main() {
  const health = await request("/api/health");
  if (health.status !== "ok") {
    throw new Error("Health check did not return ok.");
  }

  const adminLogin = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: process.env.SMOKE_ADMIN_EMAIL || "admin@vastram.local",
      password: process.env.SMOKE_ADMIN_PASSWORD || "Admin@123"
    })
  });

  const token = adminLogin.token;
  if (!token) {
    throw new Error("Admin login did not return a JWT.");
  }

  await request("/api/dashboard/summary", {
    headers: { Authorization: `Bearer ${token}` }
  });

  await request("/api/ready-made", {
    headers: { Authorization: `Bearer ${token}` }
  });

  console.log(`Smoke test passed for ${baseUrl}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
