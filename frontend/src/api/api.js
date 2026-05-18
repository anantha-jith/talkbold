const BASE_URL = "http://127.0.0.1:8000";

export const uploadPPT = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BASE_URL}/api/upload/`, {
    method: "POST",
    body: formData,
  });

  return res.json();
};

export const analyzeQuery = async (query) => {
  const res = await fetch(`${BASE_URL}/api/analyze/?query=${query}`);
  return res.json();
};

export const getViva = async (topic) => {
  const res = await fetch(`${BASE_URL}/api/viva/?topic=${topic}`);
  return res.json();
};