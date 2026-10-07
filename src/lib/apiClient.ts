import { useRoleStore } from '@/stores/roleStore';

// There is no session/cookie infra (TechArch 04-security.md §5.1) — the
// active role lives only in the zustand store, so every request explicitly
// carries it as a plain header. Read via getState() (not a hook) since this
// is called from non-component contexts (react-query query functions).
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const role = useRoleStore.getState().role;
  return fetch(path, {
    ...init,
    headers: {
      ...init?.headers,
      'X-User-Role': role,
    },
  });
}
