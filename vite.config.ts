import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * A build identifier, baked in at compile time.
 *
 * Sideloaded builds are the reason this exists: an .ipa carries no visible
 * version, so "the new screens aren't there" and "I'm still on the old build"
 * look identical on a phone. Profile shows this, which settles it in a glance.
 */
function buildId(): string {
  try {
    // Tag if this commit has one, otherwise the nearest tag plus a short sha.
    return execSync('git describe --tags --always --dirty', { encoding: 'utf8' }).trim()
  } catch {
    // No git in the build environment (a bare tarball, say). Not worth failing.
    return 'desconocida'
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __BUILD_ID__: JSON.stringify(buildId()),
  },
})
