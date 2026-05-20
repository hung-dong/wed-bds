const state = {
    phone: "",
    code: "",
    member: null,
    statusFilter: "all",
    submissions: [],
    leads: []
};

const el = {
    form: document.getElementById("member-search-form"),
    phone: document.getElementById("member-phone"),
    code: document.getElementById("member-code"),
    message: document.getElementById("member-message"),
    dashboard: document.getElementById("member-dashboard"),
    submissions: document.getElementById("member-submissions"),
    leads: document.getElementById("member-leads"),
    kpiTotal: document.getElementById("kpi-total"),
    kpiPending: document.getElementById("kpi-pending"),
    kpiApproved: document.getElementById("kpi-approved"),
    kpiLeads: document.getElementById("kpi-leads"),
    kpiViews: document.getElementById("kpi-views"),
    kpiContact: document.getElementById("kpi-contact"),
    editTemplate: document.getElementById("edit-template"),
    summary: document.getElementById("member-summary"),
    statusFilter: document.getElementById("member-status-filter"),
    refresh: document.getElementById("member-refresh"),
    clearSession: document.getElementById("member-clear-session")
};

const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=600&q=80";

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
    return escapeHTML(value).replace(/'/g, "&#39;");
}

function statusLabel(status) {
    if (status === "APPROVED") return "Đã lên sàn";
    if (status === "REJECTED") return "Từ chối";
    return "Chờ duyệt";
}

function statusClass(status) {
    if (status === "APPROVED") return "approved";
    if (status === "REJECTED") return "rejected";
    return "pending";
}

function leadStatusLabel(status) {
    const map = {
        NEW: "Khách mới",
        CONTACTED: "Đã gọi",
        VIEWING: "Hẹn xem",
        NEGOTIATING: "Đàm phán",
        CLOSED: "Đã chốt",
        LOST: "Không phù hợp"
    };
    return map[status] || "Khách mới";
}

async function request(url, options = {}) {
    const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        ...options
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Yêu cầu thất bại.");
    return data;
}

async function loadMember() {
    state.phone = el.phone.value.trim();
    state.code = el.code.value.trim();
    el.message.className = "";
    if (!state.phone && !state.code) {
        el.dashboard.classList.add("hidden");
        el.message.className = "error";
        el.message.textContent = "Anh nhập số điện thoại đã đăng tin hoặc mã hồ sơ để vào khu thành viên.";
        return;
    }
    el.message.textContent = "Đang tải dữ liệu thành viên...";

    const params = new URLSearchParams();
    if (state.phone) params.set("phone", state.phone);
    if (state.code) params.set("code", state.code);
    const data = await request(`/api/member/submissions?${params.toString()}`);
    state.member = data.member || null;
    state.submissions = data.submissions || [];
    state.leads = data.leads || [];
    localStorage.setItem("ndv_member_phone", state.phone);
    if (state.code) localStorage.setItem("ndv_member_code", state.code);
    renderDashboard();
    el.message.className = "ok";
    el.message.textContent = state.submissions.length ? "Đã tải khu thành viên." : "Chưa có hồ sơ nào khớp thông tin này.";
}

function renderDashboard() {
    el.dashboard.classList.remove("hidden");
    const pending = state.submissions.filter((item) => item.status === "PENDING").length;
    const approved = state.submissions.filter((item) => item.status === "APPROVED").length;
    el.kpiTotal.textContent = state.submissions.length;
    el.kpiPending.textContent = pending;
    el.kpiApproved.textContent = approved;
    el.kpiLeads.textContent = state.leads.length;
    const totals = state.submissions.reduce((acc, item) => {
        const metric = item.metrics || {};
        acc.views += Number(metric.views || 0);
        acc.contact += Number(metric.calls || 0) + Number(metric.zalo || 0);
        return acc;
    }, { views: 0, contact: 0 });
    if (el.kpiViews) el.kpiViews.textContent = totals.views;
    if (el.kpiContact) el.kpiContact.textContent = totals.contact;
    renderMemberSummary();
    renderSubmissions();
    renderLeads();
}

function renderMemberSummary() {
    if (!el.summary) return;
    const phone = state.phone || state.member?.phone || "Chưa có số";
    const code = state.code ? ` • Mã ${state.code}` : "";
    el.summary.textContent = `${phone}${code} • ${state.submissions.length} hồ sơ • ${state.leads.length} khách hỏi tin`;
}

function renderSubmissions() {
    el.submissions.innerHTML = "";
    const visibleSubmissions = state.statusFilter === "all"
        ? state.submissions
        : state.submissions.filter((item) => item.status === state.statusFilter);
    if (!state.submissions.length) {
        el.submissions.innerHTML = '<p>Chưa có tin nào. Anh có thể bấm “Đăng thêm tin” để gửi hồ sơ mới.</p>';
        return;
    }
    if (!visibleSubmissions.length) {
        el.submissions.innerHTML = '<p>Không có hồ sơ nào trong trạng thái đang lọc.</p>';
        return;
    }

    visibleSubmissions.forEach((submission) => {
        const listing = submission.listing || {};
        const cover = listing.image || listing.images?.[0] || FALLBACK_IMAGE;
        const created = submission.createdAt ? new Date(submission.createdAt).toLocaleString("vi-VN") : "";
        const quality = submission.quality || { score: 0, level: "Cần bổ sung", suggestions: [] };
        const metrics = submission.metrics || {};
        const contactClicks = Number(metrics.calls || 0) + Number(metrics.zalo || 0);
        const suggestions = Array.isArray(quality.suggestions) ? quality.suggestions.slice(0, 3) : [];
        const suggestionHtml = suggestions.length
            ? `<ul class="smart-suggestions">${suggestions.map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>`
            : "";
        const card = document.createElement("article");
        card.className = "member-card";
        card.dataset.submissionId = submission.id;
        card.innerHTML = `
            <img class="member-thumb" src="${escapeAttr(cover)}" alt="${escapeAttr(listing.title || "Tin nhà đất")}">
            <div>
                <div class="card-top">
                    <span class="status ${statusClass(submission.status)}">${statusLabel(submission.status)}</span>
                    <p class="tracking">Mã hồ sơ: <strong>${escapeHTML(submission.trackingCode || submission.id)}</strong></p>
                </div>
                <h3>${escapeHTML(listing.title || "Tin chưa có tiêu đề")}</h3>
                <p class="meta">${escapeHTML(listing.location || "")} • ${escapeHTML(listing.type || "")} • ${listing.price || 0} tỷ • ${listing.area || 0} m2</p>
                <p class="meta">Gửi lúc ${created}${submission.reviewedAt ? ` • xử lý ${new Date(submission.reviewedAt).toLocaleString("vi-VN")}` : ""}</p>
                <div class="smart-report">
                    <span>Chất lượng ${Number(quality.score || 0)}/100</span>
                    <span>${escapeHTML(quality.level || "Đang phân tích")}</span>
                    <span>${Number(metrics.views || 0)} xem</span>
                    <span>${Number(metrics.leads || 0)} khách hỏi</span>
                    <span>${contactClicks} gọi/Zalo</span>
                </div>
                ${suggestionHtml}
                ${submission.status === "REJECTED" ? `<p class="meta">Lý do: ${escapeHTML(submission.reviewNote || "Quản trị từ chối, cần liên hệ để bổ sung.")}</p>` : ""}
                <div class="card-actions">
                    ${submission.status === "PENDING" ? '<button type="button" data-action="edit">Sửa tin chờ duyệt</button>' : ""}
                    ${submission.listingId ? `<a class="primary" href="/#${encodeURIComponent(submission.listingId)}">Xem tin trên bản đồ</a>` : ""}
                </div>
            </div>
        `;
        const editButton = card.querySelector('[data-action="edit"]');
        if (editButton) editButton.addEventListener("click", () => showEditForm(card, submission));
        const actions = card.querySelector(".card-actions");
        if (actions) {
            const copyButton = document.createElement("button");
            copyButton.type = "button";
            copyButton.textContent = "Sao chép mã hồ sơ";
            copyButton.addEventListener("click", async () => {
                const code = submission.trackingCode || submission.id;
                try {
                    await navigator.clipboard.writeText(code);
                    copyButton.textContent = "Đã sao chép";
                } catch {
                    window.prompt("Mã hồ sơ", code);
                }
            });
            actions.appendChild(copyButton);

            if (submission.contact?.phone) {
                const phoneLink = document.createElement("a");
                phoneLink.href = `tel:${submission.contact.phone}`;
                phoneLink.textContent = "Gọi người đăng";
                actions.appendChild(phoneLink);
            }
        }
        el.submissions.appendChild(card);
    });
}

function renderLeads() {
    el.leads.innerHTML = "";
    if (!state.leads.length) {
        el.leads.innerHTML = '<p>Chưa có khách hỏi các tin đã được duyệt.</p>';
        return;
    }

    state.leads.forEach((lead) => {
        const created = lead.createdAt ? new Date(lead.createdAt).toLocaleString("vi-VN") : "";
        const card = document.createElement("article");
        card.className = "lead-card";
        card.innerHTML = `
            <div>
                <span class="lead-status">${leadStatusLabel(lead.status)}</span>
                <h3>${escapeHTML(lead.name || "Khách chưa rõ tên")}</h3>
                <p>${escapeHTML(lead.phone || "")} • ${created}</p>
                <p>${escapeHTML(lead.need || "Chưa ghi nhu cầu cụ thể.")}</p>
                <p>${escapeHTML(lead.listingTitle || "Tin chưa xác định")}</p>
            </div>
            <a class="button" href="tel:${escapeHTML(lead.phone || "")}">Gọi khách</a>
        `;
        el.leads.appendChild(card);
    });
}

function imageFileToCompressedDataUrl(file) {
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
                canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg", 0.8));
            };
            img.onerror = () => reject(new Error("Không đọc được ảnh."));
            img.src = reader.result;
        };
        reader.onerror = () => reject(new Error("Không đọc được file ảnh."));
        reader.readAsDataURL(file);
    });
}

function setupMemberImageTool(form) {
    const button = form.querySelector(".member-attach-image");
    const fileInput = form.elements.imageFile;
    const imageInput = form.elements.image;
    const preview = form.querySelector(".member-image-preview");
    if (!button || !fileInput || !imageInput || !preview) return;

    const syncPreview = () => {
        preview.src = imageInput.value || FALLBACK_IMAGE;
        preview.classList.toggle("has-image", Boolean(imageInput.value));
    };

    button.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0];
        if (!file || !file.type.startsWith("image/")) return;
        button.disabled = true;
        button.textContent = "Đang nén ảnh...";
        try {
            imageInput.value = await imageFileToCompressedDataUrl(file);
            syncPreview();
        } catch (error) {
            window.alert(error.message);
        } finally {
            fileInput.value = "";
            button.disabled = false;
            button.textContent = "+ Thêm ảnh";
        }
    });
    syncPreview();
}

function fillEditForm(form, submission) {
    const listing = submission.listing || {};
    form.elements.title.value = listing.title || "";
    form.elements.location.value = listing.location || "";
    form.elements.type.value = listing.type || "";
    form.elements.price.value = listing.price ?? "";
    form.elements.area.value = listing.area ?? "";
    form.elements.frontage.value = listing.frontage ?? "";
    form.elements.depth.value = listing.depth ?? "";
    form.elements.roadWidth.value = listing.roadWidth ?? "";
    form.elements.beds.value = listing.beds ?? 0;
    form.elements.baths.value = listing.baths ?? 0;
    form.elements.latitude.value = listing.coordinates?.[0] ?? 13.9833;
    form.elements.longitude.value = listing.coordinates?.[1] ?? 108;
    form.elements.legal.value = listing.legal || "";
    form.elements.image.value = listing.image || listing.images?.[0] || "";
    form.elements.description.value = listing.description || "";
}

function showEditForm(card, submission) {
    card.querySelector(".member-edit-form")?.remove();
    const form = el.editTemplate.content.cloneNode(true).querySelector("form");
    fillEditForm(form, submission);
    setupMemberImageTool(form);
    form.querySelector(".cancel-edit").addEventListener("click", () => form.remove());
    form.addEventListener("submit", (event) => saveSubmissionEdit(event, submission, form));
    card.appendChild(form);
}

async function saveSubmissionEdit(event, submission, form) {
    event.preventDefault();
    const message = form.querySelector(".edit-message");
    message.className = "edit-message";
    message.textContent = "Đang lưu...";

    const payload = {
        phone: state.phone || submission.contact?.phone || "",
        trackingCode: submission.trackingCode || "",
        contactName: submission.contact?.name || "",
        contactPhone: state.phone || submission.contact?.phone || "",
        contactNote: submission.contact?.note || "",
        listing: {
            ...submission.listing,
            title: form.elements.title.value.trim(),
            location: form.elements.location.value.trim(),
            type: form.elements.type.value.trim(),
            price: Number(form.elements.price.value || 0),
            area: Number(form.elements.area.value || 0),
            frontage: form.elements.frontage.value === "" ? null : Number(form.elements.frontage.value),
            depth: form.elements.depth.value === "" ? null : Number(form.elements.depth.value),
            roadWidth: form.elements.roadWidth.value === "" ? null : Number(form.elements.roadWidth.value),
            beds: Number(form.elements.beds.value || 0),
            baths: Number(form.elements.baths.value || 0),
            legal: form.elements.legal.value.trim(),
            image: form.elements.image.value.trim(),
            images: [form.elements.image.value.trim()].filter(Boolean),
            coordinates: [Number(form.elements.latitude.value), Number(form.elements.longitude.value)],
            description: form.elements.description.value.trim()
        }
    };

    try {
        const result = await request(`/api/member/submissions/${encodeURIComponent(submission.id)}`, {
            method: "PUT",
            body: JSON.stringify(payload)
        });
        state.submissions = state.submissions.map((item) => item.id === submission.id ? result.submission : item);
        message.className = "edit-message ok";
        message.textContent = "Đã lưu chỉnh sửa. Quản trị sẽ duyệt bản mới.";
        renderSubmissions();
    } catch (error) {
        message.className = "edit-message error";
        message.textContent = error.message;
    }
}

function init() {
    el.phone.value = localStorage.getItem("ndv_member_phone") || "";
    el.code.value = localStorage.getItem("ndv_member_code") || "";
    if (el.statusFilter) {
        el.statusFilter.addEventListener("change", () => {
            state.statusFilter = el.statusFilter.value;
            renderSubmissions();
        });
    }
    if (el.refresh) {
        el.refresh.addEventListener("click", () => {
            loadMember().catch((error) => {
                el.message.className = "error";
                el.message.textContent = error.message;
            });
        });
    }
    if (el.clearSession) {
        el.clearSession.addEventListener("click", () => {
            localStorage.removeItem("ndv_member_phone");
            localStorage.removeItem("ndv_member_code");
            state.phone = "";
            state.code = "";
            state.member = null;
            state.submissions = [];
            state.leads = [];
            el.phone.value = "";
            el.code.value = "";
            el.dashboard.classList.add("hidden");
            el.message.className = "";
            el.message.textContent = "Đã thoát thông tin thành viên trên máy này.";
        });
    }
    el.form.addEventListener("submit", async (event) => {
        event.preventDefault();
        try {
            await loadMember();
        } catch (error) {
            el.message.className = "error";
            el.message.textContent = error.message;
        }
    });
    if (el.phone.value || el.code.value) {
        loadMember().catch(() => {});
    }
}

document.addEventListener("DOMContentLoaded", init);
