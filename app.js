const $ = id => document.getElementById(id);
const canvas = $("previewCanvas");
const ctx = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
const video = $("sourceVideo");
const fileInput = $("videoInput");
const uploadZone = $("uploadZone");
const chars = " .'^,:;Il!i><~+_-?][}{1)(|\\/*tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
const sample = document.createElement("canvas");
const sampleCtx = sample.getContext("2d", { willReadFrequently: true });
const QUALITY = { standard: { width: 1280, height: 720, columns: 120, label: "STANDARD · 720P" }, high: { width: 1920, height: 1080, columns: 180, label: "HIGH · 1080P" }, ultra: { width: 2560, height: 1440, columns: 240, label: "ULTRA · 1440P" } };
const state = { file: null, url: null, columns: 240, fps: 30, quality: "ultra", palette: "color", raf: 0, recording: false, lastFrame: 0, renderUrl: null };

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
function sampleFrame() {
  if (!video.videoWidth || !video.videoHeight) return;
  const columns = state.columns, cellW = canvas.width / columns, cellH = cellW * 1.72;
  const rows = Math.max(1, Math.floor(canvas.height / cellH));
  if (sample.width !== columns || sample.height !== rows) { sample.width = columns; sample.height = rows; }
  sampleCtx.drawImage(video, 0, 0, columns, rows);
  const pixels = sampleCtx.getImageData(0, 0, columns, rows).data;
  ctx.fillStyle = "#050707"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = Math.max(5, Math.floor(cellH * .88)) + "px 'DM Mono', ui-monospace, monospace";
  ctx.textBaseline = "top";
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const p = (y * columns + x) * 4, red = pixels[p], green = pixels[p + 1], blue = pixels[p + 2];
    const brightness = (red * .299 + green * .587 + blue * .114) / 255;
    const char = chars[Math.min(chars.length - 1, Math.floor(brightness * (chars.length - 1)))];
    if (state.palette === "mono") {
      const tone = Math.round(95 + brightness * 155); ctx.fillStyle = "rgb(" + tone + "," + tone + "," + tone + ")";
    } else if (state.palette === "matrix") {
      const tone = Math.round(65 + brightness * 170); ctx.fillStyle = "rgb(" + Math.round(tone * .58) + "," + tone + "," + Math.round(tone * .42) + ")";
    } else {
      const lift = .32 + brightness * .68;
      ctx.fillStyle = "rgb(" + Math.round(red * lift) + "," + Math.round(green * lift) + "," + Math.round(blue * lift) + ")";
    }
    ctx.fillText(char, x * cellW, y * cellH);
  }
}
function animate(now) {
  if (now - state.lastFrame < 1000 / state.fps) { state.raf = requestAnimationFrame(animate); return; }
  state.lastFrame = now; sampleFrame();
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
  canvas.width = q.width; canvas.height = q.height;
  state.columns = q.columns;
  $("columns").value = String(state.columns);
  document.querySelectorAll("[data-quality]").forEach(button => button.classList.toggle("selected", button.dataset.quality === mode));
  updateControls();
  if (video.readyState >= 2) sampleFrame(); else drawPlaceholder();
}
document.querySelectorAll("[data-quality]").forEach(button => button.addEventListener("click", () => applyQuality(button.dataset.quality)));
function stopPreview() {
  video.pause(); cancelAnimationFrame(state.raf);
  $("previewButton").innerHTML = "<span>▶</span> Preview";
}
async function loadFile(file) {
  if (!file) return;
  if (!file.type.startsWith("video/") && !/\.(mp4|mov|webm|m4v)$/i.test(file.name)) { toast("Please choose a supported video file."); return; }
  if (file.size > 20 * 1024 * 1024) { toast("This file is over the 20 MB limit."); return; }
  stopPreview();
  if (state.url) URL.revokeObjectURL(state.url);
  state.file = file; state.url = URL.createObjectURL(file);
  video.onloadeddata = () => { if (state.file) sampleFrame(); };
  video.src = state.url; video.load();
  video.onloadedmetadata = () => {
    if (video.duration > 30) { toast("This video is longer than 30 seconds."); clearFile(); return; }
    $("fileName").textContent = file.name;
    $("fileMeta").textContent = (file.size / 1024 / 1024).toFixed(1) + " MB · " + formatTime(video.duration);
    $("fileCard").classList.remove("hidden"); uploadZone.classList.add("hidden");
    $("previewOverlay").classList.add("hidden"); $("previewHint").textContent = "Source loaded · ready to preview";
    $("previewButton").disabled = false; $("renderButton").disabled = false;
    setStatus("SOURCE READY", true);
    if (video.readyState >= 2) sampleFrame();
  };
  video.onerror = () => { toast("This video format could not be opened by your browser."); clearFile(); };
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
  const options = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4;codecs=h264", "video/mp4"];
  return options.find(type => MediaRecorder.isTypeSupported(type)) || "";
}
async function convertToMp4(webmBlob) {
  setProgress(90, "ENCODING MP4", "Preparing MP4 export. This may take a little while…");
  const { FFmpeg } = await import("https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js");
  const { toBlobURL } = await import("https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.2/dist/esm/index.js");
  const ffmpeg = new FFmpeg(), base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/umd";
  ffmpeg.on("progress", ({ progress }) => {
    const pct = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
    setProgress(90 + pct * 9, "ENCODING MP4", "Encoding video · " + Math.round(pct * 100) + "%");
  });
  ffmpeg.on("log", ({ message }) => {
    if (message && /frame=/.test(message)) {
      const match = message.match(/frame=\s*(\d+)/);
      if (match) $("progressDetail").textContent = "Encoding frame " + match[1] + "…";
    }
  });
  setProgress(90, "LOADING MP4 ENCODER", "Loading video encoder…");
  await ffmpeg.load({
    classWorkerURL: await toBlobURL("https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js", "text/javascript"),
    coreURL: await toBlobURL(base + "/ffmpeg-core.js", "text/javascript"),
    wasmURL: await toBlobURL(base + "/ffmpeg-core.wasm", "application/wasm")
  });
  await ffmpeg.writeFile("ascii-recording." + (webmBlob.type.includes("mp4") ? "mp4" : "webm"), new Uint8Array(await webmBlob.arrayBuffer()));
  const extension = (state.file.name.split(".").pop() || "mp4").replace(/[^a-z0-9]/gi, "");
  const originalName = "original." + extension;
  await ffmpeg.writeFile(originalName, new Uint8Array(await state.file.arrayBuffer()));
  await ffmpeg.exec(["-i", "ascii-recording." + (webmBlob.type.includes("mp4") ? "mp4" : "webm"), "-i", originalName, "-map", "0:v:0", "-map", "1:a?", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "18", "-pix_fmt", "yuv420p", "-b:v", "12M", "-maxrate", "16M", "-bufsize", "24M", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", "roum-ascii.mp4"]);
  const data = await ffmpeg.readFile("roum-ascii.mp4");
  return new Blob([data], { type: "video/mp4" });
}
async function recordVideo() {
  if (!state.file || state.recording) return;
  if (!window.MediaRecorder || !canvas.captureStream) { toast("Video recording is not supported in this browser."); return; }
  stopPreview(); $("renderButton").disabled = true; $("previewButton").disabled = true;
  $("renderProgress").classList.remove("hidden"); $("resultPanel").classList.add("hidden");
  setProgress(0, "RENDERING ASCII FRAMES", "Starting local video render…");
  state.recording = true; state.lastFrame = 0; setStatus("RENDERING", true);
  const stream = canvas.captureStream(state.fps), mimeType = chooseRecorderType();
  let recorder;
  try {
    recorder = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 12000000 });
  } catch (error) {
    stream.getTracks().forEach(track => track.stop());
    state.recording = false; $("renderButton").disabled = false; $("previewButton").disabled = !state.file;
    toast("This browser cannot record at the selected settings. Try High or Standard quality.");
    setStatus("RENDER NOT SUPPORTED"); return;
  }
  const chunks = [];
  recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  const finished = new Promise((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
    recorder.onerror = () => reject(new Error("Browser recording failed."));
  });
  try {
    if (video.currentTime !== 0) await new Promise(resolve => { video.addEventListener("seeked", resolve, { once: true }); video.currentTime = 0; });
    sampleFrame(); recorder.start(500); await video.play(); state.raf = requestAnimationFrame(animate);
    const duration = video.duration;
    const progressTimer = setInterval(() => {
      const percent = Math.min(88, video.currentTime / duration * 88);
      setProgress(percent, "RENDERING ASCII FRAMES", "Frame " + formatTime(video.currentTime) + " / " + formatTime(duration));
    }, 180);
    await new Promise(resolve => video.addEventListener("ended", resolve, { once: true }));
    clearInterval(progressTimer); cancelAnimationFrame(state.raf); recorder.stop();
    const webm = await finished; video.pause(); state.recording = false; stream.getTracks().forEach(track => track.stop());
    let output = webm, fileExtension = webm.type.includes("mp4") ? "mp4" : "webm", label = fileExtension.toUpperCase();
    if (fileExtension !== "mp4") try { output = await convertToMp4(webm); fileExtension = "mp4"; label = "MP4"; }
    catch (error) {
      console.warn("MP4 conversion unavailable; keeping browser recording.", error);
      toast("MP4 encoder unavailable. Your browser video is ready as WebM.");
      setProgress(100, "WEBM EXPORT READY", "MP4 conversion was unavailable in this browser.");
    }
    if (state.renderUrl) URL.revokeObjectURL(state.renderUrl);
    state.renderUrl = URL.createObjectURL(output);
    $("downloadButton").href = state.renderUrl; $("downloadButton").download = "roum-ascii." + fileExtension;
    $("saveGalleryButton").onclick = async () => {
      const file = new File([output], "roum-ascii." + fileExtension, { type: output.type || (fileExtension === "mp4" ? "video/mp4" : "video/webm") });
      if (navigator.canShare && navigator.canShare({ files: [file] }) && navigator.share) {
        try {
          await navigator.share({ files: [file], title: "Roum ASCII video" });
        } catch (shareError) {
          if (shareError.name !== "AbortError") toast("Could not open the share menu. Use Download instead.");
        }
      } else {
        toast("Use Download, then open the file and choose Save Video to add it to Photos.");
        $("downloadButton").click();
      }
    };
    $("downloadButton").textContent = "↓ Download " + label;
    $("resultMeta").textContent = label + " · " + (output.size / 1024 / 1024).toFixed(1) + " MB";
    $("resultPanel").classList.remove("hidden"); $("renderButton").disabled = false; $("previewButton").disabled = false;
    $("renderButton").innerHTML = "<span>✳</span> Render again <span class='button-arrow'>↗</span>";
    setStatus("RENDER COMPLETE", true);
    if (fileExtension === "mp4") setProgress(100, "RENDER COMPLETE", "Your video is ready to save.");
  } catch (error) {
    state.recording = false; stream.getTracks().forEach(track => track.stop());
    console.error(error); toast(error.message || "Rendering failed. Try a shorter video."); setStatus("RENDER FAILED");
  } finally {
    $("renderButton").disabled = false; $("previewButton").disabled = !state.file;
  }
}
$("renderButton").addEventListener("click", recordVideo);
applyQuality("ultra"); drawPlaceholder(); updateControls();
