import { redirect } from 'next/navigation'

// Root → redirect to /apply
export default function RootPage() {
  redirect('/apply')
}
