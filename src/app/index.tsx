import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { getLastRead } from '@/lib/theme';

export default function Index() {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    getLastRead().then((last) => setHref(last ? `/${last.book}/${last.chapter}` : '/jhn/1'));
  }, []);

  return href ? <Redirect href={href} /> : null;
}
