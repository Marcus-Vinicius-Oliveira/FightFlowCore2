import { QueryClient, QueryFunction } from "@tanstack/react-query";

function dispatchUnauthorized(message?: string) {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
  window.dispatchEvent(
    new CustomEvent('auth:unauthorized', { detail: { message } })
  );
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    if (res.status === 401) {
      const body = await res.json().catch(() => ({}));
      dispatchUnauthorized(body?.error);
      throw new Error(body?.error ?? 'Sessão expirada. Faça login novamente.');
    }
    const text = (await res.text()) || res.statusText;
    // O servidor responde { error: "mensagem em pt-BR" } — mostrar a mensagem
    // limpa no toast em vez do JSON bruto com status na frente.
    let message = `${res.status}: ${text}`;
    try {
      const body = JSON.parse(text);
      if (typeof body?.error === 'string') message = body.error;
    } catch {
      // corpo não é JSON — mantém o texto bruto com status
    }
    throw new Error(message);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Get auth token from localStorage
  const token = localStorage.getItem('auth_token');
  
  const headers: HeadersInit = {};
  if (data) {
    headers["Content-Type"] = "application/json";
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

export const getQueryFn: <T>() => QueryFunction<T> =
  () =>
  async ({ queryKey }) => {
    // Get auth token from localStorage
    const token = localStorage.getItem('auth_token');
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    };

    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers,
    });

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn(),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes - permite invalidação funcionar corretamente
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
