const $ = id => document.getElementById(id);
const canvas = $("previewCanvas");
const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
const video = $("sourceVideo");
const fileInput = $("videoInput");
const uploadZone = $("uploadZone");
const chars = " .'^,:;Il!i><~+_-?][}{1)(|\\/*tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
const sample = document.createElement("canvas");
const sampleCtx = sample.getContext("2d", { willReadFrequently: true });
const QUALITY = { standard: { width: 1280, height: 720, columns: 160, label: "STANDARD · 720P" }, high: { width: 1920, height: 1080, columns: 240, label: "HIGH · 1080P" }, ultra: { width: 2560, height: 1440, columns: 320, label: "ULTRA · 1440P" } };
const state = { file: null, url: null, columns: 240, fps: 60, quality: "ultra", palette: "color", engine: "worker", worker: null, workerJob: 0, workerPending: new Map(), raf: 0, recording: false, lastFrame: 0, renderUrl: null };

function toast(message) {
  const el = $("toast"); el.textContent = message; el.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove("show"), 3400);
}
function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "0:00";
  return Math.floor(seconds / 60) + ":" + String(Math.floor(seconds % 60)).padStart(2, "0");
}
function setStatus(label, active = false) {
  $("workspaceStatus").innerHTML = "<i></i> " + label;
  $("workspaceStatus").style.color = active ? "#ffffff" : "";
}
function drawPlaceholder() {
  ctx.fillStyle = "#050707"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = "14px 'DM Mono', monospace"; ctx.textBaseline = "top";
  const lines = [
    "       . .       . .       . .       . .       . .       . .       . .",
    "    .:;!|/\\|!;:.      .:;!|/\\|!;:.      .:;!|/\\|!;:.",
    "  .;!|/▓▒░░▒▓\\|!;.  .;!|/▓▒░░▒▓\\|!;.  .;!|/▓▒░░▒▓\\|!;.",
    "  |/▓▒░  ROUM  ░▒▓\\|  |/▓▒░ ASCII ░▒▓\\|  |/▓▒░ STUDIO ░▒▓\\|",
    "  '|\\▓▒░░▒▓/|'      '|\\▓▒░░▒▓/|'      '|\\▓▒░░▒▓/|'",
    "     ':;!|\\|!;:'       ':;!|\\|!;:'       ':;!|\\|!;:'",
    "         . .               . .               . ."
  ];
  lines.forEach((line, i) => {
    ctx.fillStyle = i === 3 ? "#c4f36a" : i % 2 ? "#71934d" : "#506747";
    ctx.fillText(line, 90 + (i % 2) * 16, 205 + i * 31);
  });
}
function ensureWorker() {
  if (state.worker) return state.worker;
  if (!("Worker" in window)) throw new Error("Web Workers are unavailable in this browser.");
  const worker = new Worker(new URL("./ascii-worker.js", import.meta.url), { type: "module" });
  worker.onmessage = ({ data }) => {
    const pending = state.workerPending.get(data.id);
    if (!pending) return;
    state.workerPending.delete(data.id);
    pending.resolve({ indices: new Uint8Array(data.indices), colors: new Uint8ClampedArray(data.colors) });
  };
  worker.onerror = () => {
    for (const pending of state.workerPending.values()) pending.reject(new Error("Worker engine failed."));
    state.workerPending.clear(); state.worker = null;
  };
  state.worker = worker;
  return worker;
}
function processPixelsInWorker(pixels, columns, rows) {
  const worker = ensureWorker(), id = ++state.workerJob;
  return new Promise((resolve, reject) => {
    state.workerPending.set(id, { resolve, reject });
    const copy = new Uint8ClampedArray(pixels);
    worker.postMessage({ id, pixels: copy.buffer, columns, rows, palette: state.palette, chars }, [copy.buffer]);
  });
}
async function sampleFrame() {
  if (!video.videoWidth || !video.videoHeight) return;
  const columns = state.columns, cellW = canvas.width / columns, cellH = cellW * 1.72;
  const rows = Math.max(1, Math.floor(canvas.height / cellH));
  const sampleWidth = columns * 2, sampleHeight = rows * 2;
  if (sample.width !== sampleWidth || sample.height !== sampleHeight) { sample.width = sampleWidth; sample.height = sampleHeight; }
  sampleCtx.drawImage(video, 0, 0, sampleWidth, sampleHeight);
  const pixels = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight).data;
  let result;
  if (state.engine === "worker") {
    try { result = await processPixelsInWorker(pixels, columns, rows); }
    catch {
      state.engine = "main";
      document.querySelectorAll("[data-engine]").forEach(button => button.classList.toggle("selected", button.dataset.engine === "main"));
      toast("Worker Engine unavailable. Switched to Compatibility Engine.");
      result = processPixelsMain(pixels, columns, rows);
    }
  } else result = processPixelsMain(pixels, columns, rows);
  const { indices, colors } = result;
  ctx.fillStyle = "#050707"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = Math.max(1, Math.floor(cellH * .88)) + "px 'DM Mono', ui-monospace, monospace";
  ctx.textBaseline = "top";
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const i = y * columns + x, c = i * 3;
    ctx.fillStyle = "rgb(" + colors[c] + "," + colors[c + 1] + "," + colors[c + 2] + ")";
    ctx.fillText(chars[indices[i]], x * cellW, y * cellH);
  }
}
function processPixelsMain(pixels, columns, rows) {
  const indices = new Uint8Array(columns * rows), colors = new Uint8ClampedArray(columns * rows * 3);
  const sampleWidth = columns * 2;
  for (let i = 0; i < columns * rows; i++) {
    const x = (i % columns) * 2, y = Math.floor(i / columns) * 2;
    let red = 0, green = 0, blue = 0;
    for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
      const p = ((y + sy) * sampleWidth + x + sx) * 4;
      red += pixels[p]; green += pixels[p + 1]; blue += pixels[p + 2];
    }
    red = Math.round(red / 4); green = Math.round(green / 4); blue = Math.round(blue / 4);
    // Rec.709 luma drives glyph selection; averaged source RGB remains un-darkened.
    const brightness = (red * .2126 + green * .7152 + blue * .0722) / 255;
    indices[i] = Math.min(chars.length - 1, Math.round(brightness * (chars.length - 1)));
    let r, g, b;
    if (state.palette === "mono") r = g = b = Math.round(32 + brightness * 223);
    else if (state.palette === "matrix") {
      const tone = Math.round(32 + brightness * 223);
      r = Math.round(tone * .34); g = tone; b = Math.round(tone * .22);
    } else {
      // No brightness multiplier: dark and mid-tone pixels are not artificially crushed.
      r = red; g = green; b = blue;
    }
    const c = i * 3; colors[c] = r; colors[c + 1] = g; colors[c + 2] = b;
  }
  return { indices, colors };
}
async function animate(now) {
  if (now - state.lastFrame < 1000 / state.fps) { state.raf = requestAnimationFrame(animate); return; }
  state.lastFrame = now;
  await sampleFrame();
  if (!video.paused && !video.ended) state.raf = requestAnimationFrame(animate);
}
function updateControls() {
  $("columnsValue").textContent = state.columns;
  $("fpsValue").textContent = state.fps + " FPS";
  $("previewDimensions").textContent = canvas.width + " × " + canvas.height;
  if ($("resolutionValue")) $("resolutionValue").textContent = QUALITY[state.quality].label;
}
function applyQuality(mode) {
  state.quality = mode;
  const q = QUALITY[mode];
  const aspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : q.width / q.height;
  const longSide = Math.max(q.width, q.height);
  if (aspect >= 1) { canvas.width = longSide; canvas.height = Math.max(1, Math.round(longSide / aspect)); }
  else { canvas.height = longSide; canvas.width = Math.max(1, Math.round(longSide * aspect)); }
  $("previewWrap").style.aspectRatio = canvas.width + " / " + canvas.height;
  state.columns = q.columns;
  $("columns").value = String(state.columns);
  document.querySelectorAll("[data-quality]").forEach(button => button.classList.toggle("selected", button.dataset.quality === mode));
  updateControls();
  if (video.readyState >= 2) sampleFrame(); else drawPlaceholder();
}
document.querySelectorAll("[data-quality]").forEach(button => button.addEventListener("click", () => applyQuality(button.dataset.quality)));
document.querySelectorAll("[data-engine]").forEach(button => button.addEventListener("click", () => {
  state.engine = button.dataset.engine;
  document.querySelectorAll("[data-engine]").forEach(item => item.classList.toggle("selected", item === button));
  if (video.readyState >= 2) sampleFrame();
  toast(state.engine === "worker" ? "Worker Engine selected." : "Compatibility Engine selected.");
}));
function stopPreview() {
  video.pause(); cancelAnimationFrame(state.raf);
  $("previewButton").innerHTML = "<span>▶</span> Preview";
}
async function loadFile(file) {
  if (!file) return;
  if (!file.type.startsWith("video/") && !/\.(mp4|mov|webm|m4v)$/i.test(file.name)) { toast("Please choose a supported video file."); return; }
  if (file.size > 50 * 1024 * 1024) { toast("This file is over the 50 MB limit. Choose a shorter or smaller video."); return; }
  stopPreview();
  if (state.url) URL.revokeObjectURL(state.url);
  state.file = file; state.url = URL.createObjectURL(file);
  video.onloadeddata = () => { if (state.file) sampleFrame(); };
  video.onloadedmetadata = () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) { toast("Safari could not read this video. Try exporting it as MP4 or MOV in Photos."); clearFile(); return; }
    if (video.duration > 30) { toast("This video is longer than 30 seconds."); clearFile(); return; }
    applyQuality(state.quality);
    $("fileName").textContent = file.name;
    $("fileMeta").textContent = (file.size / 1024 / 1024).toFixed(1) + " MB · " + formatTime(video.duration);
    $("fileCard").classList.remove("hidden"); uploadZone.classList.add("hidden");
    $("previewOverlay").classList.add("hidden"); $("previewHint").textContent = "Source loaded · ready to preview";
    $("previewButton").disabled = false; $("renderButton").disabled = false;
    setStatus("SOURCE READY", true);
    if (video.readyState >= 2) sampleFrame();
  };
  video.onerror = () => { toast("Safari could not open this video. Try MP4 or MOV, or export a compatible copy from Photos."); clearFile(); };
  video.src = state.url; video.load();
}
function clearFile() {
  stopPreview();
  if (state.url) URL.revokeObjectURL(state.url);
  state.url = null; state.file = null; video.removeAttribute("src"); video.load(); fileInput.value = "";
  $("fileCard").classList.add("hidden"); uploadZone.classList.remove("hidden");
  $("previewOverlay").classList.remove("hidden"); $("previewHint").textContent = "Waiting for source video";
  $("previewButton").disabled = true; $("renderButton").disabled = true;
  $("resultPanel").classList.add("hidden"); $("renderProgress").classList.add("hidden");
  setStatus("READY"); drawPlaceholder();
}
fileInput.addEventListener("change", e => loadFile(e.target.files[0]));
$("removeFile").addEventListener("click", clearFile);
["dragenter", "dragover"].forEach(type => uploadZone.addEventListener(type, e => { e.preventDefault(); uploadZone.classList.add("dragover"); }));
["dragleave", "drop"].forEach(type => uploadZone.addEventListener(type, e => { e.preventDefault(); uploadZone.classList.remove("dragover"); }));
uploadZone.addEventListener("drop", e => loadFile(e.dataTransfer.files[0]));
$("columns").addEventListener("input", e => { state.columns = Number(e.target.value); updateControls(); if (video.readyState >= 2) sampleFrame(); });
document.querySelectorAll("[data-fps]").forEach(button => button.addEventListener("click", () => {
  state.fps = Number(button.dataset.fps);
  document.querySelectorAll("[data-fps]").forEach(item => item.classList.toggle("selected", item === button));
  updateControls();
}));
document.querySelectorAll("[data-palette]").forEach(button => button.addEventListener("click", () => {
  state.palette = button.dataset.palette;
  document.querySelectorAll("[data-palette]").forEach(item => item.classList.toggle("selected", item === button));
  if (video.readyState >= 2) sampleFrame();
}));
$("previewButton").addEventListener("click", async () => {
  if (!state.file) return;
  if (!video.paused) { stopPreview(); setStatus("PREVIEW PAUSED"); return; }
  if (video.ended) video.currentTime = 0;
  $("previewButton").innerHTML = "<span>Ⅱ</span> Pause"; setStatus("PREVIEWING", true);
  try { await video.play(); state.raf = requestAnimationFrame(animate); }
  catch { toast("Your browser could not play this video."); }
});
video.addEventListener("ended", () => {
  cancelAnimationFrame(state.raf); $("previewButton").innerHTML = "<span>▶</span> Preview";
  if (!state.recording) setStatus("PREVIEW COMPLETE");
});
function setProgress(percent, label, detail) {
  $("progressPercent").textContent = Math.round(percent) + "%";
  $("progressBar").style.width = Math.max(0, Math.min(100, percent)) + "%";
  $("progressLabel").textContent = label; $("progressDetail").textContent = detail;
}
function chooseRecorderType() {
  if (!window.MediaRecorder || typeof MediaRecorder.isTypeSupported !== "function") return "";
  const isApple = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const options = isApple
    ? ["video/mp4;codecs=h264", "video/mp4", "video/webm;codecs=vp8", "video/webm"]
    : ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4;codecs=h264", "video/mp4"];
  return options.find(type => MediaRecorder.isTypeSupported(type)) || "";
}
async function recordVideo() {
  if (!state.file || state.recording) return;
  if (!window.MediaRecorder || !canvas.captureStream) {
    toast("Video recording is not supported in this browser."); return;
  }

  stopPreview();
  $("renderButton").disabled = true;
  $("previewButton").disabled = true;
  $("renderProgress").classList.remove("hidden");
  $("resultPanel").classList.add("hidden");
  state.recording = true;
  state.lastFrame = 0;
  setStatus("RENDERING", true);

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const restoreSettings = () => { if (video.readyState >= 2) sampleFrame(); };

  let stream;
  let recorder;
  let progressTimer;
  let renderTimeout;
  try {
    stream = canvas.captureStream(state.fps);
    // Keep source audio when the browser exposes a capturable audio track.
    const captureSource = video.captureStream || video.webkitCaptureStream;
    if (captureSource) {
      try {
        const sourceStream = captureSource.call(video);
        sourceStream.getAudioTracks().forEach(track => stream.addTrack(track));
      } catch (audioError) { console.info("Source audio capture is unavailable.", audioError); }
    }

    const mimeType = chooseRecorderType();
    recorder = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      videoBitsPerSecond: isMobile ? 5000000 : 12000000
    });
    const chunks = [];
    recorder.ondataavailable = event => {
      if (event.data && event.data.size) chunks.push(event.data);
    };
    const finished = new Promise((resolve, reject) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || "video/webm" }));
      recorder.onerror = () => reject(new Error("The browser stopped recording unexpectedly."));
    });

    if (video.currentTime !== 0) {
      await new Promise((resolve, reject) => {
        const onSeeked = () => { cleanup(); resolve(); };
        const onError = () => { cleanup(); reject(new Error("Could not rewind the source video.")); };
        const cleanup = () => {
          video.removeEventListener("seeked", onSeeked);
          video.removeEventListener("error", onError);
        };
        video.addEventListener("seeked", onSeeked, { once: true });
        video.addEventListener("error", onError, { once: true });
        video.currentTime = 0;
      });
    }

    await sampleFrame();
    recorder.start(250);
    const duration = video.duration;
    const ended = new Promise((resolve, reject) => {
      const onEnded = () => { cleanup(); resolve(); };
      const onError = () => { cleanup(); reject(new Error("The source video could not be decoded during rendering.")); };
      const cleanup = () => {
        video.removeEventListener("ended", onEnded);
        video.removeEventListener("error", onError);
        clearTimeout(renderTimeout);
      };
      video.addEventListener("ended", onEnded, { once: true });
      video.addEventListener("error", onError, { once: true });
      renderTimeout = setTimeout(() => {
        cleanup();
        reject(new Error("Rendering timed out. Try a shorter video or Standard quality."));
      }, Math.max(45000, duration * 4000));
    });

    await video.play();
    state.raf = requestAnimationFrame(animate);
    progressTimer = setInterval(() => {
      const percent = Math.min(88, video.currentTime / duration * 88);
      setProgress(percent, "RENDERING ASCII FRAMES",
        (isMobile ? "Mobile device · " : "Desktop · ") + state.quality.toUpperCase() + " · " + state.fps + " FPS · " + formatTime(video.currentTime) + " / " + formatTime(duration));
    }, 180);

    await ended;
    clearInterval(progressTimer);
    cancelAnimationFrame(state.raf);
    if (recorder.state !== "inactive") recorder.stop();
    const output = await finished;
    video.pause();

    if (!output || output.size < 1000) throw new Error("The browser produced an empty video. Try Standard quality.");
    const fileExtension = output.type.includes("mp4") ? "mp4" : "webm";
    const label = fileExtension.toUpperCase();
    if (state.renderUrl) URL.revokeObjectURL(state.renderUrl);
    state.renderUrl = URL.createObjectURL(output);

    $("downloadButton").href = state.renderUrl;
    $("downloadButton").download = "roum-ascii." + fileExtension;
    $("saveGalleryButton").onclick = async () => {
      const file = new File([output], "roum-ascii." + fileExtension, {
        type: output.type || (fileExtension === "mp4" ? "video/mp4" : "video/webm")
      });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: "Roum ASCII video" });
        } catch (error) {
          if (error.name !== "AbortError") toast("Could not open the Photos share menu. Try Download video.");
        }
      } else {
        toast("This browser cannot send video to Photos directly. Download it, then save it from Files.");
        $("downloadButton").click();
      }
    };
    $("downloadButton").textContent = "↓ Download " + label;
    $("resultMeta").textContent = label + " · " + (output.size / 1024 / 1024).toFixed(1) + " MB" +
      (" · " + state.engine.toUpperCase() + " ENGINE");
    $("resultPanel").classList.remove("hidden");
    $("renderButton").innerHTML = "<span>✳</span> Render again <span class='button-arrow'>↗</span>";
    setProgress(100, "RENDER COMPLETE", "Your video is ready to save.");
    setStatus("RENDER COMPLETE", true);
  } catch (error) {
    console.error(error);
    toast(error.message || "Rendering failed. Try a shorter video.");
    setStatus("RENDER FAILED");
    if (recorder && recorder.state !== "inactive") {
      try { recorder.stop(); } catch {}
    }
  } finally {
    clearInterval(progressTimer);
    clearTimeout(renderTimeout);
    cancelAnimationFrame(state.raf);
    if (stream) stream.getTracks().forEach(track => track.stop());
    video.pause();
    state.recording = false;
    restoreSettings();
    $("renderButton").disabled = false;
    $("previewButton").disabled = !state.file;
  }
}
$("renderButton").addEventListener("click", recordVideo);
applyQuality("ultra"); drawPlaceholder(); updateControls();
