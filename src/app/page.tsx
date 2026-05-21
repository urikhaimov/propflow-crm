// app/page.tsx
// Redirect root to dashboard; landing page stays at /home (or keep original)
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/dashboard')
}
