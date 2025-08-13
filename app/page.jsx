// app/page.jsx
import { redirect } from 'next/navigation';

export default function Home() {
  // Send anyone hitting "/" to the embed tester
  redirect('/embed');
}
