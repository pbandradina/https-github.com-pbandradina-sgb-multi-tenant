export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(path, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (payload && typeof payload.error === "string") ? payload.error : `Falha na requisição ${path}`;
    throw new ApiError(response.status, message);
  }
  return payload as T;
};

const jsonBody = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body)
});

export const apiGet = <T>(path: string): Promise<T> => request<T>(path);

export const apiPost = <T>(path: string, body: unknown): Promise<T> => request<T>(path, jsonBody("POST", body));

export const apiPut = <T>(path: string, body: unknown): Promise<T> => request<T>(path, jsonBody("PUT", body));

export const apiDelete = <T = { success: boolean }>(path: string): Promise<T> =>
  request<T>(path, { method: "DELETE" });

/** Replaces the entry sharing the item id, appending it when it is new. */
export const upsertById = <T extends { id: string }>(list: T[], item: T): T[] =>
  list.some(entry => entry.id === item.id)
    ? list.map(entry => (entry.id === item.id ? item : entry))
    : [...list, item];

export const removeById = <T extends { id: string }>(list: T[], id: string): T[] =>
  list.filter(entry => entry.id !== id);
