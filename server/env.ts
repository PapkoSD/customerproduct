// Imported first so .env is loaded before any module reads process.env.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file: offline mode, or variables come from the shell.
}
