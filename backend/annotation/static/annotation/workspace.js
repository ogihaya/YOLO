(function () {
  const root = document.body;
  const datasetSlug = root?.dataset.datasetSlug || "train";
  const exportFilename =
    root?.dataset.exportFilename || `${datasetSlug || "dataset"}.zip`;
  const datasetName = root?.dataset.datasetName || datasetSlug;

  const state = {
    classes: [],
    images: [],
    selectedClassId: null,
    selectedImageId: null,
    activeBoxId: null,
  };

  const dropZone = document.getElementById("dropZone");
  const fileInput = document.getElementById("fileInput");
  const classListEl = document.getElementById("classList");
  const classForm = document.getElementById("classForm");
  const imageListEl = document.getElementById("imageList");
  const imageCountEl = document.getElementById("imageCount");
  const stagePlaceholder = document.getElementById("stagePlaceholder");
  const stageWrapper = document.getElementById("stageWrapper");
  const stage = document.getElementById("stage");
  const stageImage = document.getElementById("stageImage");
  const boxesLayer = document.getElementById("boxesLayer");
  const drawingGuide = document.getElementById("drawingGuide");
  const annotationListEl = document.getElementById("annotationList");
  const currentImageName = document.getElementById("currentImageName");
  const stageNotice = document.getElementById("stageNotice");
  const exportButton = document.getElementById("exportButton");
  const exportDialog = document.getElementById("exportDialog");

  let noticeTimer = null;
  let drawingState = null;

  const clamp = (value, min = 0, max = 1) =>
    Math.min(Math.max(value, min), max);

  const formatPercent = (value) =>
    (value * 100).toFixed(1).replace(/\.0$/, "");

  const getSelectedImage = () =>
    state.images.find((img) => img.id === state.selectedImageId) || null;

  const getClassById = (id) => state.classes.find((cls) => cls.id === id);

  function showNotice(message) {
    if (!stageNotice) return;
    stageNotice.textContent = message;
    stageNotice.classList.remove("hidden");
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => {
      stageNotice.classList.add("hidden");
    }, 2500);
  }

  function clearNotice() {
    clearTimeout(noticeTimer);
    stageNotice?.classList.add("hidden");
  }

  function renderClasses() {
    classListEl.innerHTML = "";
    if (state.classes.length === 0) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "クラスを追加してください。";
      classListEl.appendChild(empty);
      return;
    }
    const fragment = document.createDocumentFragment();
    state.classes.forEach((cls, index) => {
      const usage = state.images.reduce((count, img) => {
        return (
          count + img.annotations.filter((ann) => ann.classId === cls.id).length
        );
      }, 0);
      const item = document.createElement("div");
      item.className = "class-item";
      if (cls.id === state.selectedClassId) {
        item.classList.add("is-selected");
      }
      item.tabIndex = 0;
      item.dataset.classId = cls.id;
      item.innerHTML = `
        <span class="swatch" style="background:${cls.color}"></span>
        <div>
          <strong>${cls.name}</strong>
          <div class="muted">ID ${index}</div>
        </div>
        <span class="muted">${usage}</span>
      `;
      item.addEventListener("click", () => {
        state.selectedClassId = cls.id;
        clearNotice();
        renderClasses();
      });
      item.addEventListener("keydown", (evt) => {
        if (evt.key === "Enter" || evt.key === " ") {
          evt.preventDefault();
          item.click();
        }
      });
      fragment.appendChild(item);
    });
    classListEl.appendChild(fragment);
  }

  function renderImages() {
    imageListEl.innerHTML = "";
    imageCountEl.textContent = `${state.images.length} 枚`;
    if (state.images.length === 0) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "まだ画像がインポートされていません。";
      imageListEl.appendChild(empty);
      stagePlaceholder.classList.remove("hidden");
      stageWrapper.classList.add("hidden");
      return;
    }
    const fragment = document.createDocumentFragment();
    state.images.forEach((img) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "thumb";
      if (img.id === state.selectedImageId) {
        button.classList.add("is-selected");
      }
      const previews = document.createElement("img");
      previews.src = img.src;
      previews.alt = img.name;
      const caption = document.createElement("span");
      caption.textContent = `${img.name} (${img.annotations.length})`;
      button.append(previews, caption);
      button.addEventListener("click", () => {
        state.selectedImageId = img.id;
        state.activeBoxId = null;
        renderImages();
        renderStage();
      });
      fragment.appendChild(button);
    });
    imageListEl.appendChild(fragment);
  }

  function renderStage() {
    const image = getSelectedImage();
    if (!image) {
      stagePlaceholder.classList.remove("hidden");
      stageWrapper.classList.add("hidden");
      currentImageName.textContent = "-";
      annotationListEl.innerHTML =
        '<p class="hint">矩形はまだありません。</p>';
      return;
    }

    stagePlaceholder.classList.add("hidden");
    stageWrapper.classList.remove("hidden");
    stageImage.src = image.src;
    stageImage.alt = image.name;
    currentImageName.textContent = image.name;

    renderBoxes(image);
    renderAnnotationList(image);
  }

  function renderBoxes(image) {
    boxesLayer.innerHTML = "";
    if (!image.annotations.length) return;
    const fragment = document.createDocumentFragment();
    image.annotations.forEach((ann) => {
      const cls = getClassById(ann.classId);
      if (!cls) return;
      const box = document.createElement("div");
      box.className = "box";
      if (ann.id === state.activeBoxId) {
        box.classList.add("is-active");
      }
      box.style.borderColor = cls.color;
      box.style.left = `${ann.x * 100}%`;
      box.style.top = `${ann.y * 100}%`;
      box.style.width = `${ann.width * 100}%`;
      box.style.height = `${ann.height * 100}%`;
      box.dataset.boxId = ann.id;
      const label = document.createElement("div");
      label.className = "box-label";
      label.style.backgroundColor = cls.color;
      label.textContent = cls.name;
      box.appendChild(label);
      box.addEventListener("click", (evt) => {
        evt.stopPropagation();
        state.activeBoxId = ann.id;
        renderStage();
      });
      fragment.appendChild(box);
    });
    boxesLayer.appendChild(fragment);
  }

  function renderAnnotationList(image) {
    annotationListEl.innerHTML = "";
    if (image.annotations.length === 0) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "この画像にはまだ矩形がありません。";
      annotationListEl.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    image.annotations.forEach((ann) => {
      const cls = getClassById(ann.classId);
      const card = document.createElement("div");
      card.className = "annotation-card";
      if (ann.id === state.activeBoxId) {
        card.classList.add("is-active");
      }

      const header = document.createElement("div");
      header.className = "class-info";
      const swatch = document.createElement("span");
      swatch.className = "swatch";
      swatch.style.backgroundColor = cls?.color ?? "#999";
      const title = document.createElement("strong");
      title.textContent = cls ? cls.name : "未定義";
      header.append(swatch, title);
      card.appendChild(header);

      ["x", "y", "width", "height"].forEach((key) => {
        const label = document.createElement("label");
        label.textContent = key.toUpperCase();
        const input = document.createElement("input");
        input.type = "number";
        input.min = 0;
        input.max = 100;
        input.step = "0.1";
        input.value = formatPercent(ann[key]);
        input.addEventListener("change", (evt) => {
          const percent = parseFloat(evt.target.value);
          if (Number.isNaN(percent)) return;
          ann[key] = clamp(percent / 100, 0, 1);
          normalizeAnnotation(ann);
          renderStage();
        });
        label.appendChild(input);
        card.appendChild(label);
      });

      const del = document.createElement("button");
      del.type = "button";
      del.setAttribute("aria-label", "矩形を削除");
      del.textContent = "削除";
      del.addEventListener("click", () => {
        image.annotations = image.annotations.filter(
          (item) => item.id !== ann.id,
        );
        if (state.activeBoxId === ann.id) {
          state.activeBoxId = null;
        }
        renderStage();
        renderImages();
      });
      card.appendChild(del);

      fragment.appendChild(card);
    });
    annotationListEl.appendChild(fragment);
  }

  function handleFiles(files) {
    const validFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (!validFiles.length) {
      showNotice("画像ファイルのみ対応しています。");
      return;
    }
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const image = new Image();
        image.onload = () => {
          const record = {
            id: crypto.randomUUID(),
            name: file.name,
            src: event.target?.result,
            width: image.width,
            height: image.height,
            file,
            annotations: [],
          };
          state.images.push(record);
          if (!state.selectedImageId) {
            state.selectedImageId = record.id;
          }
          renderImages();
          renderStage();
        };
        image.src = String(event.target?.result);
      };
      reader.readAsDataURL(file);
    });
  }

  dropZone.addEventListener("click", () => fileInput.click());
  dropZone.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter" || evt.key === " ") {
      evt.preventDefault();
      fileInput.click();
    }
  });
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (evt) => {
      evt.preventDefault();
      dropZone.classList.add("is-active");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (evt) => {
      evt.preventDefault();
      dropZone.classList.remove("is-active");
    });
  });
  dropZone.addEventListener("drop", (evt) => {
    handleFiles(evt.dataTransfer?.files ?? []);
  });
  fileInput.addEventListener("change", (evt) => {
    handleFiles(evt.target?.files ?? []);
    fileInput.value = "";
  });

  classForm.addEventListener("submit", (evt) => {
    evt.preventDefault();
    const data = new FormData(classForm);
    const name = data.get("className")?.toString().trim();
    const color = data.get("classColor")?.toString();
    if (!name || !color) return;
    const record = {
      id: crypto.randomUUID(),
      name,
      color,
    };
    state.classes.push(record);
    state.selectedClassId = record.id;
    classForm.reset();
    const colorInput = classForm.querySelector('input[name="classColor"]');
    if (colorInput) colorInput.value = "#ff6b6b";
    renderClasses();
  });

  function getRelativePosition(event) {
    const rect = stage.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    return { x: clamp(x), y: clamp(y) };
  }

  function startDrawing(event) {
    if (event.button !== 0) return;
    const image = getSelectedImage();
    if (!image) return;
    if (!state.selectedClassId) {
      showNotice("クラスを選択してください。");
      return;
    }
    const { x, y } = getRelativePosition(event);
    drawingState = {
      startX: x,
      startY: y,
      pointerId: event.pointerId,
    };
    drawingGuide.classList.remove("hidden");
    updateGuide(x, y, 0, 0);
    stage.setPointerCapture(event.pointerId);
  }

  function updateGuide(x, y, width, height) {
    drawingGuide.style.left = `${x * 100}%`;
    drawingGuide.style.top = `${y * 100}%`;
    drawingGuide.style.width = `${width * 100}%`;
    drawingGuide.style.height = `${height * 100}%`;
  }

  function updateDrawing(event) {
    if (!drawingState) return;
    const pos = getRelativePosition(event);
    const x = Math.min(drawingState.startX, pos.x);
    const y = Math.min(drawingState.startY, pos.y);
    const width = Math.abs(pos.x - drawingState.startX);
    const height = Math.abs(pos.y - drawingState.startY);
    updateGuide(x, y, width, height);
    drawingState.current = { x, y, width, height };
  }

  function finishDrawing(event) {
    if (!drawingState) return;
    if (event.pointerId && stage.hasPointerCapture(event.pointerId)) {
      stage.releasePointerCapture(event.pointerId);
    }
    drawingGuide.classList.add("hidden");
    const image = getSelectedImage();
    if (!image || !drawingState.current) {
      drawingState = null;
      return;
    }
    const { x, y, width, height } = drawingState.current;
    drawingState = null;
    if (width < 0.01 || height < 0.01) {
      showNotice("矩形が小さすぎます。");
      return;
    }
    const ann = {
      id: crypto.randomUUID(),
      classId: state.selectedClassId,
      x,
      y,
      width,
      height,
    };
    normalizeAnnotation(ann);
    image.annotations.push(ann);
    state.activeBoxId = ann.id;
    renderStage();
    renderImages();
  }

  function normalizeAnnotation(ann) {
    ann.x = clamp(ann.x, 0, 1);
    ann.y = clamp(ann.y, 0, 1);
    ann.width = clamp(ann.width, 0, 1 - ann.x);
    ann.height = clamp(ann.height, 0, 1 - ann.y);
  }

  stage.addEventListener("pointerdown", startDrawing);
  stage.addEventListener("pointermove", updateDrawing);
  stage.addEventListener("pointerup", finishDrawing);
  stage.addEventListener("pointerleave", finishDrawing);

  exportButton.addEventListener("click", () => {
    if (typeof exportDialog?.showModal === "function") {
      exportDialog.showModal();
    } else if (window.confirm(`${exportFilename} をエクスポートしますか？`)) {
      exportDataset();
    }
  });

  exportDialog?.addEventListener("close", () => {
    if (exportDialog.returnValue === "export") {
      exportDataset();
    }
  });

  async function exportDataset() {
    if (!state.images.length) {
      showNotice("画像をインポートしてください。");
      return;
    }
    if (!state.classes.length) {
      showNotice("クラスが必要です。");
      return;
    }
    if (typeof JSZip === "undefined") {
      window.alert("JSZip の読み込みに失敗しました。");
      return;
    }
    const slug = datasetSlug || "dataset";
    const zip = new JSZip();
    const imageFolder = zip.folder(`${slug}/images`);
    const labelFolder = zip.folder(`${slug}/labels`);
    const classIndex = new Map();
    state.classes.forEach((cls, index) => {
      classIndex.set(cls.id, index);
    });
    for (const image of state.images) {
      if (!imageFolder || !labelFolder) continue;
      const buffer = await image.file.arrayBuffer();
      imageFolder.file(image.name, buffer);
      const labelLines = image.annotations
        .map((ann) => {
          const clsIdx = classIndex.get(ann.classId);
          if (clsIdx === undefined) {
            return null;
          }
          const centerX = ann.x + ann.width / 2;
          const centerY = ann.y + ann.height / 2;
          const width = ann.width;
          const height = ann.height;
          const values = [clsIdx, centerX, centerY, width, height].map((val) =>
            Number(val).toFixed(6),
          );
          return values.join(" ");
        })
        .filter(Boolean)
        .join("\n");
      const labelName = image.name.replace(/\.[^.]+$/, ".txt");
      labelFolder.file(labelName, labelLines);
    }
    const blob = await zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFilename || `${slug}.zip`;
    link.dataset.download = `${datasetName}-annotation`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  renderClasses();
  renderImages();
})();
