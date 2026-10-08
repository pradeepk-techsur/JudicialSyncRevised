import { redirect } from 'next/navigation';

export default function Home() {
  // F8 (CONTEXT locked decision): the Command Center is the default landing —
  // / redirects to /command-center (previously /case).
  redirect('/command-center');
}
