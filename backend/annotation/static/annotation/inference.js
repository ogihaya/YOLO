(function () {
  const state = {
    modelFile: null,
    images: [],
    predictions: new Map(),
    running: false,
  };

  const modelDropZone = document.getElementById("modelDropZone");
  const modelInput = document.getElementById("modelInput");
  const modelMeta = document.getElementById("modelMeta");
  const imageDropZone = document.getElementById("imageDropZone");
  const imageInput = document.getElementById("imageInput");
  const imageList = document.getElementById("imageList");
  const runButton = document.getElementById("runButton");
  const inferenceStatus = document.getElementById("inferenceStatus");
  const resultsContainer = document.getElementById("resultsContainer");

  const palette = [
    "#ef4444",
    "#22c55e",
    "#3b82f6",
    "#eab308",
    "#ec4899",
    "#8b5cf6",
    "#14b8a6",
    "#f97316",
  ];

  function getCsrfToken() {
    const value = document.cookie
      .split(";")
      .map((c) => c.trim())
      .find((item) => item.startsWith("csrftoken="));
    return value ? decodeURIComponent(value.split("=")[1]) : "";
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return "-";
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  function updateModelMeta() {
    if (!state.modelFile) {
      modelMeta.textContent = "未選択";
      return;
    }
    modelMeta.textContent = `${state.modelFile.name} (${formatBytes(
      state.modelFile.size,
    )})`;
  }

  function updateRunButton() {
    runButton.disabled =
      !state.modelFile || state.images.length === 0 || state.running;
  }

  function setStatus(message, variant = "default") {
    inferenceStatus.textContent = message;
    inferenceStatus.className = "count-pill";
    if (variant === "info") inferenceStatus.classList.add("pill-info");
    if (variant === "danger") inferenceStatus.classList.add("pill-danger");
    if (variant === "success") inferenceStatus.classList.add("pill-success");
  }

  function handleModelFiles(files) {
    if (!files.length) return;
    const file = files[0];
    if (!file.name.endsWith(".pt")) {
      alert(".pt ファイルのみアップロードできます。");
      return;
    }
    state.modelFile = file;
    updateModelMeta();
    updateRunButton();
  }

  function handleImageFiles(files) {
    const valid = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (!valid.length) {
      alert("画像ファイルのみ対応しています。");
      return;
    }
    valid.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        state.images.push({
          id: crypto.randomUUID(),
          file,
          name: file.name,
          size: file.size,
          type: file.type,
          src: event.target?.result,
        });
        renderImageList();
        updateRunButton();
      };
      reader.readAsDataURL(file);
    });
  }

  function removeImage(id) {
    state.images = state.images.filter((img) => img.id !== id);
    state.predictions.delete(id);
    renderImageList();
    renderResults();
    updateRunButton();
  }

  function renderImageList() {
    imageList.innerHTML = "";
    if (!state.images.length) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "まだ画像がありません。";
      imageList.appendChild(empty);
      return;
    }
    state.images.forEach((image) => {
      const card = document.createElement("div");
      card.className = "image-card";
      card.innerHTML = `
        <img src="${image.src}" alt="${image.name}" />
        <div class="image-card-meta">
          <strong>${image.name}</strong>
          <span>${formatBytes(image.size)}</span>
        </div>
      `;
      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "ghost-button";
      removeBtn.textContent = "削除";
      removeBtn.addEventListener("click", () => removeImage(image.id));
      card.appendChild(removeBtn);
      imageList.appendChild(card);
    });
  }

  async function runInference() {
    if (!state.modelFile || !state.images.length) return;
    state.running = true;
    state.predictions.clear();
    updateRunButton();
    runButton.textContent = "推論中...";
    setStatus("推論中...", "info");
    resultsContainer.innerHTML =
      '<p class="hint">サーバーで推論を実行しています…</p>';

    const formData = new FormData();
    formData.append("model", state.modelFile, state.modelFile.name);
    state.images.forEach((image) => {
      formData.append("images", image.file, image.name);
      formData.append("image_ids", image.id);
    });

    try {
      const response = await fetch("/api/inference/run/", {
        method: "POST",
        headers: {
          "X-CSRFToken": getCsrfToken(),
        },
        body: formData,
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "推論に失敗しました。");
      }
      const payload = await response.json();
      payload.results.forEach((result) => {
        state.predictions.set(result.image_id, result);
      });
      setStatus(
        `${payload.results.length} 枚を推論 (${payload.model_filename})`,
        "success",
      );
      renderResults();
    } catch (error) {
      console.error(error);
      resultsContainer.innerHTML = "";
      setStatus(error.message, "danger");
      const message = document.createElement("p");
      message.className = "hint";
      message.textContent = error.message;
      resultsContainer.appendChild(message);
    } finally {
      state.running = false;
      runButton.textContent = "推論開始";
      updateRunButton();
    }
  }

  function renderResults() {
    resultsContainer.innerHTML = "";
    if (!state.predictions.size) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "結果はまだありません。";
      resultsContainer.appendChild(empty);
      return;
    }

    state.images.forEach((image) => {
      const prediction = state.predictions.get(image.id);
      if (!prediction) return;
      const card = document.createElement("article");
      card.className = "result-card";

      const header = document.createElement("div");
      header.className = "result-card-header";
      header.innerHTML = `
        <div>
          <strong>${image.name}</strong>
          <p class="hint">${prediction.width}×${prediction.height}</p>
        </div>
      `;
      const saveBtn = document.createElement("button");
      saveBtn.type = "button";
      saveBtn.className = "ghost-button";
      saveBtn.textContent = "結果画像を保存";
      saveBtn.addEventListener("click", () => downloadResult(image.id));
      header.appendChild(saveBtn);
      card.appendChild(header);

      const stage = document.createElement("div");
      stage.className = "result-stage";
      const img = document.createElement("img");
      img.src = image.src;
      img.alt = image.name;
      stage.appendChild(img);

      const boxesLayer = document.createElement("div");
      boxesLayer.className = "boxes-layer";
      prediction.boxes.forEach((box) => {
        const color = palette[box.class_id % palette.length];
        const div = document.createElement("div");
        div.className = "box";
        div.style.borderColor = color;
        div.style.left = `${box.x * 100}%`;
        div.style.top = `${box.y * 100}%`;
        div.style.width = `${box.width * 100}%`;
        div.style.height = `${box.height * 100}%`;
        const label = document.createElement("div");
        label.className = "box-label";
        label.style.backgroundColor = color;
        label.textContent = `${box.class_name} (${box.score})`;
        div.appendChild(label);
        boxesLayer.appendChild(div);
      });
      stage.appendChild(boxesLayer);
      card.appendChild(stage);

      const detections = document.createElement("div");
      detections.className = "result-detections";
      prediction.boxes.forEach((box, index) => {
        const color = palette[box.class_id % palette.length];
        const row = document.createElement("div");
        row.className = "detection-row";
        row.innerHTML = `
          <span class="swatch" style="background:${color}"></span>
          <strong>${box.class_name}</strong>
          <span class="muted">score ${box.score}</span>
          <span class="muted">(${(box.x * 100).toFixed(1)}%, ${(box.y * 100).toFixed(1)}%)</span>
        `;
        detections.appendChild(row);
      });
      card.appendChild(detections);

      resultsContainer.appendChild(card);
    });
  }

  function downloadResult(imageId) {
    const prediction = state.predictions.get(imageId);
    const image = state.images.find((img) => img.id === imageId);
    if (!prediction || !image) return;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const base = new Image();
    base.onload = () => {
      canvas.width = base.naturalWidth;
      canvas.height = base.naturalHeight;
      ctx.drawImage(base, 0, 0);
      prediction.boxes.forEach((box) => {
        const color = palette[box.class_id % palette.length];
        const x = box.x * canvas.width;
        const y = box.y * canvas.height;
        const width = box.width * canvas.width;
        const height = box.height * canvas.height;
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.strokeRect(x, y, width, height);
        ctx.fillStyle = color;
        ctx.font = "bold 24px sans-serif";
        ctx.fillText(`${box.class_name} (${box.score})`, x + 4, y + 24);
      });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `${image.name.replace(/\.[^.]+$/, "")}_result.png`;
      link.click();
    };
    base.src = image.src;
  }

  function attachDropHandlers(zone, handler, input) {
    zone.addEventListener("click", () => input.click());
    zone.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter" || evt.key === " ") {
        evt.preventDefault();
        input.click();
      }
    });
    ["dragenter", "dragover"].forEach((eventName) => {
      zone.addEventListener(eventName, (evt) => {
        evt.preventDefault();
        zone.classList.add("is-active");
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      zone.addEventListener(eventName, (evt) => {
        evt.preventDefault();
        zone.classList.remove("is-active");
      });
    });
    zone.addEventListener("drop", (evt) => {
      handler(evt.dataTransfer?.files ?? []);
    });
    input.addEventListener("change", (evt) => {
      handler(evt.target?.files ?? []);
      input.value = "";
    });
  }

  attachDropHandlers(modelDropZone, handleModelFiles, modelInput);
  attachDropHandlers(imageDropZone, handleImageFiles, imageInput);
  runButton.addEventListener("click", runInference);
})();
