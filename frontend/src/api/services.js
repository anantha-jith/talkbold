import apiClient from './client';

export const uploadPresentation = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await apiClient.post('/upload/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
};

export const analyzePresentation = async (data) => {
  // data contains { topic, slides, script }
  const response = await apiClient.post('/analyze/', data);
  return response.data;
};

export const getDashboardStats = async () => {
  const response = await apiClient.get('/dashboard/');
  return response.data;
};

export const sendVivaMessage = async (topic, messages, evaluate = false) => {
  const response = await apiClient.post('/viva/', { topic, messages, evaluate });
  return response.data;
};

export const transcribeAudio = async (audioBlob) => {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.webm');
  const response = await apiClient.post('/transcribe/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000,
  });
  return response.data;
};

export const exportReportPDF = async ({ topic, analysis_sections, audio_scores, ppt_quality }) => {
  const response = await apiClient.post('/report-pdf/', {
    topic, analysis_sections, audio_scores, ppt_quality
  }, { responseType: 'blob', timeout: 30000 });

  // Trigger browser download
  const url  = window.URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' }));
  const link = document.createElement('a');
  link.href  = url;
  link.setAttribute('download', `viva_report_${(topic || 'report').replace(/\s+/g, '_')}.pdf`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};
