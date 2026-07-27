export const describeError = (err: unknown) => (err instanceof Error ? err.message : String(err));

// Extrai a mensagem de erro enviada pela API ({ error, details })
const readApiError = (payload: unknown): string | null => {
  if (typeof payload === "object" && payload !== null && "error" in payload) {
    const { error } = payload as { error: unknown };
    if (typeof error === "string" && error.length > 0) return error;
  }
  return null;
};

// Centraliza a checagem de status e de JSON: sem isso respostas 4xx/5xx eram
// tratadas como sucesso silencioso, pois apenas `response.ok` era observado.
export async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    throw new Error(`Falha de rede ao acessar ${url}: ${describeError(err)}`);
  }

  const rawBody = await response.text();
  let payload: unknown = null;
  if (rawBody.length > 0) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new Error(`Resposta inválida (HTTP ${response.status}) de ${url}: ${rawBody.slice(0, 200)}`);
    }
  }

  if (!response.ok) {
    throw new Error(readApiError(payload) || `HTTP ${response.status} ao acessar ${url}`);
  }

  return payload as T;
}

export const postJson = <T,>(url: string, body: unknown) =>
  apiRequest<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
