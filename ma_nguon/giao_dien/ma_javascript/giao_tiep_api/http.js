(function createHttpClient() {
  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    if (options.body !== undefined && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }

    let response;
    try {
      response = await fetch(`/api${path}`, {
        ...options,
        credentials: 'same-origin',
        headers,
        body: options.body === undefined || options.body instanceof FormData
          ? options.body
          : JSON.stringify(options.body),
      });
    } catch (cause) {
      if (cause?.name === 'AbortError') throw cause;
      const error = new Error('Không thể kết nối tới server');
      error.cause = cause;
      throw error;
    }

    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json')
      ? await response.json()
      : await response.text();

    if (!response.ok) {
      const error = new Error(body?.message || 'Yêu cầu không thành công');
      error.status = response.status;
      error.details = body?.details;

      const isAuthPage = ['/login', '/register', '/forgot-password'].includes(location.pathname);
      if (response.status === 401 && !isAuthPage) {
        location.assign(`/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`);
      }
      throw error;
    }

    return body;
  }

  window.MotorCareApi = {
    request,
    get: (path, options = {}) => request(path, options),
    post: (path, body) => request(path, { method: 'POST', body }),
    patch: (path, body) => request(path, { method: 'PATCH', body }),
    delete: (path) => request(path, { method: 'DELETE' }),
  };
}());
