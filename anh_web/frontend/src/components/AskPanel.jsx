import { useEffect, useState } from "react";
import { askModel } from "../api.js";
import { formatSeconds, shortDesignName } from "../format.js";

// "Ask the model" card: pick an image, type a question, and the backend
// sends them to Eryc's model (eryc_model/vlm.py).
// The time on this PC is measured. The FPGA times are the performance
// model's estimates for the design picked in the sidebar.
export default function AskPanel(props) {
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState(null); // what the backend sent back
  const [error, setError] = useState(null);

  // show a preview of the picked image (and free the old one)
  useEffect(() => {
    if (imageFile === null) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  function handleFileChange(event) {
    let file = null;
    if (event.target.files.length > 0) {
      file = event.target.files[0];
    }
    setImageFile(file);
    setReply(null);
    setError(null);
  }

  async function handleAsk(event) {
    event.preventDefault();
    setBusy(true);
    setReply(null);
    setError(null);

    const result = await askModel(imageFile, question);
    if (result.ok) {
      setReply(result.data);
    } else {
      setError(result.error);
    }
    setBusy(false);
  }

  let canAsk = true;
  if (imageFile === null || question.trim() === "" || busy) {
    canAsk = false;
  }

  // status pill in the corner
  let statusPill;
  if (reply && reply.connected) {
    statusPill = <span className="badge badge-ok">MODEL CONNECTED</span>;
  } else if (props.flags && props.flags.model_file_found) {
    statusPill = <span className="badge badge-ok">MODEL FILE FOUND</span>;
  } else {
    statusPill = <span className="badge">MODEL NOT CONNECTED</span>;
  }

  let preview = null;
  if (previewUrl) {
    preview = <img className="ask-preview" src={previewUrl} alt="Picked image" />;
  }

  // right side: answer, waiting text or a message
  let result;
  if (busy) {
    result = <p className="muted-text">Thinking…</p>;
  } else if (error) {
    result = <p className="ask-message">{error}</p>;
  } else if (reply && reply.answer !== null) {
    let fpgaLine = null;
    if (props.estimate) {
      const estimate = props.estimate;
      fpgaLine = (
        <div className="ask-times">
          Modelled on FPGA {shortDesignName(estimate.P, estimate.bits)}: first word{" "}
          <span className="mono">{formatSeconds(estimate.ttft_s)} s</span> · full answer (
          {estimate.out_tokens} tokens) <span className="mono">{formatSeconds(estimate.answer_s)} s</span>
        </div>
      );
    }
    result = (
      <>
        <p className="ask-answer">{reply.answer}</p>
        <div className="ask-times">
          Measured on this PC: <span className="mono">{formatSeconds(reply.time_s)} s</span>
        </div>
        {fpgaLine}
      </>
    );
  } else if (reply) {
    result = <p className="ask-message">{reply.message}</p>;
  } else {
    result = <p className="muted-text">The answer will show here.</p>;
  }

  return (
    <section className="card span-2">
      <div className="card-header">
        <h2 className="card-title">Ask the model</h2>
        {statusPill}
      </div>

      <div className="ask-layout">
        <form className="ask-form" onSubmit={handleAsk}>
          <label className="field">
            <span className="field-label">Image</span>
            <input className="field-input" type="file" accept="image/*" onChange={handleFileChange} />
          </label>
          {preview}
          <label className="field">
            <span className="field-label">Question</span>
            <input
              className="field-input"
              type="text"
              placeholder="What is in the picture?"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
            />
          </label>
          <button className="ask-button" type="submit" disabled={!canAsk}>
            Ask
          </button>
        </form>

        <div className="ask-result">{result}</div>
      </div>
    </section>
  );
}
