if (!process.env.API_BASE_URL) {
  throw new Error("API_BASE_URL env var is required");
}
