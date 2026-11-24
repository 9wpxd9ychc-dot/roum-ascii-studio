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
const state = { file: null, url: null, columns: 240, fps: 60, quality: "ultra", palette: "color", raf: 0, recording: false, lastFrame: 0, renderUrl: null };

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
  if (file.size > 50 * 1024 * 1024) { toast("This file is over the 50 MB limit. Choose a shorter or smaller video."); return; }
  stopPreview();
  if (state.url) URL.revokeObjectURL(state.url);
  state.file = file; state.url = URL.createObjectURL(file);
  video.onloadeddata = () => { if (state.file) sampleFrame(); };
  video.onloadedmetadata = () => {
    if (!Number.isFinite(video.duration) || video.duration <= 0) { toast("Safari could not read this video. Try exporting it as MP4 or MOV in Photos."); clearFile(); return; }
    if (video.duration > 30) { toast("This video is longer than 30 seconds."); clearFile(); return; }
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

  // Mobile browsers struggle with thousands of glyphs per frame at 1440p/60 FPS.
  // Render a stable mobile-friendly master, then restore the user's preview settings.
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const originalCanvas = { width: canvas.width, height: canvas.height, columns: state.columns, fps: state.fps };
  if (isMobile) {
    canvas.width = 1280;
    canvas.height = 720;
    state.columns = Math.min(state.columns, 120);
    state.fps = Math.min(state.fps, 30);
  }
  const restoreSettings = () => {
    canvas.width = originalCanvas.width;
    canvas.height = originalCanvas.height;
    state.columns = originalCanvas.columns;
    state.fps = originalCanvas.fps;
    updateControls();
    if (video.readyState >= 2) sampleFrame();
  };

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

    sampleFrame();
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
        (isMobile ? "Mobile-optimized · " : "") + formatTime(video.currentTime) + " / " + formatTime(duration));
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
      (isMobile ? " · mobile optimized" : "");
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
