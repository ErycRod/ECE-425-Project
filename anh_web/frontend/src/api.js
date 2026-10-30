// Calls to the FastAPI backend (anh_web/backend/server.py).
// Every function returns { ok: true, data } or { ok: false, offline, error }
// so the page can show a message instead of breaking.

async function request(method, path, body) {
  const options = { method: method, headers: {} };
  if (body instanceof FormData) {
    // files: the browser sets the content type itself
    options.body = body;
  } else if (body !== undefined) {
    options.headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(path, options);
  } catch (error) {
    return { ok: false, offline: true, error: "Backend offline" };
  }

  // the Vite proxy answers with a 5xx error when the backend is not running
  if (response.status >= 500) {
    return { ok: false, offline: true, error: "Backend offline" };
  }

  if (!response.ok) {
    let message = "Backend error " + response.status;
    try {
      const errorData = await response.json();
      if (typeof errorData.detail === "string") {
        message = errorData.detail;
      }
    } catch (error) {
      // no JSON in the error, keep the simple message
    }
    return { ok: false, offline: false, error: message };
  }

  const data = await response.json();
  return { ok: true, data: data };
}

export function getConfig() {
  return request("GET", "/api/config");
}

export function getEstimate(settings) {
  return request("POST", "/api/estimate", settings);
}

export function getSweep(settings) {
  return request("POST", "/api/sweep", settings);
}

// send an image and a question to the model
export function askModel(imageFile, question) {
  const form = new FormData();
  form.append("image", imageFile);
  form.append("question", question);
  return request("POST", "/api/ask", form);
}
