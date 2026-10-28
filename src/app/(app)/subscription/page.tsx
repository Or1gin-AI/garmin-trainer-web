import { redirect } from 'next/navigation';

// Payments were removed from the product; keep the old URL working.
export default function SubscriptionPage() {
  redirect('/training');
}
