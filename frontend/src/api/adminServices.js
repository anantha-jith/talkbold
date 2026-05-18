import axios from "axios"

// Relative URL — routed through Vite dev proxy → http://localhost:8000
const API_URL = "/api/admin"

// Use the internal JWT stored in localStorage (set on login)
const getHeaders = () => ({
  headers: {
    Authorization: `Bearer ${localStorage.getItem("viva_token") || ""}`,
  },
})

export const getAdminOverview = async () => {
  const { data } = await axios.get(`${API_URL}/metrics/overview`, getHeaders())
  return data
}

export const getSystemHealth = async () => {
  const { data } = await axios.get(`${API_URL}/metrics/system`, getHeaders())
  return data
}

export const getRecentReports = async () => {
  const { data } = await axios.get(`${API_URL}/reports/recent`, getHeaders())
  return data.reports
}

export const getSpeechAnalytics = async () => {
  const { data } = await axios.get(`${API_URL}/analytics/speech`, getHeaders())
  return data.data
}

export const getUsersList = async () => {
  const { data } = await axios.get(`${API_URL}/users`, getHeaders())
  return data.users
}
