// SeñalIA: modelo publicado de Teachable Machine.
const MODEL_URL = "https://teachablemachine.withgoogle.com/models/rTrFBnf4M/";

// Umbral inicial para la demo. Debe comprobarse con pruebas reales del modelo.
const CONFIDENCE_THRESHOLD = 0.90; // 90 %
const REQUIRED_CONSECUTIVE_FRAMES = 5;
const HISTORY_KEY = "senalia_confirmed_history_v1";
const MAX_HISTORY = 40;
const RESET_BELOW_THRESHOLD_FRAMES = 4;

// Definiciones breves según palabras frecuentes en los nombres de las clases.
// Si una clase tiene otro nombre, se muestra una explicación general para no inventar su significado.
const EXPLANATIONS = [
  { terms: ["alto", "stop", "pare"], meaning: "Indica que debes detenerte completamente antes de continuar y comprobar que sea seguro avanzar.", advice: "Detente en el lugar indicado, observa ambos sentidos y respeta la prioridad de paso." },
  { terms: ["nada", "ninguna", "no sign", "sin señal", "fondo"], meaning: "El modelo considera que la imagen no corresponde claramente a una de las señales entrenadas.", advice: "Si hay una señal, céntrala en la cámara y prueba con mejor iluminación. No interpretes esta clase como confirmación de que la vía está libre de señales." },
  { terms: ["derrumbe", "deslizamiento", "rocas", "caída de piedras"], meaning: "Advierte sobre la posible caída de rocas o tierra en la vía.", advice: "Reduce la velocidad, mantén atención al camino y sigue las indicaciones oficiales." },
  { terms: ["curva peligrosa", "curva", "curvas"], meaning: "Advierte que se aproxima una curva que requiere precaución.", advice: "Reduce la velocidad de forma segura y mantente en tu carril." },
  { terms: ["paso peatonal", "peatonal", "cruce peatonal"], meaning: "Indica un lugar destinado al cruce de peatones.", advice: "Reduce la velocidad y cede el paso a las personas que cruzan, conforme a las normas viales." },
  { terms: ["zona escolar", "escuela", "escolar"], meaning: "Advierte que hay una zona escolar o presencia posible de estudiantes.", advice: "Reduce la velocidad y presta especial atención a niños y peatones." },
  { terms: ["límite de velocidad", "velocidad máxima", "speed limit"], meaning: "Indica la velocidad máxima permitida en el tramo señalado.", advice: "Respeta el límite indicado y adapta la conducción a las condiciones del camino." },
  { terms: ["no estacionar", "prohibido estacionar", "estacionamiento"], meaning: "Indica una restricción relacionada con estacionar vehículos en ese lugar.", advice: "Busca un sitio permitido y respeta la señalización local." },
  { terms: ["sentido", "dirección", "una vía"], meaning: "Proporciona información sobre el sentido de circulación permitido.", advice: "Sigue la dirección indicada y presta atención al resto de señales." },
  { terms: ["ceda", "ceder el paso", "yield"], meaning: "Indica que debes ceder la prioridad de paso según las condiciones de la vía.", advice: "Reduce la velocidad, observa el tránsito y cede el paso cuando corresponda." },
  { terms: ["semáforo", "traffic light"], meaning: "Advierte de la proximidad de un semáforo.", advice: "Prepárate para obedecer las luces y detenerte si corresponde." },
  { terms: ["prohibido", "no entrar", "entrada prohibida"], meaning: "Indica una restricción de acceso o una maniobra prohibida.", advice: "No realices la acción prohibida y sigue una ruta permitida." }
];

let model = null;
let webcam = null;
let running = false;
let loopToken = 0;
let stableClass = "";
let stableFrames = 0;
let belowThresholdFrames = 0;
let lastSavedClass = "";
let currentClass = "";
let toastTimer = null;
let history = loadHistory();

const el = id => document.getElementById(id);
const startBtn = el("startBtn");
const stopBtn = el("stopBtn");

function setStatus(text, state = "idle") {
  const badge = el("modelStatus");
  badge.className = `status-badge status-${state}`;
  badge.innerHTML = `<span class="status-dot"></span>${escapeHTML(text)}`;
}
function showToast(message) {
  const toast = el("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function normalize(value) {
  return String(value || "").toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[_-]+/g, " ").trim();
}
function getExplanation(className) {
  const key = normalize(className);
  const match = EXPLANATIONS.find(item => item.terms.some(term => key.includes(normalize(term))));
  if (match) return match;
  return {
    meaning: `Esta clase corresponde a “${className}”, según el nombre configurado en el modelo. Revisa la señal y la descripción oficial para confirmar su significado.`,
    advice: "Conduce con precaución y sigue siempre las señales oficiales y las normas de tránsito. Esta explicación general debe personalizarse si la clase tiene un significado específico."
  };
}
function isNothingClass(className) {
  const key = normalize(className);
  return ["nada", "ninguna", "no sign", "sin senal", "fondo", "ningun objeto"].some(term => key.includes(normalize(term)));
}
async function startCamera() {
  if (running) return;
  startBtn.disabled = true;
  setStatus("Cargando modelo…", "loading");
  try {
    if (!model) {
      const modelURL = MODEL_URL + "model.json";
      const metadataURL = MODEL_URL + "metadata.json";
      model = await tmImage.load(modelURL, metadataURL);
    }
    if (!webcam) {
      webcam = new tmImage.Webcam(420, 315, true);
      await webcam.setup();
    }
    await webcam.play();
    const stage = el("cameraStage");
    el("cameraPlaceholder").classList.add("hidden");
    const oldCanvas = stage.querySelector("canvas");
    if (oldCanvas) oldCanvas.remove();
    stage.insertBefore(webcam.canvas, stage.querySelector(".scan-corners"));
    running = true;
    loopToken++;
    stableClass = ""; stableFrames = 0; belowThresholdFrames = 0; lastSavedClass = ""; currentClass = "";
    stopBtn.disabled = false;
    startBtn.disabled = true;
    setStatus("Cámara activa", "ready");
    showToast("Modelo conectado. Cámara iniciada.");
    runLoop(loopToken);
  } catch (error) {
    console.error("No se pudo iniciar SeñalIA:", error);
    setStatus("No se pudo conectar", "error");
    startBtn.disabled = false;
    stopBtn.disabled = true;
    let message = "No se pudo cargar el modelo o activar la cámara. Revisa tu conexión e intenta de nuevo.";
    if (String(error).toLowerCase().includes("permission") || String(error).toLowerCase().includes("denied")) {
      message = "El navegador no tiene permiso para usar la cámara. Revisa los permisos del sitio.";
    }
    showToast(message);
    el("cameraPlaceholder").classList.remove("hidden");
  }
}
async function runLoop(token) {
  if (!running || token !== loopToken || !webcam || !model) return;
  try {
    webcam.update();
    const predictions = await model.predict(webcam.canvas);
    predictions.sort((a, b) => b.probability - a.probability);
    const top = predictions[0];
    if (top) handlePrediction(top.className, top.probability);
  } catch (error) {
    console.error("Error en la predicción:", error);
    setStatus("Error de análisis", "error");
  }
  if (running && token === loopToken) requestAnimationFrame(() => runLoop(token));
}
function handlePrediction(className, probability) {
  const confident = probability >= CONFIDENCE_THRESHOLD;
  const isNothing = isNothingClass(className);

  if (!confident || isNothing) {
    belowThresholdFrames++;
    stableClass = "";
    stableFrames = 0;
    if (belowThresholdFrames >= RESET_BELOW_THRESHOLD_FRAMES) {
      currentClass = "";
      lastSavedClass = "";
      showUncertain(isNothing
        ? "No se ha identificado una señal entrenada. Si ves una señal, céntrala y vuelve a intentarlo."
        : `La predicción más alta es ${(probability * 100).toFixed(0)} %, por debajo del umbral de ${(CONFIDENCE_THRESHOLD * 100).toFixed(0)} %. Intenta mejorar la luz o centrar la señal.`);
    }
    return;
  }

  belowThresholdFrames = 0;
  hideUncertain();
  if (stableClass === className) stableFrames++;
  else { stableClass = className; stableFrames = 1; }
  currentClass = className;

  if (stableFrames >= REQUIRED_CONSECUTIVE_FRAMES) {
    displayResult(className, probability);
    if (lastSavedClass !== className) {
      saveDetection(className, probability);
      lastSavedClass = className;
    }
  } else {
    setStatus(`Confirmando señal (${stableFrames}/${REQUIRED_CONSECUTIVE_FRAMES})`, "loading");
  }
}
function showUncertain(message) {
  el("uncertainText").textContent = message;
  el("uncertainMessage").classList.remove("hidden");
  if (!currentClass) {
    el("resultEmpty").classList.remove("hidden");
    el("resultContent").classList.add("hidden");
  }
  setStatus("Esperando una detección segura", "loading");
}
function hideUncertain() { el("uncertainMessage").classList.add("hidden"); }
function displayResult(className, probability) {
  const explanation = getExplanation(className);
  el("resultEmpty").classList.add("hidden");
  el("resultContent").classList.remove("hidden");
  el("resultName").textContent = className;
  el("resultMeaning").textContent = explanation.meaning;
  el("resultAdvice").textContent = explanation.advice;
  const percent = Math.round(probability * 100);
  el("confidenceText").textContent = `${percent} %`;
  el("confidenceBar").style.width = `${percent}%`;
  el("confidenceCaption").textContent = percent >= 95 ? "Muy alta" : "Alta";
  el("resultCategory").textContent = "SEÑAL CONFIRMADA";
  setStatus("Señal confirmada", "ready");
}
function stopCamera() {
  running = false;
  loopToken++;
  if (webcam) {
    try { webcam.stop(); } catch (_) {}
    if (webcam.canvas && webcam.canvas.parentNode) webcam.canvas.remove();
    webcam = null;
  }
  el("cameraPlaceholder").classList.remove("hidden");
  startBtn.disabled = false;
  stopBtn.disabled = true;
  stableClass = ""; stableFrames = 0; belowThresholdFrames = 0;
  setStatus(model ? "Modelo conectado" : "Modelo sin conectar", model ? "ready" : "idle");
  showToast("Cámara detenida.");
}
function loadHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(stored) ? stored.filter(item => item && item.name && Number.isFinite(item.confidence)).slice(0, MAX_HISTORY) : [];
  } catch (_) { return []; }
}
function persistHistory() {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }
  catch (error) { showToast("No se pudo guardar el historial en este navegador."); }
}
function saveDetection(className, probability) {
  const entry = { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, name: className, confidence: probability, time: new Date().toISOString() };
  history.unshift(entry);
  history = history.slice(0, MAX_HISTORY);
  persistHistory();
  renderHistory();
  showToast(`Se guardó la detección: ${className}`);
}
function renderHistory() {
  const list = el("historyList");
  list.querySelectorAll(".history-item").forEach(node => node.remove());
  el("historyEmpty").classList.toggle("hidden", history.length > 0);
  el("historyCount").textContent = `${history.length} ${history.length === 1 ? "registro" : "registros"}`;
  history.forEach(entry => {
    const item = document.createElement("article");
    item.className = "history-item";
    const date = new Date(entry.time);
    const timeText = Number.isNaN(date.getTime()) ? "Fecha desconocida" : date.toLocaleString("es-SV", { dateStyle: "medium", timeStyle: "short" });
    item.innerHTML = `
      <div class="history-symbol" aria-hidden="true">✓</div>
      <div><div class="history-name">${escapeHTML(entry.name)}</div><div class="history-time">${escapeHTML(timeText)}</div></div>
      <div class="history-confidence">${Math.round(entry.confidence * 100)} %</div>
      <button class="history-delete" type="button" aria-label="Eliminar detección" title="Eliminar registro">×</button>`;
    item.querySelector("button").addEventListener("click", () => {
      history = history.filter(row => row.id !== entry.id);
      persistHistory(); renderHistory(); showToast("Registro eliminado.");
    });
    list.appendChild(item);
  });
}
el("clearHistoryBtn").addEventListener("click", () => {
  if (!history.length) { showToast("El historial ya está vacío."); return; }
  if (confirm("¿Quieres borrar todos los registros del historial de este navegador?")) {
    history = []; persistHistory(); renderHistory(); showToast("Historial borrado.");
  }
});
startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);
renderHistory();

window.addEventListener("beforeunload", () => {
  if (webcam) { try { webcam.stop(); } catch (_) {} }
});
