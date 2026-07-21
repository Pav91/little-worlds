import { useEffect, useRef, useState } from "react";
import {
  ArrowClockwise,
  ArrowUUpLeft,
  ArrowUUpRight,
  CameraRotate,
  CaretDown,
  CaretLeft,
  CaretRight,
  CaretUp,
  CheckCircle,
  CircleNotch,
  Cloud,
  CloudRain,
  Copy,
  ImageSquare,
  Gauge,
  MagicWand,
  Plus,
  Sun,
  Trash,
} from "@phosphor-icons/react";
import { useExperience } from "../state/experience.js";
import { validateObjectDNA } from "../generation/objectPipeline.js";
import { generateObjectWithOpenAI } from "../generation/openaiObjectClient.js";
import { RENDER_FIDELITY_PROFILES } from "../scene/renderFidelity.js";

const PHOTO_STAGES = [
  "Reading photo evidence",
  "Proposing ObjectDNA",
  "Compiling Held Geometry",
  "Validating the asset",
];

const DESCRIPTION_STAGES = [
  "Building the semantic graph",
  "Proposing ObjectDNA",
  "Compiling Held Geometry",
  "Validating the asset",
];

const OBJECT_LIBRARY = [
  { kind: "chair", name: "Chair" },
  { kind: "armchair", name: "Armchair" },
  { kind: "sofa", name: "Sofa" },
  { kind: "stool", name: "Stool" },
  { kind: "bench", name: "Bench" },
  { kind: "table", name: "Table" },
  { kind: "side-table", name: "Side Table" },
  { kind: "desk", name: "Desk" },
  { kind: "lamp", name: "Lamp" },
  { kind: "plant", name: "Plant" },
  { kind: "cabinet", name: "Cabinet" },
  { kind: "bookshelf", name: "Bookshelf" },
  { kind: "bed", name: "Bed" },
  { kind: "vase", name: "Vase" },
  { kind: "mirror", name: "Mirror" },
  { kind: "television", name: "Television" },
  { kind: "candle", name: "Candle" },
];

const nearestIdentityColor = (red, green, blue) => {
  const colors = {
    red: [158, 104, 93],
    green: [103, 128, 111],
    blue: [88, 120, 138],
    ivory: [228, 218, 200],
  };
  return Object.entries(colors).sort(([, a], [, b]) => {
    const distanceA = (red - a[0]) ** 2 + (green - a[1]) ** 2 + (blue - a[2]) ** 2;
    const distanceB = (red - b[0]) ** 2 + (green - b[1]) ** 2 + (blue - b[2]) ** 2;
    return distanceA - distanceB;
  })[0][0];
};

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error || new Error("The photo could not be read."));
  reader.readAsDataURL(file);
});

const readPhotoEvidence = async (file) => {
  const evidence = { source: "photo", filename: file.name, mimeType: file.type, size: file.size };
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 24;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, 24, 24);
    const pixels = context.getImageData(0, 0, 24, 24).data;
    const width = bitmap.width;
    const height = bitmap.height;
    let red = 0; let green = 0; let blue = 0; let samples = 0;
    for (let index = 0; index < pixels.length; index += 16) {
      if (pixels[index + 3] < 24) continue;
      red += pixels[index]; green += pixels[index + 1]; blue += pixels[index + 2]; samples += 1;
    }
    const longestEdge = Math.max(width, height);
    const imageScale = Math.min(1, 1600 / Math.max(longestEdge, 1));
    const imageCanvas = document.createElement("canvas");
    imageCanvas.width = Math.max(1, Math.round(width * imageScale));
    imageCanvas.height = Math.max(1, Math.round(height * imageScale));
    imageCanvas.getContext("2d").drawImage(bitmap, 0, 0, imageCanvas.width, imageCanvas.height);
    const imageDataUrl = imageCanvas.toDataURL("image/jpeg", .9);
    bitmap.close?.();
    return {
      evidence: {
        ...evidence,
        width,
        height,
        aspect: width / Math.max(height, 1),
        dominantColor: nearestIdentityColor(red / Math.max(samples, 1), green / Math.max(samples, 1), blue / Math.max(samples, 1)),
      },
      imageDataUrl,
    };
  } catch {
    return { evidence, imageDataUrl: await readFileAsDataUrl(file) };
  }
};

const objectNameFor = (kind, description, source) => {
  const libraryName = OBJECT_LIBRARY.find((item) => item.kind === kind)?.name || "Object";
  if (source === "photo") {
    const filename = description.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim();
    return filename ? filename.slice(0, 56) : `${libraryName} from photo`;
  }
  const concise = description.trim().replace(/\s+/g, " ");
  return concise ? concise.slice(0, 56) : libraryName;
};

const formatEnvironmentTime = (value) => {
  const hour = Math.floor(value);
  const minutes = Math.round((value - hour) * 60);
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minutes).padStart(2, "0")} ${suffix}`;
};

export function Interface() {
  const [drawer, setDrawer] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [processingStep, setProcessingStep] = useState(-1);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [generationError, setGenerationError] = useState(null);
  const fileInput = useRef();
  const timers = useRef([]);
  const generationAbort = useRef(null);

  const selectedObjectId = useExperience((s) => s.selectedObjectId);
  const historyLength = useExperience((s) => s.history.length);
  const futureLength = useExperience((s) => s.future.length);
  const undo = useExperience((s) => s.undo);
  const redo = useExperience((s) => s.redo);
  const resetCamera = useExperience((s) => s.resetCreateCamera);
  const cameraMotion = useExperience((s) => s.cameraMotion);
  const setCameraMotion = useExperience((s) => s.setCameraMotion);
  const environmentTime = useExperience((s) => s.environmentTime);
  const environmentWeather = useExperience((s) => s.environmentWeather);
  const renderFidelity = useExperience((s) => s.renderFidelity);
  const setEnvironmentTime = useExperience((s) => s.setEnvironmentTime);
  const setEnvironmentWeather = useExperience((s) => s.setEnvironmentWeather);
  const setRenderFidelity = useExperience((s) => s.setRenderFidelity);
  const rotateSelected = useExperience((s) => s.rotateSelected);
  const duplicateSelected = useExperience((s) => s.duplicateSelected);
  const deleteSelected = useExperience((s) => s.deleteSelected);
  const selectObject = useExperience((s) => s.selectObject);
  const confirmPlacement = useExperience((s) => s.confirmPlacement);
  const cancelCurrentAction = useExperience((s) => s.cancelCurrentAction);
  const addLibraryObject = useExperience((s) => s.addLibraryObject);
  const addGeneratedObject = useExperience((s) => s.addGeneratedObject);
  const generatedAssets = useExperience((s) => s.generatedAssets);

  const clearTimers = () => {
    timers.current.forEach((timer) => {
      window.clearTimeout(timer);
      window.clearInterval(timer);
    });
    timers.current = [];
  };

  useEffect(() => () => {
    clearTimers();
    generationAbort.current?.abort();
  }, []);

  useEffect(() => {
    if (selectedObjectId) setCameraMotion(null);
  }, [selectedObjectId, setCameraMotion]);

  useEffect(() => {
    const stopCamera = () => setCameraMotion(null);
    window.addEventListener("pointerup", stopCamera);
    window.addEventListener("blur", stopCamera);
    return () => {
      window.removeEventListener("pointerup", stopCamera);
      window.removeEventListener("blur", stopCamera);
      stopCamera();
    };
  }, [setCameraMotion]);

  const closeDrawer = () => {
    clearTimers();
    generationAbort.current?.abort();
    generationAbort.current = null;
    setDrawer(null);
    setProcessingStep(-1);
    setProcessingProgress(0);
    setDragActive(false);
    setGenerationError(null);
  };

  const beginProcessing = async (type, description = "", evidence = {}, imageDataUrl = null) => {
    clearTimers();
    generationAbort.current?.abort();
    const controller = new AbortController();
    generationAbort.current = controller;
    setGenerationError(null);
    setDrawer(type);
    setProcessingStep(0);
    setProcessingProgress(4);
    const startedAt = performance.now();
    timers.current.push(window.setTimeout(() => {
      setProcessingStep(1);
      setProcessingProgress((current) => Math.max(current, 18));
    }, 650));
    timers.current.push(window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      const estimated = elapsed < 650
        ? 4 + (elapsed / 650) * 12
        : 18 + (1 - Math.exp(-(elapsed - 650) / 15000)) * 60;
      setProcessingProgress((current) => Math.max(current, Math.min(78, estimated)));
    }, 180));
    try {
      const result = await generateObjectWithOpenAI({ description, source: type, evidence, imageDataUrl, signal: controller.signal });
      if (controller.signal.aborted) return;
      clearTimers();
      setProcessingStep(2);
      setProcessingProgress((current) => Math.max(current, 84));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      if (controller.signal.aborted) return;
      const objectDNA = result.objectDNA;
      const validationReport = validateObjectDNA(objectDNA);
      if (!validationReport.valid) {
        setProcessingStep(-1);
        setProcessingProgress(0);
        setGenerationError(`The ObjectDNA compiler rejected this asset: ${validationReport.errors.join(" · ")}`);
        return;
      }
      setProcessingStep(3);
      setProcessingProgress(96);
      const name = result.name || objectNameFor(objectDNA.taxonomy.type, description, type);
      addGeneratedObject({
        kind: "compiled",
        category: objectDNA.taxonomy.type,
        name,
        description,
        source: type,
        generationSeed: objectDNA.seed,
        evidence,
        objectDNA,
        validationReport,
        pipeline: {
          proposer: objectDNA.provenance.generatedBy,
          model: result.model,
          responseId: result.responseId,
          compiler: validationReport.compiler,
          vocabulary: validationReport.vocabulary,
        },
      });
      timers.current.push(window.setTimeout(() => setProcessingProgress(100), 80));
      timers.current.push(window.setTimeout(() => {
        setDrawer(null);
        setProcessingStep(-1);
        setProcessingProgress(0);
        setPrompt("");
        generationAbort.current = null;
      }, 480));
    } catch (error) {
      if (error?.name === "AbortError") return;
      clearTimers();
      setProcessingStep(-1);
      setProcessingProgress(0);
      setGenerationError(error?.message || "OpenAI object generation failed.");
      generationAbort.current = null;
    }
  };

  const handlePhoto = async (file) => {
    if (!file) return;
    setDrawer("photo");
    setProcessingStep(0);
    setProcessingProgress(3);
    try {
      const { evidence, imageDataUrl } = await readPhotoEvidence(file);
      beginProcessing("photo", file.name, evidence, imageDataUrl);
    } catch (error) {
      setProcessingStep(-1);
      setProcessingProgress(0);
      setGenerationError(error?.message || "The photo could not be prepared for generation.");
    }
  };

  const addReadyMadeObject = (item) => {
    addLibraryObject(item);
    closeDrawer();
  };

  const addGeneratedAsset = (asset) => {
    addLibraryObject({ ...asset, assetId: asset.id, source: "generated-library", collection: "generated" });
    closeDrawer();
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
        return;
      }
      if (command && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (drawer) closeDrawer();
        else cancelCurrentAction();
        return;
      }
      if (event.code === "Space" && !selectedObjectId && document.activeElement?.tagName !== "TEXTAREA") {
        event.preventDefault();
        resetCamera();
      } else if ((event.key === "Backspace" || event.key === "Delete") && selectedObjectId && document.activeElement?.tagName !== "TEXTAREA") {
        event.preventDefault();
        deleteSelected();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawer, selectedObjectId, undo, redo, resetCamera, deleteSelected, cancelCurrentAction]);

  const stages = drawer === "photo" ? PHOTO_STAGES : DESCRIPTION_STAGES;
  const done = () => {
    confirmPlacement();
    selectObject(null);
  };

  const startCameraMotion = (direction, event) => {
    if (selectedObjectId) return;
    event.preventDefault();
    event.stopPropagation();
    try { event.currentTarget.setPointerCapture?.(event.pointerId); } catch { /* Pointer capture is optional. */ }
    setCameraMotion(direction);
  };

  const stopCameraMotion = (event) => {
    try {
      if (event?.currentTarget?.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    } catch { /* The global release handler still stops the camera. */ }
    setCameraMotion(null);
  };

  const cameraButton = (direction, label, Icon, className) => <button
    className={`${className} ${cameraMotion === direction ? "active" : ""}`}
    disabled={Boolean(selectedObjectId)}
    aria-label={label}
    aria-pressed={cameraMotion === direction}
    title={selectedObjectId ? "Camera locked while an object is selected" : label}
    onPointerDown={(event) => startCameraMotion(direction, event)}
    onPointerUp={stopCameraMotion}
    onPointerCancel={stopCameraMotion}
    onLostPointerCapture={() => setCameraMotion(null)}
  ><Icon weight="bold" /></button>;

  return <div className="studio-interface">
    <header className="studio-top-left">
      <div className="studio-wordmark" aria-label="Little Worlds">
        <div className="brand-mark" aria-hidden="true"><span /><i /><b /></div>
        <strong>Little Worlds</strong>
      </div>
      <div className="studio-history" aria-label="Project controls">
        <button onClick={undo} disabled={!historyLength} aria-label="Undo" title="Undo"><ArrowUUpLeft weight="bold" /></button>
        <button onClick={redo} disabled={!futureLength} aria-label="Redo" title="Redo"><ArrowUUpRight weight="bold" /></button>
      </div>
    </header>

    <section className="studio-environment-controls" aria-label="Weather and daylight controls">
      <div className="environment-primary-row">
        <div className="weather-controls" role="group" aria-label="Weather">
          {[
            ["clear", "Clear sky", Sun],
            ["cloudy", "Cloudy", Cloud],
            ["rain", "Rain", CloudRain],
          ].map(([weather, label, Icon]) => <button
            key={weather}
            className={environmentWeather === weather ? "active" : ""}
            onClick={() => setEnvironmentWeather(weather)}
            aria-label={label}
            aria-pressed={environmentWeather === weather}
            title={label}
          ><Icon weight={environmentWeather === weather ? "fill" : "bold"} /></button>)}
        </div>
        <label className="fidelity-control" title="Rendering fidelity">
          <Gauge weight="bold" aria-hidden="true" />
          <input
            type="range"
            min="0"
            max="2"
            step="1"
            value={renderFidelity}
            onChange={(event) => setRenderFidelity(event.target.value)}
            aria-label="Rendering fidelity"
            aria-valuetext={RENDER_FIDELITY_PROFILES[renderFidelity].label}
          />
          <output>{RENDER_FIDELITY_PROFILES[renderFidelity].label}</output>
        </label>
      </div>
      <label className="daylight-control">
        <Sun weight="fill" aria-hidden="true" />
        <input
          type="range"
          min="6"
          max="20"
          step="0.25"
          value={environmentTime}
          onChange={(event) => setEnvironmentTime(event.target.value)}
          aria-label="Time of day"
        />
        <output>{formatEnvironmentTime(environmentTime)}</output>
      </label>
    </section>

    <section className={`studio-camera-controls ${selectedObjectId ? "locked" : ""}`} aria-label="Camera controls">
      <div className="camera-dpad">
        {cameraButton("up", "Move camera up", CaretUp, "camera-up")}
        {cameraButton("left", "Move camera left", CaretLeft, "camera-left")}
        <button
          className="camera-reset"
          disabled={Boolean(selectedObjectId)}
          onClick={() => { setCameraMotion(null); resetCamera(); }}
          aria-label="Reset camera"
          title={selectedObjectId ? "Camera locked while an object is selected" : "Reset camera"}
        ><CameraRotate weight="bold" /></button>
        {cameraButton("right", "Move camera right", CaretRight, "camera-right")}
        {cameraButton("down", "Move camera down", CaretDown, "camera-down")}
      </div>
    </section>

    <section className={`creation-drawer ${drawer ? `open ${drawer}` : ""}`} aria-hidden={!drawer} aria-label={drawer === "photo" ? "Generate an object from a photo" : drawer === "describe" ? "Describe an object" : drawer === "library" ? "Add an object" : undefined}>
      {drawer && <div className="creation-drawer-inner">
        {generationError && <div className="generation-error" role="alert"><strong>Generation stopped</strong><span>{generationError}</span></div>}
        {processingStep >= 0 ? <div className="processing-state">
          <span className="visually-hidden" role="status" aria-live="polite">{stages[processingStep]}</span>
          <div className="processing-heading"><CircleNotch className="processing-spinner" weight="bold" /><div><h2>Creating your object</h2><p>Turning it into something that belongs in the studio.</p></div></div>
          <div className="processing-progress">
            <div className="processing-progress-label"><span>Estimated progress</span><strong>{Math.round(processingProgress)}%</strong></div>
            <div className="processing-progress-track" role="progressbar" aria-label="Object generation progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(processingProgress)}>
              <span style={{ width: `${processingProgress}%` }} />
            </div>
          </div>
          <div className="processing-steps">{stages.map((stage, index) => <div key={stage} className={index < processingStep ? "complete" : index === processingStep ? "active" : ""}>
            {index < processingStep ? <CheckCircle weight="fill" /> : <span>{index + 1}</span>}<strong>{stage}</strong>
          </div>)}</div>
        </div> : drawer === "photo" ? <>
          <div className="drawer-heading">
            <div><h2>Generate from a photo</h2><p>Choose a clear photo of one household object.</p></div>
            <div className="drawer-actions"><button className="drawer-primary" onClick={() => fileInput.current?.click()}>Browse Photos</button><button onClick={closeDrawer}>Cancel</button></div>
          </div>
          <button
            className={`photo-dropzone ${dragActive ? "drag-active" : ""}`}
            onClick={() => fileInput.current?.click()}
            onDragOver={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => { event.preventDefault(); setDragActive(false); handlePhoto(event.dataTransfer.files?.[0]); }}
          >
            <ImageSquare weight="duotone" /><span><strong>Drop a photo here</strong><small>JPG, PNG or HEIC</small></span>
          </button>
          <input ref={fileInput} hidden type="file" accept="image/jpeg,image/png,image/heic,image/heif" onChange={(event) => handlePhoto(event.target.files?.[0])} />
        </> : drawer === "describe" ? <>
          <div className="drawer-heading">
            <div><h2>Describe an object</h2><p>Tell us what you would like to place in the studio.</p></div>
            <div className="drawer-actions"><button className="drawer-primary" disabled={!prompt.trim()} onClick={() => beginProcessing("describe", prompt)}><MagicWand weight="bold" />Generate</button><button onClick={closeDrawer}>Cancel</button></div>
          </div>
          <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={'Describe something from your home, such as “a green velvet armchair with rounded wooden legs.”'} rows={3} />
        </> : <>
          <div className="drawer-heading">
            <div><h2>Add an object</h2><p>Reuse something you generated or choose a ready-made piece.</p></div>
            <div className="drawer-actions"><button onClick={closeDrawer}>Cancel</button></div>
          </div>
          <div className="object-library-sections">
            {generatedAssets.length > 0 && <div className="library-section generated-library-section">
              <div className="library-section-heading"><span><MagicWand weight="fill" />Generated</span><small>{generatedAssets.length}</small></div>
              <div className="generated-object-grid">
                {generatedAssets.map((asset) => <button key={asset.id} className="generated-object-card" onClick={() => addGeneratedAsset(asset)} aria-label={`Add generated object ${asset.name}`}>
                  <MagicWand weight="duotone" />
                  <span><strong>{asset.name}</strong><small>{asset.objectDNA ? `${asset.objectDNA.taxonomy.type} · ${asset.validationReport?.score || 0}/100` : asset.source === "photo" ? "Generated from photo" : "Generated from description"}</small></span>
                </button>)}
              </div>
            </div>}
            <div className="library-section">
              <div className="library-section-heading"><span>Ready-made</span><small>{OBJECT_LIBRARY.length}</small></div>
              <div className="object-library-grid">
                {OBJECT_LIBRARY.map((item) => <button key={item.kind} data-kind={item.kind} onClick={() => addReadyMadeObject(item)}>{item.name}</button>)}
              </div>
            </div>
          </div>
        </>}
      </div>}
    </section>

    <section className="studio-action-bar" aria-label="Object actions">
      {!selectedObjectId ? <div className="creation-actions">
        <button className="photo-action" onClick={() => { setDrawer("photo"); setProcessingStep(-1); }}><ImageSquare weight="bold" />Generate from Photo</button>
        <button className="describe-action" onClick={() => { setDrawer("describe"); setProcessingStep(-1); }}><MagicWand weight="bold" />Describe Object</button>
        <button className="add-action" onClick={() => { setDrawer("library"); setProcessingStep(-1); }}><Plus weight="bold" />Add Object</button>
      </div> : <div className="selected-actions">
        <button onClick={rotateSelected}><ArrowClockwise weight="bold" />Rotate</button>
        <button onClick={duplicateSelected}><Copy weight="bold" />Duplicate</button>
        <button className="delete-action" onClick={deleteSelected}><Trash weight="fill" />Delete</button>
        <button className="done-action" onClick={done}>Done</button>
      </div>}
    </section>
  </div>;
}
