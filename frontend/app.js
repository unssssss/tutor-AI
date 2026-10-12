const SUBJECTS = [
  "mathematics", "physics", "chemistry", "biology",
  "history", "geography", "english", "computer science",
];

const STYLES = [
  { id: "visual", label: "visual" },
  { id: "example", label: "example based" },
  { id: "step_by_step", label: "step by step" },
  { id: "simple", label: "simple explanation" },
  { id: "practice", label: "practice focused" },
];

const appState = {
  subject: localStorage.getItem("subject") || "mathematics",
  learningStyle: localStorage.getItem("learningStyle") || "simple",
  topic: localStorage.getItem("topic") || "",
};

let quizWaiting = false;
let lastSeenEventTime = 0;
let latestKnownEventTime = 0;

function saveState() {
  localStorage.setItem("subject", appState.subject);
  localStorage.setItem("learningStyle", appState.learningStyle);
  localStorage.setItem("topic", appState.topic);
}

function styleLabel(id) {
  const found = STYLES.find((s) => s.id === id);
  return found ? found.label : id;
}

// tabs, wired up first and with no dependency on any external library, so
// navigation keeps working even if something below this point fails

document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// turns ai text (markdown headers, bold, lists, $math$ and $$math$$) into
// properly rendered html instead of raw symbols on the page. if the marked
// or katex cdn scripts failed to load for any reason, this quietly falls
// back to plain text instead of breaking the rest of the page
if (typeof marked !== "undefined") {
  marked.setOptions({ breaks: true });
}

function renderFormattedText(container, rawText) {
  const text = rawText || "";

  if (typeof marked === "undefined") {
    container.textContent = text;
    return;
  }

  const mathPieces = [];

  // pull math out first so marked's own escaping rules don't mangle latex,
  // display math ($$...$$) has to be pulled before inline math ($...$)
  let withPlaceholders = text.replace(/\$\$([\s\S]+?)\$\$/g, (match) => {
    mathPieces.push(match);
    return `@@MATH${mathPieces.length - 1}@@`;
  });
  withPlaceholders = withPlaceholders.replace(/\$([^\s$][^$\n]*?[^\s$]|[^\s$])\$/g, (match) => {
    mathPieces.push(match);
    return `@@MATH${mathPieces.length - 1}@@`;
  });

  let html = marked.parse(withPlaceholders);

  // strip anything dangerous (script tags, event handler attributes) before
  // this ever reaches innerHTML, since the text can come from the ai or from
  // a file someone uploaded
  if (typeof DOMPurify !== "undefined") {
    html = DOMPurify.sanitize(html);
  }

  mathPieces.forEach((piece, i) => {
    const escaped = piece.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html = html.split(`@@MATH${i}@@`).join(escaped);
  });

  container.innerHTML = html;

  if (typeof renderMathInElement !== "undefined") {
    renderMathInElement(container, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
    });
  }
}

// dashboard chips

function renderChips() {
  const subjectGrid = document.getElementById("subjectGrid");
  subjectGrid.innerHTML = "";
  SUBJECTS.forEach((subject) => {
    const chip = document.createElement("button");
    chip.className = "chip" + (subject === appState.subject ? " active" : "");
    chip.textContent = subject;
    chip.addEventListener("click", () => {
      appState.subject = subject;
      saveState();
      renderChips();
      updateDashboardStats();
      refreshMaterialStatus();
      refreshProgress();
    });
    subjectGrid.appendChild(chip);
  });

  const styleGrid = document.getElementById("styleGrid");
  styleGrid.innerHTML = "";
  STYLES.forEach((style) => {
    const chip = document.createElement("button");
    chip.className = "chip" + (style.id === appState.learningStyle ? " active" : "");
    chip.textContent = style.label;
    chip.addEventListener("click", () => {
      appState.learningStyle = style.id;
      saveState();
      renderChips();
      updateDashboardStats();
    });
    styleGrid.appendChild(chip);
  });
}

document.getElementById("setCustomSubject").addEventListener("click", () => {
  const input = document.getElementById("customSubject");
  const value = input.value.trim();
  if (!value) return;
  appState.subject = value.toLowerCase();
  saveState();
  input.value = "";
  renderChips();
  updateDashboardStats();
  refreshMaterialStatus();
  refreshProgress();
});

function updateDashboardStats() {
  document.getElementById("statSubject").textContent = appState.subject;
  document.getElementById("statStyle").textContent = styleLabel(appState.learningStyle);
  document.getElementById("statTopic").textContent = appState.topic || "not set";
}

// learning section

document.getElementById("teachBtn").addEventListener("click", async () => {
  const topicInput = document.getElementById("topicInput");
  const topic = topicInput.value.trim();
  const box = document.getElementById("explanationBox");
  if (!topic) {
    box.textContent = "type a topic first.";
    return;
  }

  appState.topic = topic;
  saveState();
  updateDashboardStats();

  box.textContent = "the ai is thinking, this can take a few seconds...";

  try {
    const res = await fetch("/api/teach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: appState.subject,
        topic: topic,
        learning_style: appState.learningStyle,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      box.textContent = data.error || "the ai is taking a little longer. please wait and try again.";
      return;
    }
    renderFormattedText(box, data.explanation);
  } catch (err) {
    box.textContent = "could not reach the backend. check that the server is running.";
  }
});

document.getElementById("followupBtn").addEventListener("click", async () => {
  const input = document.getElementById("followupInput");
  const message = input.value.trim();
  const box = document.getElementById("followupBox");
  if (!message) return;

  box.textContent = "thinking...";

  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: appState.subject,
        topic: appState.topic,
        learning_style: appState.learningStyle,
        message: message,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      renderFormattedText(box, data.reply);
    } else {
      box.textContent = data.error || "something went wrong.";
    }
  } catch (err) {
    box.textContent = "could not reach the backend.";
  }

  input.value = "";
});

// quiz section

document.getElementById("newQuestionBtn").addEventListener("click", async () => {
  const topic = document.getElementById("quizTopic").value.trim();
  const qtype = document.getElementById("quizType").value;
  const difficulty = document.getElementById("quizDifficulty").value;

  const card = document.getElementById("questionCard");
  const questionText = document.getElementById("questionText");
  card.classList.remove("hidden");
  questionText.textContent = "generating a question...";
  document.getElementById("mcqOptions").innerHTML = "";
  document.getElementById("yesnoOptions").classList.add("hidden");
  document.getElementById("answerFeedback").textContent = "";
  document.getElementById("answerFeedback").className = "feedback";
  document.getElementById("nextQuestionBtn").classList.add("hidden");

  try {
    const res = await fetch("/api/quiz/new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: appState.subject,
        topic: topic,
        qtype: qtype,
        difficulty: difficulty,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      questionText.textContent = data.error || "could not generate a question right now.";
      quizWaiting = false;
      return;
    }
    renderQuestion(data);
  } catch (err) {
    questionText.textContent = "could not reach the backend.";
  }
});

function renderQuestion(data) {
  document.getElementById("questionSource").textContent = data.source === "ai" ? "ai generated" : "question bank";
  const difficultyTag = document.getElementById("questionDifficulty");
  difficultyTag.textContent = data.difficulty;
  if (data.target_difficulty && data.target_difficulty !== data.difficulty) {
    difficultyTag.textContent += ` (wanted ${data.target_difficulty}, ai was busy)`;
  }
  renderFormattedText(document.getElementById("questionText"), data.question);

  const mcqBox = document.getElementById("mcqOptions");
  const yesnoBox = document.getElementById("yesnoOptions");
  mcqBox.innerHTML = "";

  if (data.qtype === "mcq") {
    yesnoBox.classList.add("hidden");
    data.options.forEach((option) => {
      const btn = document.createElement("button");
      btn.textContent = option;
      btn.addEventListener("click", () => submitAnswer(option, btn));
      mcqBox.appendChild(btn);
    });
  } else {
    yesnoBox.classList.remove("hidden");
    document.querySelectorAll(".yesno-options button").forEach((b) => (b.disabled = false));
    quizWaiting = true;
    // only treat button presses newer than anything we've already seen as new,
    // resetting this to 0 would make the previous answer's result reappear
    lastSeenEventTime = latestKnownEventTime;
  }
}

async function submitAnswer(answer, clickedBtn) {
  const feedback = document.getElementById("answerFeedback");
  feedback.textContent = "checking...";

  document.querySelectorAll(".mcq-options button").forEach((b) => (b.disabled = true));
  document.querySelectorAll(".yesno-options button").forEach((b) => (b.disabled = true));

  try {
    const res = await fetch("/api/quiz/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answer: answer }),
    });
    const data = await res.json();
    showFeedback(data, clickedBtn);
  } catch (err) {
    feedback.textContent = "could not reach the backend.";
  }
  quizWaiting = false;
}

function showFeedback(data, clickedBtn) {
  const feedback = document.getElementById("answerFeedback");
  feedback.className = "feedback " + (data.correct ? "correct" : "wrong");

  let text = data.correct ? "correct! " : "not quite. ";
  text += data.explanation || "";
  if (!data.correct && data.correct_answer) {
    text += " the correct answer is: " + data.correct_answer;
  }
  if (data.misunderstanding) {
    text += " what might have been misunderstood: " + data.misunderstanding;
  }
  renderFormattedText(feedback, text);

  if (clickedBtn) {
    clickedBtn.classList.add(data.correct ? "correct" : "wrong");
  }

  document.getElementById("nextQuestionBtn").classList.remove("hidden");
  refreshDashboardScore();
  refreshProgress();
}

document.querySelectorAll(".yesno-options .btn").forEach((btn) => {
  btn.addEventListener("click", () => submitAnswer(btn.dataset.answer, btn));
});

document.getElementById("nextQuestionBtn").addEventListener("click", () => {
  document.getElementById("newQuestionBtn").click();
});

// ask ai section

document.getElementById("chatBtn").addEventListener("click", sendChatMessage);
document.getElementById("chatInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChatMessage();
});

async function sendChatMessage() {
  const input = document.getElementById("chatInput");
  const message = input.value.trim();
  if (!message) return;

  const thread = document.getElementById("chatThread");
  addChatBubble(thread, "student", message);
  input.value = "";

  const thinkingBubble = addChatBubble(thread, "ai", "thinking...");

  try {
    const res = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: appState.subject,
        topic: appState.topic,
        learning_style: appState.learningStyle,
        message: message,
      }),
    });
    const data = await res.json();
    if (res.ok) {
      renderFormattedText(thinkingBubble, data.reply);
    } else {
      thinkingBubble.textContent = data.error || "something went wrong.";
    }
  } catch (err) {
    thinkingBubble.textContent = "could not reach the backend.";
  }
}

function addChatBubble(thread, sender, text) {
  const bubble = document.createElement("div");
  bubble.className = "chat-msg " + sender;
  bubble.textContent = text;
  thread.appendChild(bubble);
  thread.scrollTop = thread.scrollHeight;
  return bubble;
}

// materials

document.getElementById("uploadMaterialBtn").addEventListener("click", async () => {
  const fileInput = document.getElementById("materialFile");
  const statusBox = document.getElementById("materialStatus");
  const file = fileInput.files[0];

  if (!file) {
    statusBox.textContent = "choose a pdf or txt file first.";
    return;
  }

  statusBox.textContent = "uploading and reading the file...";

  const form = new FormData();
  form.append("subject", appState.subject);
  form.append("file", file);

  try {
    const res = await fetch("/api/materials/upload", { method: "POST", body: form });
    const data = await res.json();
    if (!res.ok) {
      statusBox.textContent = data.error || "could not upload this file.";
      return;
    }
    fileInput.value = "";
    refreshMaterialStatus();
  } catch (err) {
    statusBox.textContent = "could not reach the backend.";
  }
});

document.getElementById("clearMaterialBtn").addEventListener("click", async () => {
  try {
    await fetch("/api/materials/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: appState.subject }),
    });
  } catch (err) {
    // ignore, refreshMaterialStatus will just show whatever the backend still has
  }
  refreshMaterialStatus();
});

function refreshMaterialStatus() {
  document.getElementById("materialSubjectLabel").textContent = appState.subject;

  fetch("/api/materials/status?subject=" + encodeURIComponent(appState.subject))
    .then((r) => r.json())
    .then((data) => {
      const statusBox = document.getElementById("materialStatus");
      const statChip = document.getElementById("statMaterial");
      if (data.has_material) {
        statusBox.textContent = `loaded: ${data.filename} (${data.chars_used} characters used).`;
        statChip.textContent = data.filename;
      } else {
        statusBox.textContent = "no material loaded, the ai will use general knowledge.";
        statChip.textContent = "none";
      }
    })
    .catch(() => {});
}

function refreshProgress() {
  fetch("/api/progress?subject=" + encodeURIComponent(appState.subject))
    .then((r) => r.json())
    .then((data) => {
      const box = document.getElementById("topicsReview");
      if (!data.topics || data.topics.length === 0) {
        box.textContent = "answer a few quiz questions to see this fill in.";
        return;
      }
      const lines = data.topics.map((t) => {
        const pct = Math.round(t.mastery * 100);
        const badge = t.mastered ? " (mastered)" : "";
        return `- **${t.topic}**: ${pct}% estimated mastery${badge}, ${t.correct}/${t.total} correct so far`;
      });
      renderFormattedText(box, lines.join("\n"));
    })
    .catch(() => {});
}

// esp8266 / iot status polling

function refreshDashboardScore() {
  fetch("/api/status")
    .then((r) => r.json())
    .then((data) => applyStatus(data))
    .catch(() => {});
}

function applyStatus(data) {
  document.getElementById("statScore").textContent = `${data.score} / ${data.total}`;

  const dotClass = data.esp_connected ? "dot online" : "dot offline";
  document.getElementById("pulseDot").className = dotClass;
  document.getElementById("pulseLabel").textContent = data.esp_connected ? "device online" : "device offline";
  document.getElementById("iotConnDot").className = dotClass;
  document.getElementById("iotConnText").textContent = data.esp_connected ? "connected" : "disconnected";

  document.getElementById("iotWaiting").textContent = quizWaiting ? "yes" : "no";
  document.getElementById("iotLastButton").textContent = data.last_button || "-";
  document.getElementById("iotLastResult").textContent = data.last_result || "-";

  // if the esp8266 answered a yesno question while the student was not
  // clicking anything in the browser, pick that result up here instead
  if (quizWaiting && data.last_event_time && data.last_event_time > lastSeenEventTime) {
    lastSeenEventTime = data.last_event_time;
    quizWaiting = false;
    document.querySelectorAll(".yesno-options button").forEach((b) => (b.disabled = true));
    showFeedback({
      correct: data.last_result === "correct",
      correct_answer: data.last_correct_answer,
      explanation: data.last_explanation,
    }, null);
  }
}

setInterval(refreshDashboardScore, 1000);

// startup

renderChips();
updateDashboardStats();
refreshMaterialStatus();
refreshProgress();
refreshDashboardScore();
