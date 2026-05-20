const state = {
    listings: [],
    leads: [],
    submissions: [],
    analytics: null,
    site: null,
    staticMode: sessionStorage.getItem("ndv_admin_static_session") === "1",
    selectedId: null,
    adminMap: null,
    adminMarker: null,
    adminStreetLayer: null,
    adminSatelliteLayer: null,
    csrfToken: sessionStorage.getItem("ndv_csrf") || ""
};

const nativeConfirm = window.confirm.bind(window);
const STATIC_ADMIN_USERNAME = "admin";
const STATIC_ADMIN_PASSWORD = "Admin@123456";

const elements = {
    loginView: document.getElementById("login-view"),
    dashboardView: document.getElementById("dashboard-view"),
    loginForm: document.getElementById("login-form"),
    loginMessage: document.getElementById("login-message"),
    logoutButton: document.getElementById("logout-button"),
    welcomeText: document.getElementById("welcome-text"),
    siteForm: document.getElementById("site-form"),
    siteMessage: document.getElementById("site-message"),
    leadList: document.getElementById("lead-list"),
    leadCount: document.getElementById("lead-count"),
    submissionList: document.getElementById("submission-list"),
    submissionCount: document.getElementById("submission-count"),
    adminList: document.getElementById("admin-list"),
    listingCount: document.getElementById("listing-count"),
    listingEditor: document.getElementById("listing-editor"),
    editorMessage: document.getElementById("editor-message"),
    deleteButton: document.getElementById("delete-button"),
    newListingButton: document.getElementById("new-listing-button"),
    addNearbyButton: document.getElementById("add-nearby-button"),
    nearbyEditorList: document.getElementById("nearby-editor-list"),
    nearbyItemTemplate: document.getElementById("nearby-item-template"),
    kpiListings: document.getElementById("kpi-listings"),
    kpiPending: document.getElementById("kpi-pending"),
    kpiNewLeads: document.getElementById("kpi-new-leads"),
    kpiActiveLeads: document.getElementById("kpi-active-leads"),
    kpiViews: document.getElementById("kpi-views"),
    kpiContacts: document.getElementById("kpi-contacts"),
    kpiSearches: document.getElementById("kpi-searches"),
    analyticsList: document.getElementById("analytics-list"),
    adminLocationStatus: document.getElementById("admin-location-status")
};

async function init() {
    bindEvents();
    initAdminMap();
    await restoreSession();
}

function initAdminMap() {
    if (typeof L === "undefined") return;
    const mapContainer = document.getElementById('admin-map');
    if (!mapContainer) return;
    
    state.adminMap = L.map(mapContainer).setView([13.9833, 108.0], 13);
    state.adminStreetLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; CARTO'
    });
    state.adminSatelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri'
    });
    state.adminStreetLayer.addTo(state.adminMap);
    L.control.layers({
        "Bản đồ": state.adminStreetLayer,
        "Vệ tinh": state.adminSatelliteLayer
    }, null, { position: "topright", collapsed: false }).addTo(state.adminMap);
    state.adminMap.on("baselayerchange", updateSatelliteButtonLabel);
    
    state.adminMap.on('click', function(e) {
        setAdminCoordinates(e.latlng.lat, e.latlng.lng, {
            status: "Đã ghim theo điểm vừa chạm trên bản đồ."
        });
    });

    elements.listingEditor.latitude.addEventListener('input', syncMap);
    elements.listingEditor.longitude.addEventListener('input', syncMap);
}

function setAdminLocationStatus(text, type = "") {
    if (!elements.adminLocationStatus) return;
    elements.adminLocationStatus.className = `location-status ${type}`.trim();
    elements.adminLocationStatus.textContent = text;
}

function setAdminCoordinates(lat, lng, options = {}) {
    const nextLat = Number(lat);
    const nextLng = Number(lng);
    if (!Number.isFinite(nextLat) || !Number.isFinite(nextLng)) return false;
    elements.listingEditor.latitude.value = nextLat.toFixed(6);
    elements.listingEditor.longitude.value = nextLng.toFixed(6);
    updateMapMarker(nextLat, nextLng);
    if (state.adminMap && options.moveMap !== false) {
        state.adminMap.setView([nextLat, nextLng], options.zoom || 16);
    }
    setAdminLocationStatus(options.status || "Đã ghim vị trí trên bản đồ.", "ok");
    return true;
}

function syncMap() {
    const lat = parseFloat(elements.listingEditor.latitude.value);
    const lng = parseFloat(elements.listingEditor.longitude.value);
    if (!isNaN(lat) && !isNaN(lng) && state.adminMap) {
        updateMapMarker(lat, lng);
        state.adminMap.setView([lat, lng], 16);
        setAdminLocationStatus("Đã có vị trí trên bản đồ.", "ok");
    }
}

function updateMapMarker(lat, lng) {
    if (!state.adminMap) return;
    if (state.adminMarker) {
        state.adminMarker.setLatLng([lat, lng]);
    } else {
        state.adminMarker = L.marker([lat, lng], { draggable: true }).addTo(state.adminMap);
        state.adminMarker.on('dragend', function(e) {
            const pos = e.target.getLatLng();
            setAdminCoordinates(pos.lat, pos.lng, {
                moveMap: false,
                status: "Đã cập nhật vị trí sau khi kéo ghim."
            });
        });
    }
}

function updateSatelliteButtonLabel() {
    const btn = document.getElementById("toggle-satellite");
    if (!btn || !state.adminMap || !state.adminSatelliteLayer) return;
    const isSatellite = state.adminMap.hasLayer(state.adminSatelliteLayer);
    btn.classList.toggle("active", isSatellite);
    btn.textContent = isSatellite ? "🗺️ Bản đồ" : "🛰️ Vệ tinh";
}

function bindEvents() {
    elements.loginForm.addEventListener("submit", handleLogin);
    elements.logoutButton.addEventListener("click", handleLogout);
    elements.siteForm.addEventListener("submit", handleSaveSite);
    elements.listingEditor.addEventListener("submit", handleSaveListing);
    elements.deleteButton.addEventListener("click", handleDeleteListing);
    elements.newListingButton.addEventListener("click", () => selectListing(null));
    elements.addNearbyButton.addEventListener("click", () => appendNearbyItem());
}

async function request(url, options = {}, _retried = false) {
    if (state.staticMode && window.NDV_SUPABASE && await window.NDV_SUPABASE.init()) {
        return window.NDV_SUPABASE.handleAdminRequest(url, options);
    }
    if (state.staticMode && options.method && options.method !== "GET") {
        throw new Error("Bản Vercel hiện chạy chế độ tĩnh: xem quản trị được, nhưng muốn lưu/sửa/xóa cần bật backend Node.");
    }
    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };
    // Attach CSRF token for mutation requests
    if (options.method && options.method !== "GET" && state.csrfToken) {
        headers["X-CSRF-Token"] = state.csrfToken;
    }
    const response = await fetch(url, {
        ...options,
        headers,
        credentials: "same-origin"
    });
    const data = await response.json().catch(() => ({}));

    // Auto-refresh CSRF token on 403 and retry once
    if (response.status === 403 && !_retried && url.includes("/api/admin/")) {
        try {
            const me = await fetch("/api/auth/me", { credentials: "same-origin" });
            const meData = await me.json().catch(() => ({}));
            if (meData.csrfToken) {
                state.csrfToken = meData.csrfToken;
                sessionStorage.setItem("ndv_csrf", meData.csrfToken);
                return request(url, options, true);
            }
        } catch {}
    }

    if (!response.ok) {
        throw new Error(data.error || "Yêu cầu thất bại.");
    }
    return data;
}

async function fetchStaticJSON(url, fallback) {
    try {
        const response = await fetch(url, { credentials: "same-origin" });
        if (!response.ok) throw new Error();
        return await response.json();
    } catch {
        return fallback;
    }
}

function buildStaticAnalytics(listings = [], leads = [], submissions = []) {
    return {
        totals: {
            views: 0,
            calls: 0,
            zalo: 0,
            searches: 0
        },
        topListings: listings.slice(0, 8).map((listing) => ({
            id: listing.id,
            title: listing.title,
            location: listing.location,
            metrics: { views: 0, leads: leads.filter((lead) => lead.listingId === listing.id).length, calls: 0, zalo: 0, shares: 0, conversionRate: 0 },
            quality: { score: 70 }
        })),
        recentSearches: []
    };
}

async function loadStaticDashboard() {
    state.staticMode = true;
    sessionStorage.setItem("ndv_admin_static_session", "1");
    if (window.NDV_SUPABASE && await window.NDV_SUPABASE.init()) {
        const data = await window.NDV_SUPABASE.adminBootstrap();
        state.listings = data.listings || [];
        state.leads = data.leads || [];
        state.submissions = data.submissions || [];
        state.site = data.site || null;
        state.analytics = data.analytics || null;
        elements.welcomeText.textContent = "Đang dùng Supabase: admin có thể lưu/sửa/xóa dữ liệu thật.";
        fillSiteForm(state.site || {});
        renderStats();
        renderAnalyticsList();
        renderLeadList();
        renderSubmissionList();
        renderListingList();
        selectListing(state.listings[0]?.id || null);
        showDashboard();
        return;
    }
    const [listings, site, leads, submissions] = await Promise.all([
        fetchStaticJSON("/data/listings.json?v=51", []),
        fetchStaticJSON("/data/site.json?v=51", null),
        fetchStaticJSON("/data/leads.json?v=51", []),
        fetchStaticJSON("/data/submissions.json?v=51", [])
    ]);
    state.listings = Array.isArray(listings) ? listings : [];
    state.leads = Array.isArray(leads) ? leads : [];
    state.submissions = Array.isArray(submissions) ? submissions : [];
    state.site = site || {
        brandName: "Nhà Đất Việt",
        tagline: "Bản đồ bất động sản",
        contact: {
            phoneDisplay: "0900 000 000",
            phoneRaw: "0900000000",
            email: "hello@example.com",
            zaloUrl: "https://zalo.me/0900000000"
        }
    };
    state.analytics = buildStaticAnalytics(state.listings, state.leads, state.submissions);
    elements.welcomeText.textContent = "Đang mở quản trị tạm trên Vercel static. Xem dữ liệu được; lưu/sửa/xóa cần bật backend Node.";
    fillSiteForm(state.site);
    renderStats();
    renderAnalyticsList();
    renderLeadList();
    renderSubmissionList();
    renderListingList();
    selectListing(state.listings[0]?.id || null);
    showDashboard();
}

async function restoreSession() {
    try {
        const session = await request("/api/auth/me");
        if (!session.authenticated) {
            if (state.staticMode) {
                await loadStaticDashboard();
                return;
            }
            showLogin();
            return;
        }
        // Restore CSRF token from session
        if (session.csrfToken) {
            state.csrfToken = session.csrfToken;
            sessionStorage.setItem("ndv_csrf", session.csrfToken);
        }
        await loadDashboard();
    } catch {
        if (state.staticMode) {
            await loadStaticDashboard();
            return;
        }
        showLogin();
    }
}

function showLogin() {
    elements.loginView.classList.remove("hidden");
    elements.dashboardView.classList.add("hidden");
}

function showDashboard() {
    elements.loginView.classList.add("hidden");
    elements.dashboardView.classList.remove("hidden");
}

async function handleLogin(event) {
    event.preventDefault();
    elements.loginMessage.textContent = "";

    const formData = new FormData(elements.loginForm);
    const username = String(formData.get("username")).trim();
    const password = String(formData.get("password"));
    try {
        const data = await request("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({
                username,
                password
            })
        });
        // Store CSRF token from login response
        if (data.csrfToken) {
            state.csrfToken = data.csrfToken;
            sessionStorage.setItem("ndv_csrf", data.csrfToken);
        }
        await loadDashboard();
    } catch (error) {
        if (username === STATIC_ADMIN_USERNAME && password === STATIC_ADMIN_PASSWORD) {
            elements.loginMessage.textContent = "Backend chưa bật, đang mở quản trị tạm bằng dữ liệu tĩnh...";
            await loadStaticDashboard();
            return;
        }
        elements.loginMessage.textContent = error.message;
    }
}

async function handleLogout() {
    if (!state.staticMode) {
        await request("/api/auth/logout", { method: "POST" }).catch(() => {});
    }
    state.staticMode = false;
    state.csrfToken = "";
    sessionStorage.removeItem("ndv_admin_static_session");
    sessionStorage.removeItem("ndv_csrf");
    showLogin();
}

async function loadDashboard() {
    if (state.staticMode) {
        await loadStaticDashboard();
        return;
    }
    const data = await request("/api/admin/bootstrap");
    state.listings = data.listings;
    state.leads = data.leads || [];
    state.submissions = data.submissions || [];
    state.analytics = data.analytics || null;
    state.site = data.site;
    elements.welcomeText.textContent = `Đang đăng nhập với tài khoản ${data.user.username}.`;
    fillSiteForm(data.site);
    renderStats();
    renderAnalyticsList();
    renderLeadList();
    renderSubmissionList();
    renderListingList();
    selectListing(state.listings[0]?.id || null);
    showDashboard();
}

function submissionStatusLabel(status) {
    if (status === "APPROVED") return "Đã duyệt";
    if (status === "REJECTED") return "Đã từ chối";
    return "Chờ duyệt";
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

function renderStats() {
    if (!elements.kpiListings) return;
    const pending = state.submissions.filter((item) => item.status === "PENDING").length;
    const newLeads = state.leads.filter((lead) => !lead.status || lead.status === "NEW").length;
    const activeLeads = state.leads.filter((lead) => ["CONTACTED", "VIEWING", "NEGOTIATING"].includes(lead.status)).length;
    const totals = state.analytics?.totals || {};
    elements.kpiListings.textContent = state.listings.length;
    elements.kpiPending.textContent = pending;
    elements.kpiNewLeads.textContent = newLeads;
    elements.kpiActiveLeads.textContent = activeLeads;
    if (elements.kpiViews) elements.kpiViews.textContent = Number(totals.views || 0);
    if (elements.kpiContacts) elements.kpiContacts.textContent = Number(totals.calls || 0) + Number(totals.zalo || 0);
    if (elements.kpiSearches) elements.kpiSearches.textContent = Number(totals.searches || 0);
}

function renderAnalyticsList() {
    if (!elements.analyticsList) return;
    const analytics = state.analytics || {};
    const topListings = Array.isArray(analytics.topListings) ? analytics.topListings : [];
    const recentSearches = Array.isArray(analytics.recentSearches) ? analytics.recentSearches : [];

    if (!topListings.length && !recentSearches.length) {
        elements.analyticsList.innerHTML = '<p class="muted">Chưa có dữ liệu tương tác. Khi khách xem tin, gọi, Zalo hoặc tìm kiếm, phần này sẽ tự cập nhật.</p>';
        return;
    }

    const topHtml = topListings.length
        ? topListings.map((item, index) => {
            const metrics = item.metrics || {};
            const quality = item.quality || {};
            const contacts = Number(metrics.calls || 0) + Number(metrics.zalo || 0);
            return `
                <article class="analytics-card">
                    <div>
                        <span class="rank">#${index + 1}</span>
                        <h3>${escapeHTML(item.title || "Tin chưa có tiêu đề")}</h3>
                        <p>${escapeHTML(item.location || "")}</p>
                    </div>
                    <div class="metric-row">
                        <span>${Number(metrics.views || 0)} xem</span>
                        <span>${Number(metrics.leads || 0)} khách hỏi</span>
                        <span>${contacts} gọi/Zalo</span>
                        <span>${Number(metrics.shares || 0)} chia sẻ</span>
                        <span>${Number(metrics.conversionRate || 0)}% chuyển đổi</span>
                        <span>Điểm tin ${Number(quality.score || 0)}/100</span>
                    </div>
                </article>
            `;
        }).join("")
        : '<p class="muted">Chưa có tin nào phát sinh lượt xem.</p>';

    const searchHtml = recentSearches.length
        ? recentSearches.slice(0, 6).map((item) => `
            <span class="search-pill">${escapeHTML(item.summary || item.query || "Tìm kiếm")}</span>
        `).join("")
        : '<span class="search-pill">Chưa có lượt tìm kiếm</span>';

    elements.analyticsList.innerHTML = `
        <div class="analytics-columns">
            <div>
                <h3>Tin đang có tín hiệu tốt</h3>
                <div class="analytics-stack">${topHtml}</div>
            </div>
            <div>
                <h3>Nhu cầu khách vừa tìm</h3>
                <div class="search-pill-list">${searchHtml}</div>
            </div>
        </div>
    `;
}

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

function safeImageSrc(value) {
    const url = String(value || "").trim();
    if (!url) return "";
    if (url.startsWith("data:image/")) return url;
    try {
        const parsed = new URL(url, window.location.origin);
        return ["http:", "https:"].includes(parsed.protocol) ? parsed.href : "";
    } catch {
        return "";
    }
}

function normalizeImages(value) {
    if (Array.isArray(value)) {
        return value.map((item) => String(item || "").trim()).filter(Boolean);
    }
    if (typeof value === "string") {
        return value.split(/\r?\n|\s+(?=https?:\/\/|data:image\/)/).map((item) => item.trim()).filter(Boolean);
    }
    return [];
}

function listingImages(listing = {}) {
    const images = normalizeImages(listing.images);
    const primary = String(listing.image || "").trim();
    if (primary && !images.includes(primary)) {
        images.unshift(primary);
    }
    return images;
}

function renderReviewImageItems(images) {
    if (!images.length) {
        return '<p class="muted review-image-empty">Chưa có ảnh.</p>';
    }
    return images.map((image, index) => {
        const safeSrc = safeImageSrc(image);
        return `
            <div class="review-image-item">
                ${safeSrc ? `<img src="${escapeAttr(safeSrc)}" alt="Ảnh ${index + 1}">` : '<div class="review-image-broken">URL lỗi</div>'}
                <button type="button" class="review-image-remove" data-action="remove-review-image" data-index="${index}">Xóa</button>
                ${index === 0 ? '<span>Ảnh bìa</span>' : ""}
            </div>
        `;
    }).join("");
}

function numberOrNull(value) {
    return value === "" || value === null || value === undefined ? null : Number(value);
}

function renderSubmissionList() {
    if (!elements.submissionList) return;
    const pending = state.submissions.filter((item) => item.status === "PENDING");
    elements.submissionCount.textContent = `${pending.length} tin chờ`;
    elements.submissionList.innerHTML = "";

    if (!state.submissions.length) {
        elements.submissionList.innerHTML = '<p class="muted">Chưa có tin thành viên gửi lên.</p>';
        return;
    }

    state.submissions.slice(0, 40).forEach((submission) => {
        const article = document.createElement("article");
        article.className = `submission-card ${submission.status.toLowerCase()}`;
        const listing = submission.listing || {};
        const created = submission.createdAt ? new Date(submission.createdAt).toLocaleString("vi-VN") : "";
        const images = listingImages(listing);
        const cover = safeImageSrc(images[0]) || "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=300&q=80";
        const canReview = submission.status === "PENDING";
        const editableImagesText = images.join("\n");

        article.innerHTML = `
            <img src="${escapeAttr(cover)}" alt="">
            <div class="submission-main">
                <div class="submission-topline">
                    <span>${submissionStatusLabel(submission.status)}</span>
                    <small>${created}</small>
                </div>
                <h3>${escapeHTML(listing.title || "Tin chưa có tiêu đề")}</h3>
                <p>${escapeHTML(listing.location || "")} • ${escapeHTML(listing.type || "")} • ${listing.price || 0} tỷ • ${listing.area || 0} m2</p>
                <p>${listing.frontage || "-"}m ngang • đường ${listing.roadWidth || "-"}m • ${escapeHTML(listing.direction || "chưa rõ hướng")}</p>
                <p>${escapeHTML(listing.landUse || "Chưa rõ thổ cư")} • ${escapeHTML(listing.planningStatus || "Chưa rõ quy hoạch")}</p>
                <p class="submission-contact">Mã hồ sơ: ${escapeHTML(submission.trackingCode || submission.id)}</p>
                <p class="submission-contact">Người đăng: ${escapeHTML(submission.contact?.name || "")} - ${escapeHTML(submission.contact?.phone || "")}</p>
                ${listing.video ? `<p class="submission-contact">Video: <a href="${escapeAttr(listing.video)}" target="_blank" rel="noopener">Mở video kiểm duyệt</a></p>` : ""}
                <p class="submission-desc">${escapeHTML(listing.description || "")}</p>
                <details class="submission-edit" ${canReview ? "" : "hidden"}>
                    <summary>Sửa nhanh trước khi duyệt</summary>
                    <div class="review-grid">
                        <label><span>Tiêu đề</span><input data-review-field="title" value="${escapeHTML(listing.title || "")}"></label>
                        <label><span>Khu vực</span><input data-review-field="location" value="${escapeHTML(listing.location || "")}"></label>
                        <label><span>Loại hình</span><input data-review-field="type" value="${escapeHTML(listing.type || "")}"></label>
                        <label><span>Giá tỷ</span><input data-review-field="price" type="number" step="0.1" value="${listing.price ?? ""}"></label>
                        <label><span>Diện tích m2</span><input data-review-field="area" type="number" step="1" value="${listing.area ?? ""}"></label>
                        <label><span>Ngang m</span><input data-review-field="frontage" type="number" step="0.1" value="${listing.frontage ?? ""}"></label>
                        <label><span>Dài m</span><input data-review-field="depth" type="number" step="0.1" value="${listing.depth ?? ""}"></label>
                        <label><span>Đường m</span><input data-review-field="roadWidth" type="number" step="0.1" value="${listing.roadWidth ?? ""}"></label>
                        <label><span>Hướng</span><input data-review-field="direction" value="${escapeHTML(listing.direction || "")}"></label>
                        <label><span>Phòng ngủ</span><input data-review-field="beds" type="number" step="1" value="${listing.beds ?? 0}"></label>
                        <label><span>Phòng tắm</span><input data-review-field="baths" type="number" step="1" value="${listing.baths ?? 0}"></label>
                        <label><span>Pháp lý</span><input data-review-field="legal" value="${escapeHTML(listing.legal || "")}"></label>
                        <label><span>Thổ cư</span><input data-review-field="landUse" value="${escapeHTML(listing.landUse || "")}"></label>
                        <label><span>Vay ngân hàng</span><input data-review-field="bankLoan" value="${escapeHTML(listing.bankLoan || "")}"></label>
                        <label><span>Vĩ độ</span><input data-review-field="latitude" type="number" step="0.000001" value="${listing.coordinates?.[0] ?? ""}"></label>
                        <label><span>Kinh độ</span><input data-review-field="longitude" type="number" step="0.000001" value="${listing.coordinates?.[1] ?? ""}"></label>
                        <label class="full"><span>Ảnh tin đăng</span>
                            <div class="review-image-manager" data-image-manager>
                                <div class="review-image-grid" data-image-preview>${renderReviewImageItems(images)}</div>
                                <div class="review-add-image">
                                    <input data-image-url type="url" placeholder="Dán URL ảnh mới">
                                    <button class="button button-ghost" type="button" data-action="add-review-image">Thêm ảnh</button>
                                </div>
                                <textarea data-review-field="imagesText" hidden>${escapeHTML(editableImagesText)}</textarea>
                            </div>
                        </label>
                        <label class="full"><span>Quy hoạch/lộ giới</span><input data-review-field="planningStatus" value="${escapeHTML(listing.planningStatus || "")}"></label>
                        <label class="full"><span>Video</span><input data-review-field="video" type="text" value="${escapeHTML(listing.video || "")}" placeholder="YouTube hoặc /uploads/videos/..."></label>
                        <label class="full"><span>Mô tả</span><textarea data-review-field="description" rows="4">${escapeHTML(listing.description || "")}</textarea></label>
                    </div>
                    <div class="submission-inline-actions">
                        <button class="button button-ghost" type="button" data-action="save-draft">Lưu sửa</button>
                        <button class="button" type="button" data-action="approve-edited">Duyệt bản sửa</button>
                    </div>
                </details>
            </div>
            <div class="submission-actions">
                <button class="button" data-action="approve" ${canReview ? "" : "disabled"}>Duyệt đăng</button>
                <button class="button button-danger" data-action="reject" ${canReview ? "" : "disabled"}>Từ chối</button>
                <button class="button button-ghost" data-action="delete-submission">Xóa khỏi hàng chờ</button>
            </div>
        `;

        article.querySelector('[data-action="approve"]').addEventListener("click", () => reviewSubmission(submission.id, "approve"));
        article.querySelector('[data-action="reject"]').addEventListener("click", () => reviewSubmission(submission.id, "reject"));
        article.querySelector('[data-action="delete-submission"]').addEventListener("click", () => deleteSubmission(submission.id));
        bindReviewImageManager(article);
        const saveDraftButton = article.querySelector('[data-action="save-draft"]');
        const approveEditedButton = article.querySelector('[data-action="approve-edited"]');
        if (saveDraftButton) saveDraftButton.addEventListener("click", () => saveSubmissionDraft(submission.id, article));
        if (approveEditedButton) approveEditedButton.addEventListener("click", () => reviewSubmission(submission.id, "approve", collectSubmissionDraft(submission.id, article)));
        elements.submissionList.appendChild(article);
    });
}

function reviewField(article, field) {
    return article.querySelector(`[data-review-field="${field}"]`);
}

function reviewImages(article) {
    return normalizeImages(reviewField(article, "imagesText")?.value || "");
}

function setReviewImages(article, images) {
    const nextImages = images.map((item) => String(item || "").trim()).filter(Boolean);
    const textarea = reviewField(article, "imagesText");
    const preview = article.querySelector("[data-image-preview]");
    if (textarea) textarea.value = nextImages.join("\n");
    if (preview) preview.innerHTML = renderReviewImageItems(nextImages);
    bindReviewImageManager(article);
}

function bindReviewImageManager(article) {
    const manager = article.querySelector("[data-image-manager]");
    if (!manager) return;

    manager.querySelectorAll('[data-action="remove-review-image"]').forEach((button) => {
        button.onclick = () => {
            const index = Number(button.dataset.index);
            const images = reviewImages(article);
            images.splice(index, 1);
            setReviewImages(article, images);
        };
    });

    const addButton = manager.querySelector('[data-action="add-review-image"]');
    const urlInput = manager.querySelector("[data-image-url]");
    if (addButton && urlInput) {
        addButton.onclick = () => {
            const url = urlInput.value.trim();
            if (!safeImageSrc(url)) {
                window.alert("URL ảnh không hợp lệ. Chỉ dùng link http/https hoặc ảnh đã tải lên.");
                return;
            }
            setReviewImages(article, [...reviewImages(article), url]);
            urlInput.value = "";
        };
    }
}

function collectSubmissionDraft(id, article) {
    const current = state.submissions.find((item) => item.id === id);
    const original = current?.listing || {};
    const images = reviewImages(article);

    return {
        listing: {
            ...original,
            title: reviewField(article, "title")?.value.trim() || "",
            location: reviewField(article, "location")?.value.trim() || "",
            type: reviewField(article, "type")?.value.trim() || "",
            price: Number(reviewField(article, "price")?.value || 0),
            area: Number(reviewField(article, "area")?.value || 0),
            frontage: numberOrNull(reviewField(article, "frontage")?.value),
            depth: numberOrNull(reviewField(article, "depth")?.value),
            roadWidth: numberOrNull(reviewField(article, "roadWidth")?.value),
            direction: reviewField(article, "direction")?.value.trim() || "",
            beds: Number(reviewField(article, "beds")?.value || 0),
            baths: Number(reviewField(article, "baths")?.value || 0),
            legal: reviewField(article, "legal")?.value.trim() || "",
            landUse: reviewField(article, "landUse")?.value.trim() || "",
            bankLoan: reviewField(article, "bankLoan")?.value.trim() || "",
            planningStatus: reviewField(article, "planningStatus")?.value.trim() || "",
            image: images[0] || "",
            images,
            video: reviewField(article, "video")?.value.trim() || "",
            coordinates: [
                Number(reviewField(article, "latitude")?.value || 13.9833),
                Number(reviewField(article, "longitude")?.value || 108.0)
            ],
            description: reviewField(article, "description")?.value.trim() || ""
        }
    };
}

async function saveSubmissionDraft(id, article) {
    try {
        const result = await request(`/api/admin/submissions/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify(collectSubmissionDraft(id, article))
        });
        state.submissions = state.submissions.map((item) => item.id === id ? result.submission : item);
        renderStats();
        renderSubmissionList();
    } catch (error) {
        window.alert(error.message);
    }
}

async function deleteSubmission(id) {
    if (!nativeConfirm("Xóa tin thành viên gửi lên khỏi hàng chờ?")) return;
    try {
        await request(`/api/admin/submissions/${encodeURIComponent(id)}`, { method: "DELETE" });
        state.submissions = state.submissions.filter((item) => item.id !== id);
        renderStats();
        renderSubmissionList();
    } catch (error) {
        window.alert(error.message);
    }
}

async function reviewSubmission(id, action, draft = null) {
    const isApprove = action === "approve";
    if (!nativeConfirm(isApprove ? "Duyệt tin này và đăng công khai?" : "Từ chối tin này?")) {
        return;
    }

    try {
        const result = await request(`/api/admin/submissions/${encodeURIComponent(id)}/${action}`, {
            method: "POST",
            body: JSON.stringify({
                reason: isApprove ? "" : "Admin từ chối",
                ...(draft || {})
            })
        });
        state.submissions = state.submissions.map((item) => item.id === id ? result.submission : item);
        if (result.listing) {
            state.listings.unshift(result.listing);
            state.selectedId = result.listing.id;
        }
        renderStats();
        renderSubmissionList();
        renderListingList();
        if (result.listing) fillListingForm(result.listing);
    } catch (error) {
        window.alert(error.message);
    }
}

function renderLeadList() {
    if (!elements.leadList) return;
    elements.leadList.innerHTML = "";
    elements.leadCount.textContent = `${state.leads.length} khách`;

    if (!state.leads.length) {
        elements.leadList.innerHTML = '<p class="muted">Chưa có khách để lại số từ website.</p>';
        return;
    }

    state.leads.slice(0, 30).forEach((lead) => {
        const article = document.createElement("article");
        article.className = "lead-card";
        const created = lead.createdAt ? new Date(lead.createdAt).toLocaleString("vi-VN") : "";
        article.innerHTML = `
            <div>
                <span class="lead-status-badge">${leadStatusLabel(lead.status)}</span>
                <h3>${escapeHTML(lead.name)}</h3>
                <p>${escapeHTML(lead.phone)} • ${created}</p>
                <p class="lead-need">${escapeHTML(lead.need || "Chưa ghi nhu cầu cụ thể.")}</p>
                ${lead.note ? `<p class="lead-need">Ghi chú: ${escapeHTML(lead.note)}</p>` : ""}
            </div>
            <div class="lead-actions">
                <span>${escapeHTML(lead.listingTitle || "Tin chưa xác định")}</span>
                <select data-lead-status>
                    <option value="NEW">Khách mới</option>
                    <option value="CONTACTED">Đã gọi</option>
                    <option value="VIEWING">Hẹn xem</option>
                    <option value="NEGOTIATING">Đàm phán</option>
                    <option value="CLOSED">Đã chốt</option>
                    <option value="LOST">Không phù hợp</option>
                </select>
                <textarea data-lead-note rows="2" placeholder="Ghi chú chăm sóc khách">${escapeHTML(lead.note || "")}</textarea>
                <button class="button button-ghost" type="button" data-lead-save>Lưu trạng thái</button>
                <a class="button button-ghost" href="tel:${escapeHTML(lead.phone)}">Gọi</a>
            </div>
        `;
        const statusSelect = article.querySelector("[data-lead-status]");
        if (statusSelect) statusSelect.value = lead.status || "NEW";
        article.querySelector("[data-lead-save]")?.addEventListener("click", () => updateLeadStatus(lead.id, article));
        elements.leadList.appendChild(article);
    });
}

async function updateLeadStatus(id, article) {
    try {
        const status = article.querySelector("[data-lead-status]")?.value || "NEW";
        const note = article.querySelector("[data-lead-note]")?.value || "";
        const result = await request(`/api/admin/leads/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify({ status, note })
        });
        state.leads = state.leads.map((item) => item.id === id ? result.lead : item);
        renderStats();
        renderLeadList();
    } catch (error) {
        window.alert(error.message);
    }
}

function fillSiteForm(site) {
    elements.siteForm.brandName.value = site.brandName || "";
    elements.siteForm.tagline.value = site.tagline || "";
    elements.siteForm.phoneDisplay.value = site.contact?.phoneDisplay || "";
    elements.siteForm.phoneRaw.value = site.contact?.phoneRaw || "";
    elements.siteForm.email.value = site.contact?.email || "";
    elements.siteForm.zaloUrl.value = site.contact?.zaloUrl || "";
}

async function handleSaveSite(event) {
    event.preventDefault();
    elements.siteMessage.textContent = "";
    try {
        const payload = {
            brandName: elements.siteForm.brandName.value.trim(),
            tagline: elements.siteForm.tagline.value.trim(),
            contact: {
                phoneDisplay: elements.siteForm.phoneDisplay.value.trim(),
                phoneRaw: elements.siteForm.phoneRaw.value.trim(),
                email: elements.siteForm.email.value.trim(),
                zaloUrl: elements.siteForm.zaloUrl.value.trim()
            }
        };
        const result = await request("/api/admin/site", {
            method: "PUT",
            body: JSON.stringify(payload)
        });
        state.site = result.site;
        elements.siteMessage.textContent = "Đã lưu thông tin website.";
    } catch (error) {
        elements.siteMessage.textContent = error.message;
    }
}

function renderListingList() {
    elements.adminList.innerHTML = "";
    elements.listingCount.textContent = `${state.listings.length} tin`;

    state.listings.forEach((listing) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `listing-item ${listing.id === state.selectedId ? "active" : ""}`;
        
        const cover = safeImageSrc((listing.images && listing.images.length > 0) ? listing.images[0] : listing.image)
            || "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=200&q=80";
        
        button.innerHTML = `
            <img src="${escapeAttr(cover)}" class="listing-item-thumb" alt="">
            <div class="listing-item-info">
                <h3>${escapeHTML(listing.title)}</h3>
                <p>${escapeHTML(listing.location)} • ${escapeHTML(listing.type)}</p>
            </div>
        `;
        button.addEventListener("click", () => selectListing(listing.id));
        elements.adminList.appendChild(button);
    });
}

function selectListing(id) {
    state.selectedId = id;
    const listing = state.listings.find((item) => item.id === id);

    if (!listing) {
        fillListingForm(emptyListing());
        elements.deleteButton.classList.add("hidden");
    } else {
        fillListingForm(listing);
        elements.deleteButton.classList.remove("hidden");
    }

    renderListingList();
    elements.editorMessage.textContent = "";
}

function emptyListing() {
    return {
        id: "",
        title: "",
        location: "",
        type: "",
        price: "",
        area: "",
        frontage: "",
        depth: "",
        roadWidth: "",
        direction: "",
        beds: "",
        baths: "",
        legal: "",
        landUse: "",
        planningStatus: "",
        bankLoan: "",
        image: "",
        video: "",
        vrUrl: "",
        aiValuation: "",
        walkScore: "",
        coordinates: [13.9833, 108.0],
        description: "",
        mapSummary: "",
        nearby: []
    };
}

function fillListingForm(listing) {
    elements.listingEditor.id.value = listing.id || "";
    elements.listingEditor.title.value = listing.title || "";
    elements.listingEditor.location.value = listing.location || "";
    elements.listingEditor.type.value = listing.type || "";
    elements.listingEditor.price.value = listing.price ?? "";
    elements.listingEditor.area.value = listing.area ?? "";
    if (elements.listingEditor.frontage) elements.listingEditor.frontage.value = listing.frontage ?? "";
    if (elements.listingEditor.depth) elements.listingEditor.depth.value = listing.depth ?? "";
    if (elements.listingEditor.roadWidth) elements.listingEditor.roadWidth.value = listing.roadWidth ?? "";
    if (elements.listingEditor.direction) elements.listingEditor.direction.value = listing.direction || "";
    elements.listingEditor.beds.value = listing.beds ?? "";
    elements.listingEditor.baths.value = listing.baths ?? "";
    elements.listingEditor.legal.value = listing.legal || "";
    if (elements.listingEditor.landUse) elements.listingEditor.landUse.value = listing.landUse || "";
    if (elements.listingEditor.planningStatus) elements.listingEditor.planningStatus.value = listing.planningStatus || "";
    if (elements.listingEditor.bankLoan) elements.listingEditor.bankLoan.value = listing.bankLoan || "";
    elements.listingEditor.image.value = listing.image || "";
    elements.listingEditor.imagesText.value = (listing.images && listing.images.length ? listing.images : (listing.image ? [listing.image] : [])).join("\n");
    setTimeout(() => window.populateDropzoneFromListing?.(listing), 0);
    elements.listingEditor.video.value = listing.video || "";
    
    // Thuộc tính 2026
    if(elements.listingEditor.vrUrl) elements.listingEditor.vrUrl.value = listing.vrUrl || "";
    if(elements.listingEditor.aiValuation) elements.listingEditor.aiValuation.value = listing.aiValuation || "";
    if(elements.listingEditor.walkScore) elements.listingEditor.walkScore.value = listing.walkScore || "";

    elements.listingEditor.latitude.value = listing.coordinates?.[0] ?? 13.9833;
    elements.listingEditor.longitude.value = listing.coordinates?.[1] ?? 108.0;
    elements.listingEditor.description.value = listing.description || "";
    elements.listingEditor.mapSummary.value = listing.mapSummary || "";
    renderNearbyEditor(listing.nearby || []);
    
    syncMap();
    if (state.adminMap) {
        setTimeout(() => state.adminMap.invalidateSize(), 300);
    }
}

function renderNearbyEditor(items) {
    elements.nearbyEditorList.innerHTML = "";
    items.forEach((item) => appendNearbyItem(item));
}

function appendNearbyItem(item = {}) {
    const fragment = elements.nearbyItemTemplate.content.cloneNode(true);
    const article = fragment.querySelector(".nearby-item");
    const fields = {
        name: article.querySelector('[data-field="name"]'),
        distance: article.querySelector('[data-field="distance"]'),
        latitude: article.querySelector('[data-field="latitude"]'),
        longitude: article.querySelector('[data-field="longitude"]'),
        image: article.querySelector('[data-field="image"]'),
        videoUrl: article.querySelector('[data-field="videoUrl"]'),
        text: article.querySelector('[data-field="text"]')
    };

    fields.name.value = item.name || "";
    fields.distance.value = item.distance || "";
    fields.latitude.value = item.coordinates?.[0] ?? elements.listingEditor.latitude.value ?? "";
    fields.longitude.value = item.coordinates?.[1] ?? elements.listingEditor.longitude.value ?? "";
    fields.image.value = item.image || "";
    fields.videoUrl.value = item.videoUrl || "";
    fields.text.value = item.text || "";

    article.querySelector(".remove-nearby").addEventListener("click", () => article.remove());
    elements.nearbyEditorList.appendChild(fragment);
}

function collectNearbyItems() {
    return [...elements.nearbyEditorList.querySelectorAll(".nearby-item")].map((article) => ({
        name: article.querySelector('[data-field="name"]').value.trim(),
        distance: article.querySelector('[data-field="distance"]').value.trim(),
        coordinates: [
            Number(article.querySelector('[data-field="latitude"]').value),
            Number(article.querySelector('[data-field="longitude"]').value)
        ],
        image: article.querySelector('[data-field="image"]').value.trim(),
        videoUrl: article.querySelector('[data-field="videoUrl"]').value.trim(),
        text: article.querySelector('[data-field="text"]').value.trim()
    }));
}

function collectListingPayload() {
    const images = elements.listingEditor.imagesText.value
        .split(/\r?\n/)
        .map((item) => item.trim())
        .filter(Boolean);

    return {
        title: elements.listingEditor.title.value.trim(),
        location: elements.listingEditor.location.value.trim(),
        type: elements.listingEditor.type.value.trim(),
        price: Number(elements.listingEditor.price.value),
        area: Number(elements.listingEditor.area.value),
        frontage: numberOrNull(elements.listingEditor.frontage?.value),
        depth: numberOrNull(elements.listingEditor.depth?.value),
        roadWidth: numberOrNull(elements.listingEditor.roadWidth?.value),
        direction: elements.listingEditor.direction?.value.trim() || "",
        beds: Number(elements.listingEditor.beds.value),
        baths: Number(elements.listingEditor.baths.value),
        legal: elements.listingEditor.legal.value.trim(),
        landUse: elements.listingEditor.landUse?.value.trim() || "",
        planningStatus: elements.listingEditor.planningStatus?.value.trim() || "",
        bankLoan: elements.listingEditor.bankLoan?.value.trim() || "",
        image: validateURL(elements.listingEditor.image.value.trim()) || validateURL(images[0]) || "",
        images: images.map(validateURL).filter(Boolean),
        video: validateURL(elements.listingEditor.video.value.trim()),
        vrUrl: validateURL(elements.listingEditor.vrUrl?.value.trim()),
        aiValuation: elements.listingEditor.aiValuation?.value ? Number(elements.listingEditor.aiValuation.value) : null,
        walkScore: elements.listingEditor.walkScore?.value ? Number(elements.listingEditor.walkScore.value) : null,
        coordinates: [
            Number(elements.listingEditor.latitude.value),
            Number(elements.listingEditor.longitude.value)
        ],
        description: elements.listingEditor.description.value.trim(),
        mapSummary: elements.listingEditor.mapSummary.value.trim(),
        nearby: collectNearbyItems()
    };
}

async function handleSaveListing(event) {
    event.preventDefault();
    elements.editorMessage.textContent = "";

    try {
        const payload = collectListingPayload();
        const id = elements.listingEditor.id.value.trim();
        let result;

        if (id) {
            result = await request(`/api/admin/listings/${encodeURIComponent(id)}`, {
                method: "PUT",
                body: JSON.stringify(payload)
            });
            state.listings = state.listings.map((item) => (item.id === id ? result.listing : item));
            state.selectedId = id;
        } else {
            result = await request("/api/admin/listings", {
                method: "POST",
                body: JSON.stringify(payload)
            });
            state.listings.unshift(result.listing);
            state.selectedId = result.listing.id;
        }

        renderListingList();
        fillListingForm(result.listing);
        elements.listingEditor.id.value = result.listing.id;
        elements.deleteButton.classList.remove("hidden");
        elements.editorMessage.textContent = "Đã lưu tin đăng.";
    } catch (error) {
        elements.editorMessage.textContent = error.message;
    }
}

async function handleDeleteListing() {
    const id = elements.listingEditor.id.value.trim();
    if (!id) {
        return;
    }

    const confirmed = nativeConfirm("Bạn có chắc muốn xóa tin đăng này?");
    if (!confirmed) {
        return;
    }

    try {
        await request(`/api/admin/listings/${encodeURIComponent(id)}`, {
            method: "DELETE"
        });
        state.listings = state.listings.filter((item) => item.id !== id);
        elements.editorMessage.textContent = "Đã xóa tin đăng.";
        selectListing(state.listings[0]?.id || null);
    } catch (error) {
        elements.editorMessage.textContent = error.message;
    }
}

function validateURL(urlStr) {
    if (!urlStr) return "";
    if (urlStr.startsWith("data:image/")) return urlStr;
    if (urlStr.startsWith("/uploads/videos/") && !urlStr.includes("..")) return urlStr;
    try {
        new URL(urlStr);
        return urlStr;
    } catch {
        return "";
    }
}

document.addEventListener("DOMContentLoaded", init);

// ================== IMAGE DROPZONE (GPT-style) ==================
const uploadedImages = []; // { src: dataURL or URL, file?: File }

document.addEventListener("DOMContentLoaded", () => {
    const dropzone = document.getElementById("image-dropzone");
    const fileInput = document.getElementById("image-file-input");
    const previewGrid = document.getElementById("image-preview-grid");
    if (!dropzone || !fileInput || !previewGrid) return;

    dropzone.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("dragover", (e) => { e.preventDefault(); dropzone.classList.add("drag-over"); });
    dropzone.addEventListener("dragleave", () => dropzone.classList.remove("drag-over"));
    dropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropzone.classList.remove("drag-over");
        handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener("change", () => {
        handleFiles(fileInput.files);
        fileInput.value = "";
    });

    function handleFiles(files) {
        const remain = 10 - uploadedImages.length;
        const toProcess = Array.from(files).slice(0, remain);
        toProcess.forEach((file) => {
            if (!file.type.startsWith("image/")) return;
            const reader = new FileReader();
            reader.onload = () => {
                // Resize before storing
                const img = new Image();
                img.onload = () => {
                    const maxSize = 1200;
                    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
                    const canvas = document.createElement("canvas");
                    canvas.width = Math.round(img.width * scale);
                    canvas.height = Math.round(img.height * scale);
                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
                    uploadedImages.push({ src: dataUrl });
                    renderImagePreviews();
                    syncImagesToTextarea();
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    window.removeUploadedImage = function(index) {
        uploadedImages.splice(index, 1);
        renderImagePreviews();
        syncImagesToTextarea();
    };

    function renderImagePreviews() {
        previewGrid.innerHTML = "";
        uploadedImages.forEach((item, index) => {
            const div = document.createElement("div");
            div.className = `image-preview-item ${index === 0 ? "is-cover" : ""}`;
            div.innerHTML = `
                <img src="${item.src}" alt="Ảnh ${index + 1}">
                <button type="button" class="preview-remove" onclick="removeUploadedImage(${index})">✕</button>
                ${index === 0 ? '<span class="preview-cover-badge">Ảnh bìa</span>' : ""}
            `;
            previewGrid.appendChild(div);
        });
    }

    function syncImagesToTextarea() {
        const textarea = elements.listingEditor.imagesText;
        if (!textarea) return;
        // Keep URL lines from textarea, add data URLs from dropzone
        const urlLines = textarea.value.split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith("data:"));
        const dataUrls = uploadedImages.map(i => i.src);
        textarea.value = [...urlLines, ...dataUrls].join("\n");
        // Also set hidden image field to first image
        if (elements.listingEditor.image) {
            elements.listingEditor.image.value = urlLines[0] || dataUrls[0] || "";
        }
    }

    // On listing load, populate previews from existing data URLs
    window.populateDropzoneFromListing = function(listing) {
        uploadedImages.length = 0;
        const imgs = listing.images || [];
        imgs.forEach((src) => {
            if (src && src.startsWith("data:")) {
                uploadedImages.push({ src });
            }
        });
        renderImagePreviews();
    };
});

// ================== SATELLITE MAP TOGGLE ==================
document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("toggle-satellite");
    if (!btn) return;

    btn.addEventListener("click", () => {
        if (!state.adminMap || !state.adminStreetLayer || !state.adminSatelliteLayer) return;
        const isSatellite = state.adminMap.hasLayer(state.adminSatelliteLayer);
        if (isSatellite) {
            state.adminMap.removeLayer(state.adminSatelliteLayer);
            state.adminStreetLayer.addTo(state.adminMap);
        } else {
            state.adminMap.removeLayer(state.adminStreetLayer);
            state.adminSatelliteLayer.addTo(state.adminMap);
        }
        updateSatelliteButtonLabel();
    });
});

// ================== GEOLOCATION ==================
window.detectMyLocation = function() {
    if (!navigator.geolocation) {
        alert("Trình duyệt không hỗ trợ Geolocation.");
        return;
    }
    elements.editorMessage.textContent = "Đang lấy vị trí...";
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            setAdminCoordinates(lat, lng, {
                status: "Đã ghim theo vị trí hiện tại của thiết bị."
            });
            elements.editorMessage.textContent = "Đã cập nhật vị trí!";
            setTimeout(() => elements.editorMessage.textContent = "", 3000);
        },
        () => {
            alert("Không thể lấy vị trí. Kiểm tra quyền truy cập.");
            elements.editorMessage.textContent = "";
        },
        { enableHighAccuracy: true }
    );
};

// ================== AI PRICE PREDICTION ==================
window.predictPrice = function() {
    const area = parseFloat(elements.listingEditor.area.value);
    const type = (elements.listingEditor.type.value || "").toLowerCase();
    if (isNaN(area) || area <= 0) {
        alert("Nhập diện tích trước khi dùng AI gợi ý giá.");
        return;
    }
    let basePricePerM2 = 50; // triệu/m2
    if (type.includes("biệt thự")) basePricePerM2 = 120;
    else if (type.includes("căn hộ")) basePricePerM2 = 60;
    else if (type.includes("đất")) basePricePerM2 = 35;
    else if (type.includes("nhà phố")) basePricePerM2 = 70;

    const factor = 0.9 + (Math.random() * 0.2);
    const est = (area * basePricePerM2 * factor) / 1000;
    if (elements.listingEditor.aiValuation) elements.listingEditor.aiValuation.value = est.toFixed(1);
    if (elements.listingEditor.walkScore && !elements.listingEditor.walkScore.value) {
        elements.listingEditor.walkScore.value = Math.floor(Math.random() * 40) + 60;
    }
    elements.editorMessage.textContent = "AI đã gợi ý giá!";
    setTimeout(() => elements.editorMessage.textContent = "", 3000);
};

