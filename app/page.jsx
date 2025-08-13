// Force / → /embed. (Redirect also handled in next.config.mjs, but this is a belt-and-suspenders.)
import { redirect } from 'next/navigation';

export default function Page() {
  redirect('/embed');
}
