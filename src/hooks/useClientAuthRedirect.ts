import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export const useClientAuthRedirect = () => {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session) {
        // 如果当前不在登录页，则重定向到登录页
        if (pathname !== '/login') {
          router.replace('/login');
          return;
        }
      } else {
        // 如果当前在登录页，但用户已登录，重定向到主页
        if (pathname === '/login') {
          router.replace('/');
          return;
        }
      }

      // 如果状态正确，才设为 ready
      setReady(true);
    };

    checkAuth();
  }, [pathname, router]);

  return { ready };
};