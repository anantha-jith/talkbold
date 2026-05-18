import { useState } from "react";
import { uploadPPT, analyzeQuery, getViva } from "../api/api";

export default function Home() {
  const [file, setFile] = useState(null);
  const [query, setQuery] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [viva, setViva] = useState("");
  const [status, setStatus] = useState("");

  const handleUpload = async () => {
    if (!file) return;

    const res = await uploadPPT(file);
    setStatus(`Uploaded! Slides: ${res.slides}`);
  };

  const handleAnalyze = async () => {
    const res = await analyzeQuery(query);
    setAnalysis(res.analysis);
  };

  const handleViva = async () => {
    const res = await getViva("computer science");
    setViva(res.viva_output);
  };

  return (
    <div className="container">
      <h1>🎓 Mock Viva AI</h1>

      <div className="card">
        <h2>Upload PPT</h2>
        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
        <button onClick={handleUpload}>Upload</button>
        <p>{status}</p>
      </div>

      <div className="card">
        <h2>Ask Question</h2>
        <input
          type="text"
          placeholder="Ask about your PPT..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button onClick={handleAnalyze}>Analyze</button>
      </div>

      <div className="card">
        <h2>AI Analysis</h2>
        <p>{analysis}</p>
      </div>

      <div className="card">
        <h2>Viva Questions</h2>
        <button onClick={handleViva}>Generate Viva</button>
        <p>{viva}</p>
      </div>
    </div>
  );
}