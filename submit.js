const form = document.getElementById("submission-form");
const message = document.getElementById("submission-message");
const qualityScore = document.getElementById("quality-score");
const qualityLevel = document.getElementById("quality-level");
const qualitySuggestions = document.getElementById("quality-suggestions");
const locationButton = document.getElementById("use-current-location");
const areaLocationButton = document.getElementById("use-area-location");
const submitSatelliteButton = document.getElementById("toggle-submit-satellite");
const locationStatus = document.getElementById("location-status");
const videoDropzone = document.getElementById("video-dropzone");
const videoPreviewBox = document.getElementById("video-preview-box");
const DEFAULT_CENTER = [13.9833, 108.0];
const MAX_VIDEO_UPLOAD_BYTES = 25 * 1024 * 1024;
let submitMap = null;
let submitMarker = null;
let submitStreetLayer = null;
let submitSatelliteLayer = null;
let submitAdminUnits = [];
let uploadedVideoUrl = "";
let videoUploadInProgress = false;

function text(formData, key) {
    return String(formData.get(key) || "").trim();
}

function number(formData, key) {
    const value = text(formData, key);
    return value === "" ? null : Number(value);
}

function normalizeSearchText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function setLocationStatus(textValue, type = "") {
    if (!locationStatus) return;
    locationStatus.className = `location-status ${type}`.trim();
    locationStatus.textContent = textValue;
}

function setCoordinates(lat, lng, options = {}) {
    const nextLat = Number(lat);
    const nextLng = Number(lng);
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return false;

    form.elements.latitude.value = nextLat.toFixed(6);
    form.elements.longitude.value = nextLng.toFixed(6);

    if (submitMap) {
        const point = [nextLat, nextLng];
        if (submitMarker) {
            submitMarker.setLatLng(point);
        } else {
            submitMarker = L.marker(point, { draggable: true }).addTo(submitMap);
            submitMarker.on("dragend", (event) => {
                const pos = event.target.getLatLng();
                setCoordinates(pos.lat, pos.lng, { moveMap: false, status: "Đã cập nhật vị trí sau khi kéo ghim." });
            });
        }
        if (options.moveMap !== false) {
            submitMap.setView(point, options.zoom || 17);
        }
    }

    setLocationStatus(options.status || "Đã ghim vị trí trên bản đồ.", "ok");
    updateQualityAdvisor();
    return true;
}

async function loadSubmitAdminUnits() {
    try {
        const response = await fetch("/data/gia-lai-units.json?v=2", { credentials: "same-origin" });
        if (!response.ok) throw new Error();
        const data = await response.json();
        submitAdminUnits = Array.isArray(data.units) ? data.units : [];
    } catch {
        submitAdminUnits = [];
    }
}

function findAdminUnitFromLocation(value) {
    const normalized = normalizeSearchText(value);
    if (!normalized) return null;
    return submitAdminUnits.find((unit) => {
        const tokens = [
            unit.name,
            unit.label,
            unit.oldText,
            unit.searchText,
            ...(Array.isArray(unit.aliases) ? unit.aliases : [])
        ].map(normalizeSearchText).filter(Boolean);
        return tokens.some((token) => normalized.includes(token) || token.includes(normalized));
    }) || null;
}

function pinByLocationText(showError = true) {
    const unit = findAdminUnitFromLocation(form.elements.location?.value || "");
    if (unit?.center?.length === 2) {
        setCoordinates(unit.center[0], unit.center[1], {
            zoom: 14,
            status: `Đã ghim tạm theo ${unit.label}. Có thể chạm bản đồ để chỉnh đúng thửa đất.`
        });
        return true;
    }
    if (showError) {
        setLocationStatus("Chưa tìm thấy khu vực này. Hãy bấm lấy vị trí hoặc chạm trực tiếp trên bản đồ.", "error");
    }
    return false;
}

function initSubmitMap() {
    const mapEl = document.getElementById("submit-map");
    if (!mapEl || typeof L === "undefined") return;

    submitMap = L.map(mapEl, { zoomControl: true }).setView(DEFAULT_CENTER, 12);
    submitStreetLayer = L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
        attribution: "&copy; CARTO"
    });
    submitSatelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Tiles &copy; Esri"
    });
    submitStreetLayer.addTo(submitMap);
    L.control.layers({ "Bản đồ": submitStreetLayer, "Vệ tinh": submitSatelliteLayer }, null, {
        position: "topright",
        collapsed: false
    }).addTo(submitMap);
    updateSubmitSatelliteButton();
    submitMap.on("baselayerchange", updateSubmitSatelliteButton);

    if (submitSatelliteButton) {
        submitSatelliteButton.addEventListener("click", () => {
            const isSatellite = submitMap.hasLayer(submitSatelliteLayer);
            if (isSatellite) {
                submitMap.removeLayer(submitSatelliteLayer);
                submitStreetLayer.addTo(submitMap);
            } else {
                submitMap.removeLayer(submitStreetLayer);
                submitSatelliteLayer.addTo(submitMap);
            }
            updateSubmitSatelliteButton();
        });
    }

    submitMap.on("click", (event) => {
        setCoordinates(event.latlng.lat, event.latlng.lng, {
            status: "Đã ghim vị trí theo điểm vừa chạm trên bản đồ."
        });
    });
}

function updateSubmitSatelliteButton() {
    if (!submitSatelliteButton || !submitMap || !submitSatelliteLayer) return;
    const isSatellite = submitMap.hasLayer(submitSatelliteLayer);
    submitSatelliteButton.classList.toggle("active", isSatellite);
    submitSatelliteButton.textContent = isSatellite ? "Bản đồ" : "Vệ tinh";
}

function imageFileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const img = new Image();
            img.onload = () => {
                const maxSize = 1200;
                const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                const canvas = document.createElement("canvas");
                canvas.width = Math.max(1, Math.round(img.width * scale));
                canvas.height = Math.max(1, Math.round(img.height * scale));
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.78));
            };
            img.onerror = () => reject(new Error("Không đọc được ảnh."));
            img.src = reader.result;
        };
        reader.onerror = () => reject(new Error("Không đọc được file ảnh."));
        reader.readAsDataURL(file);
    });
}

async function collectImages(formData) {
    const imagesText = text(formData, "imagesText");
    const images = imagesText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    const files = Array.from(formData.getAll("imageFiles")).filter((file) => file && file.size > 0).slice(0, 6);
    for (const file of files) {
        images.push(await imageFileToDataUrl(file));
    }
    return images;
}

function formatFileSize(bytes) {
    if (!bytes) return "0MB";
    return `${Math.round(bytes / 1024 / 1024 * 10) / 10}MB`;
}

function isSupportedVideoFile(file) {
    if (!file) return false;
    const name = String(file.name || "").toLowerCase();
    return String(file.type || "").startsWith("video/") || /\.(mp4|webm|mov|m4v)$/.test(name);
}

function clearUploadedVideoPreview(options = {}) {
    const clearInput = options.clearInput !== false;
    uploadedVideoUrl = "";
    if (videoPreviewBox) {
        videoPreviewBox.innerHTML = "";
        videoPreviewBox.hidden = true;
    }
    if (clearInput && form.elements.video) {
        form.elements.video.value = "";
    }
    updateQualityAdvisor();
}

function renderUploadedVideoPreview(file, url) {
    if (!videoPreviewBox) return;
    videoPreviewBox.innerHTML = "";
    videoPreviewBox.hidden = false;

    const video = document.createElement("video");
    video.src = url;
    video.controls = true;
    video.playsInline = true;
    video.preload = "metadata";

    const meta = document.createElement("div");
    meta.className = "video-preview-meta";

    const title = document.createElement("strong");
    title.textContent = file?.name || "Video đã tải lên";

    const size = document.createElement("span");
    size.textContent = `Đã tải lên ${formatFileSize(file?.size || 0)} / tối đa 25MB`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "video-remove";
    remove.textContent = "Gỡ video";
    remove.addEventListener("click", () => clearUploadedVideoPreview());

    meta.append(title, size, remove);
    videoPreviewBox.append(video, meta);
}

async function uploadVideoFile(file) {
    if (!file) return;
    if (!isSupportedVideoFile(file)) {
        throw new Error("Chỉ nhận video MP4, WebM, MOV hoặc M4V.");
    }
    if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
        throw new Error("Video quá lớn. Anh chọn file tối đa 25MB để khách mở nhanh trên điện thoại.");
    }

    videoUploadInProgress = true;
    message.className = "";
    message.textContent = `Đang tải video ${formatFileSize(file.size)}...`;

    const response = await fetch("/api/uploads/video", {
        method: "POST",
        headers: {
            "Content-Type": file.type || "application/octet-stream",
            "X-File-Name": encodeURIComponent(file.name || "video")
        },
        body: file
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.error || "Không tải được video.");
    }

    uploadedVideoUrl = data.url;
    if (form.elements.video) {
        form.elements.video.value = data.url;
    }
    renderUploadedVideoPreview(file, data.url);
    message.className = "ok";
    message.textContent = "Đã tải video lên. Khi gửi tin, quản trị sẽ duyệt cùng hình ảnh và nội dung.";
    updateQualityAdvisor();
}

function initVideoUpload() {
    if (!videoDropzone) return;
    const input = videoDropzone.querySelector('input[type="file"]');
    const chooseButton = document.getElementById("choose-video-file");
    if (!input) return;

    const pickFile = () => input.click();
    if (chooseButton) chooseButton.addEventListener("click", pickFile);
    videoDropzone.addEventListener("click", (event) => {
        if (event.target === chooseButton || event.target === input) return;
        pickFile();
    });
    videoDropzone.addEventListener("dragover", (event) => {
        event.preventDefault();
        videoDropzone.classList.add("drag-over");
    });
    videoDropzone.addEventListener("dragleave", () => videoDropzone.classList.remove("drag-over"));
    videoDropzone.addEventListener("drop", async (event) => {
        event.preventDefault();
        videoDropzone.classList.remove("drag-over");
        const file = event.dataTransfer.files?.[0];
        try {
            await uploadVideoFile(file);
        } catch (error) {
            message.className = "error";
            message.textContent = error.message;
        } finally {
            videoUploadInProgress = false;
        }
    });
    input.addEventListener("change", async () => {
        const file = input.files?.[0];
        try {
            await uploadVideoFile(file);
        } catch (error) {
            message.className = "error";
            message.textContent = error.message;
        } finally {
            videoUploadInProgress = false;
            input.value = "";
        }
    });

    if (form.elements.video) {
        form.elements.video.addEventListener("input", () => {
            if (uploadedVideoUrl && form.elements.video.value.trim() !== uploadedVideoUrl) {
                clearUploadedVideoPreview({ clearInput: false });
            }
        });
    }
}

function scoreListingQualityFromForm() {
    const formData = new FormData(form);
    const suggestions = [];
    let score = 0;
    const imagesText = text(formData, "imagesText");
    const imageCount = imagesText.split(/\r?\n/).filter((item) => item.trim()).length + Array.from(formData.getAll("imageFiles")).filter((file) => file && file.size > 0).length + (text(formData, "image") ? 1 : 0);

    if (text(formData, "title").length >= 20) score += 10;
    else suggestions.push("Tiêu đề nên nêu rõ loại tài sản, khu vực và điểm mạnh.");

    if (text(formData, "description").length >= 120) score += 15;
    else suggestions.push("Mô tả nên có vị trí, đường, pháp lý, hiện trạng và điểm mạnh.");

    if (imageCount >= 5) score += 18;
    else if (imageCount >= 3) score += 14;
    else if (imageCount >= 1) {
        score += 7;
        suggestions.push("Nên thêm 3-5 ảnh thật để tăng độ tin cậy.");
    } else {
        suggestions.push("Cần ít nhất một ảnh đại diện hoặc ảnh tải lên.");
    }

    if (number(formData, "latitude") && number(formData, "longitude")) score += 12;
    else suggestions.push("Chọn vị trí bằng nút lấy vị trí, ghim theo khu vực hoặc chạm bản đồ một lần.");

    if (number(formData, "price") > 0 && number(formData, "area") > 0) score += 12;
    else suggestions.push("Cần giá và diện tích để hệ thống tính giá/m2.");

    if (number(formData, "frontage") && number(formData, "depth") && number(formData, "roadWidth")) score += 10;
    else suggestions.push("Bổ sung ngang, dài và đường trước nhà.");

    if (text(formData, "legal") && text(formData, "landUse") && text(formData, "planningStatus")) score += 15;
    else suggestions.push("Bổ sung pháp lý, thổ cư và tình trạng quy hoạch.");

    if (text(formData, "video")) score += 8;
    else suggestions.push("Có video sẽ giúp khách xem trước nhanh hơn.");

    return {
        score: Math.min(100, score),
        level: score >= 85 ? "Tin tốt, đủ sức lên sàn." : score >= 65 ? "Tin khá, nên bổ sung thêm để dễ có khách." : "Tin còn yếu, cần bổ sung trước khi gửi.",
        suggestions: suggestions.slice(0, 5)
    };
}

function updateQualityAdvisor() {
    if (!qualityScore || !qualityLevel || !qualitySuggestions) return;
    const result = scoreListingQualityFromForm();
    qualityScore.textContent = result.score;
    qualityLevel.textContent = result.level;
    qualitySuggestions.innerHTML = result.suggestions.length
        ? result.suggestions.map((item) => `<li>${item}</li>`).join("")
        : "<li>Tin đã đủ thông tin cơ bản. Có thể gửi chờ duyệt.</li>";
}

form.addEventListener("input", updateQualityAdvisor);
form.addEventListener("change", updateQualityAdvisor);

if (locationButton) {
    locationButton.addEventListener("click", () => {
        if (!navigator.geolocation) {
            message.className = "error";
            message.textContent = "Trình duyệt này chưa hỗ trợ lấy vị trí.";
            return;
        }
        locationButton.disabled = true;
        locationButton.textContent = "Đang lấy vị trí...";
        navigator.geolocation.getCurrentPosition(
            (position) => {
                setCoordinates(position.coords.latitude, position.coords.longitude, {
                    status: "Đã ghim theo vị trí hiện tại của thiết bị."
                });
                message.className = "ok";
                message.textContent = "Đã lấy vị trí hiện tại. Anh kiểm tra lại trên bản đồ trước khi gửi.";
                locationButton.disabled = false;
                locationButton.textContent = "Lấy vị trí hiện tại";
            },
            () => {
                message.className = "error";
                message.textContent = "Không lấy được vị trí. Anh cho phép quyền vị trí hoặc nhập tọa độ thủ công.";
                locationButton.disabled = false;
                locationButton.textContent = "Lấy vị trí hiện tại";
            },
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
        );
    });
}

if (areaLocationButton) {
    areaLocationButton.addEventListener("click", async () => {
        if (!submitAdminUnits.length) await loadSubmitAdminUnits();
        pinByLocationText(true);
    });
}

if (form.elements.location) {
    let locationTimer;
    form.elements.location.addEventListener("input", () => {
        clearTimeout(locationTimer);
        locationTimer = setTimeout(() => {
            if (!form.elements.latitude.value && !form.elements.longitude.value) {
                pinByLocationText(false);
            }
        }, 350);
    });
    form.elements.location.addEventListener("change", () => pinByLocationText(false));
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const button = form.querySelector('button[type="submit"]');
    message.className = "";
    message.textContent = "Đang xử lý tin...";
    if (button) button.disabled = true;

    try {
        if (videoUploadInProgress) {
            throw new Error("Video đang tải lên. Anh chờ hoàn tất rồi gửi tin.");
        }
        const images = await collectImages(formData);
        const quality = scoreListingQualityFromForm();
        if (quality.score < 45) {
            throw new Error("Tin còn thiếu nhiều thông tin. Anh bổ sung theo gợi ý trước khi gửi để dễ được duyệt.");
        }
        const primaryImage = text(formData, "image") || images[0] || "";
        const latitude = number(formData, "latitude");
        const longitude = number(formData, "longitude");
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            setLocationStatus("Thiếu vị trí. Hãy bấm lấy vị trí, ghim theo khu vực hoặc chạm bản đồ một lần.", "error");
            throw new Error("Tin cần có vị trí trên bản đồ trước khi gửi.");
        }
        const payload = {
            contactName: text(formData, "contactName"),
            contactPhone: text(formData, "contactPhone"),
            contactNote: text(formData, "contactNote"),
            title: text(formData, "title"),
            location: text(formData, "location"),
            type: text(formData, "type"),
            price: number(formData, "price"),
            area: number(formData, "area"),
            frontage: number(formData, "frontage"),
            depth: number(formData, "depth"),
            roadWidth: number(formData, "roadWidth"),
            direction: text(formData, "direction"),
            beds: number(formData, "beds"),
            baths: number(formData, "baths"),
            legal: text(formData, "legal"),
            landUse: text(formData, "landUse"),
            planningStatus: text(formData, "planningStatus"),
            bankLoan: text(formData, "bankLoan"),
            description: text(formData, "description"),
            image: primaryImage,
            images,
            video: text(formData, "video"),
            coordinates: [latitude, longitude],
            mapSummary: text(formData, "location")
        };

        message.textContent = "Đang gửi tin...";
        const response = await fetch("/api/submissions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || "Không gửi được tin.");
        }
        form.reset();
        clearUploadedVideoPreview();
        if (submitMarker && submitMap) {
            submitMap.removeLayer(submitMarker);
            submitMarker = null;
            submitMap.setView(DEFAULT_CENTER, 12);
        }
        setLocationStatus("Chưa có vị trí. Hãy bấm lấy vị trí hoặc chạm bản đồ.", "");
        message.className = "ok";
        localStorage.setItem("ndv_member_phone", payload.contactPhone);
        if (data.submission.trackingCode) {
            localStorage.setItem("ndv_member_code", data.submission.trackingCode);
        }
        message.innerHTML = `Đã gửi tin chờ duyệt. Mã hồ sơ: <strong>${data.submission.trackingCode || data.submission.id}</strong>. <a href="/member.html">Vào khu thành viên</a>`;
    } catch (error) {
        message.className = "error";
        message.textContent = error.message;
    } finally {
        if (button) button.disabled = false;
    }
});

initSubmitMap();
initVideoUpload();
loadSubmitAdminUnits();
updateQualityAdvisor();

// ================== SUBMIT DROPZONE (GPT-style) ==================
(function initSubmitDropzone() {
    const dropzone = document.getElementById("submit-dropzone");
    const previewGrid = document.getElementById("submit-preview-grid");
    if (!dropzone || !previewGrid) return;

    const fileInput = dropzone.querySelector('input[type="file"]');
    const submitFiles = []; // { dataUrl }

    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("drag-over"); });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
    dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("drag-over");
        processFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener("change", () => {
        processFiles(fileInput.files);
        fileInput.value = "";
    });

    function processFiles(files) {
        const remain = 6 - submitFiles.length;
        Array.from(files).slice(0, remain).forEach((file) => {
            if (!file.type.startsWith("image/")) return;
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const maxSize = 1200;
                    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                    const canvas = document.createElement("canvas");
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL("image/jpeg", 0.78);
                    submitFiles.push({ dataUrl });
                    renderPreviews();
                    syncToForm();
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    function renderPreviews() {
        previewGrid.innerHTML = "";
        submitFiles.forEach((item, i) => {
            const div = document.createElement("div");
            div.className = `submit-preview-item ${i === 0 ? "is-cover" : ""}`;
            div.innerHTML = `
                <img src="${item.dataUrl}" alt="Ảnh ${i + 1}">
                <button type="button" class="preview-remove" onclick="window._removeSubmitImg(${i})">✕</button>
                ${i === 0 ? '<span class="preview-cover-badge">Ảnh bìa</span>' : ""}
            `;
            previewGrid.appendChild(div);
        });
    }

    function syncToForm() {
        // Write data URLs to imagesText textarea so collectImages picks them up
        const textarea = form.elements.imagesText;
        const urlLines = textarea.value.split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith("data:"));
        const dataUrls = submitFiles.map(f => f.dataUrl);
        textarea.value = [...urlLines, ...dataUrls].join("\n");
        // Set hidden image field
        if (form.elements.image) {
            form.elements.image.value = urlLines[0] || dataUrls[0] || "";
        }
        updateQualityAdvisor();
    }

    window._removeSubmitImg = function(index) {
        submitFiles.splice(index, 1);
        renderPreviews();
        syncToForm();
    };
})();
