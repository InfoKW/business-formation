import { redirect } from 'next/navigation'

// Root → redirect to /start
export default function RootPage() {
  redirect('/start')
}
