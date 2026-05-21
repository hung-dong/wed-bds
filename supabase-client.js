(function () {
    const state = {
        loaded: false,
        enabled: false,
        url: "",
        anonKey: "",
        schema: "public"
    };

    function id(prefix) {
        return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
    }

    function sanitizePhone(value) {
        return String(value || "").replace(/[^\d+]/g, "");
    }

    function memberIdFromPhone(phone) {
        const clean = sanitizePhone(phone);
        if (!clean) return "";
        let hash = 0;
        for (let i = 0; i < clean.length; i += 1) {
            hash = ((hash << 5) - hash + clean.charCodeAt(i)) | 0;
        }
        return `member-${Math.abs(hash).toString(16).slice(0, 10)}`;
    }

    async function init() {
        if (state.loaded) return state.enabled;
        state.loaded = true;
        try {
            const res = await fetch("/data/supabase-config.json?v=1", { credentials: "same-origin" });
            if (!res.ok) return false;
            const config = await res.json();
            state.enabled = Boolean(config.enabled && config.url && config.anonKey);
            state.url = String(config.url || "").replace(/\/+$/, "");
            state.anonKey = String(config.anonKey || "");
            state.schema = config.schema || "public";
        } catch {
            state.enabled = false;
        }
        return state.enabled;
    }

    function isConfigured() {
        return state.enabled && state.url && state.anonKey;
    }

    async function rest(path, options = {}) {
        await init();
        if (!isConfigured()) throw new Error("Chưa cấu hình Supabase.");
        const headers = {
            apikey: state.anonKey,
            Authorization: `Bearer ${state.anonKey}`,
            "Content-Type": "application/json",
            Prefer: options.prefer || "return=representation",
            ...(options.headers || {})
        };
        const res = await fetch(`${state.url}/rest/v1/${path}`, {
            ...options,
            headers
        });
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        if (!res.ok) {
            throw new Error(data?.message || data?.error || "Supabase xử lý thất bại.");
        }
        return data;
    }

    function rowToListing(row) {
        return { ...(row.data || {}), id: row.data?.id || row.id };
    }

    function rowToSubmission(row) {
        return {
            id: row.id,
            trackingCode: row.tracking_code,
            memberId: row.member_id,
            contact: row.contact || {},
            listing: row.listing || {},
            status: row.status || "PENDING",
            reviewNote: row.review_note || "",
            listingId: row.listing_id || "",
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    function rowToLead(row) {
        return {
            ...(row.data || {}),
            id: row.id,
            listingId: row.listing_id || row.data?.listingId || "",
            status: row.status || row.data?.status || "NEW",
            note: row.note || row.data?.note || "",
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    async function getListings(includeAll = false) {
        const query = includeAll
            ? "listings?select=*&order=updated_at.desc"
            : "listings?select=*&status=eq.PUBLIC&order=updated_at.desc";
        const rows = await rest(query, { method: "GET", prefer: "" });
        return Array.isArray(rows) ? rows.map(rowToListing) : [];
    }

    async function getSite() {
        const rows = await rest("site_settings?select=*&id=eq.main&limit=1", { method: "GET", prefer: "" });
        return rows?.[0]?.data || null;
    }

    async function getSubmissions() {
        const rows = await rest("submissions?select=*&order=created_at.desc", { method: "GET", prefer: "" });
        return Array.isArray(rows) ? rows.map(rowToSubmission) : [];
    }

    async function getLeads() {
        const rows = await rest("leads?select=*&order=created_at.desc", { method: "GET", prefer: "" });
        return Array.isArray(rows) ? rows.map(rowToLead) : [];
    }

    function buildAnalytics(listings, leads) {
        return {
            totals: { views: 0, calls: 0, zalo: 0, searches: 0 },
            topListings: listings.slice(0, 8).map((listing) => ({
                id: listing.id,
                title: listing.title,
                location: listing.location,
                metrics: {
                    views: 0,
                    leads: leads.filter((lead) => String(lead.listingId) === String(listing.id)).length,
                    calls: 0,
                    zalo: 0,
                    shares: 0,
                    conversionRate: 0
                },
                quality: { score: 70 }
            })),
            recentSearches: []
        };
    }

    async function adminBootstrap() {
        const [listings, site, leads, submissions] = await Promise.all([
            getListings(true),
            getSite(),
            getLeads(),
            getSubmissions()
        ]);
        return {
            user: { username: "admin" },
            listings,
            site: site || null,
            leads,
            submissions,
            analytics: buildAnalytics(listings, leads)
        };
    }

    async function saveSite(site) {
        const rows = await rest("site_settings", {
            method: "POST",
            body: JSON.stringify({ id: "main", data: site, updated_at: new Date().toISOString() }),
            headers: { Prefer: "resolution=merge-duplicates,return=representation" }
        });
        return { ok: true, site: rows?.[0]?.data || site };
    }

    async function saveListing(listing, listingId = "") {
        const next = {
            ...listing,
            id: listingId || listing.id || id("listing")
        };
        const coords = Array.isArray(next.coordinates) ? next.coordinates : [];
        const body = {
            id: next.id,
            data: next,
            status: "PUBLIC",
            location: Number.isFinite(Number(coords[0])) && Number.isFinite(Number(coords[1]))
                ? `SRID=4326;POINT(${Number(coords[1])} ${Number(coords[0])})`
                : null,
            updated_at: new Date().toISOString()
        };
        const rows = await rest("listings", {
            method: "POST",
            body: JSON.stringify(body),
            headers: { Prefer: "resolution=merge-duplicates,return=representation" }
        });
        return { ok: true, listing: rowToListing(rows[0]) };
    }

    async function deleteListing(listingId) {
        await rest(`listings?id=eq.${encodeURIComponent(listingId)}`, { method: "DELETE" });
        return { ok: true };
    }

    async function createSubmission(payload) {
        const submissionId = id("sub");
        const trackingCode = `NDV-${Date.now().toString(36).toUpperCase()}`;
        const contactPhone = sanitizePhone(payload.contactPhone);
        const listing = {
            id: payload.id || id("listing"),
            title: payload.title,
            location: payload.location,
            type: payload.type,
            price: payload.price,
            area: payload.area,
            frontage: payload.frontage,
            depth: payload.depth,
            roadWidth: payload.roadWidth,
            direction: payload.direction,
            beds: payload.beds,
            baths: payload.baths,
            legal: payload.legal,
            landUse: payload.landUse,
            planningStatus: payload.planningStatus,
            bankLoan: payload.bankLoan,
            description: payload.description,
            image: payload.image,
            images: payload.images || [],
            video: payload.video,
            coordinates: payload.coordinates,
            mapSummary: payload.mapSummary
        };
        const row = {
            id: submissionId,
            tracking_code: trackingCode,
            member_id: memberIdFromPhone(contactPhone),
            contact: {
                name: payload.contactName || "",
                phone: contactPhone,
                note: payload.contactNote || ""
            },
            listing,
            status: "PENDING"
        };
        const rows = await rest("submissions", { method: "POST", body: JSON.stringify(row) });
        return { ok: true, submission: rowToSubmission(rows[0]) };
    }

    async function memberSubmissions(phone, code) {
        const [submissions, leads] = await Promise.all([getSubmissions(), getLeads()]);
        const cleanPhone = sanitizePhone(phone);
        const owned = submissions.filter((item) => {
            const samePhone = cleanPhone && sanitizePhone(item.contact?.phone) === cleanPhone;
            const sameCode = code && (item.trackingCode === code || item.id === code);
            return samePhone || sameCode;
        });
        const listingIds = new Set(owned.filter((item) => item.status === "APPROVED" && item.listingId).map((item) => item.listingId));
        return {
            member: { phone: cleanPhone, memberId: memberIdFromPhone(cleanPhone) },
            submissions: owned,
            leads: leads.filter((lead) => listingIds.has(lead.listingId))
        };
    }

    async function updateSubmission(submissionId, payload) {
        const row = {
            listing: payload.listing || payload,
            contact: {
                name: payload.contactName || payload.name || "",
                phone: sanitizePhone(payload.contactPhone || payload.phone || ""),
                note: payload.contactNote || payload.note || ""
            },
            updated_at: new Date().toISOString()
        };
        const rows = await rest(`submissions?id=eq.${encodeURIComponent(submissionId)}&status=eq.PENDING`, {
            method: "PATCH",
            body: JSON.stringify(row)
        });
        return { ok: true, submission: rowToSubmission(rows[0]) };
    }

    async function reviewSubmission(submissionId, action, body = {}) {
        const submissions = await getSubmissions();
        const current = submissions.find((item) => item.id === submissionId);
        if (!current) throw new Error("Không tìm thấy hồ sơ.");
        if (action === "reject") {
            const rows = await rest(`submissions?id=eq.${encodeURIComponent(submissionId)}`, {
                method: "PATCH",
                body: JSON.stringify({ status: "REJECTED", review_note: body.reviewNote || "Từ chối", updated_at: new Date().toISOString() })
            });
            return { ok: true, submission: rowToSubmission(rows[0]) };
        }
        const saved = await saveListing({ ...current.listing, id: current.listing?.id || id("listing") });
        const rows = await rest(`submissions?id=eq.${encodeURIComponent(submissionId)}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "APPROVED", listing_id: saved.listing.id, updated_at: new Date().toISOString() })
        });
        return { ok: true, listing: saved.listing, submission: rowToSubmission(rows[0]) };
    }

    async function updateLead(leadId, payload) {
        const current = (await getLeads()).find((lead) => lead.id === leadId) || {};
        const rows = await rest(`leads?id=eq.${encodeURIComponent(leadId)}`, {
            method: "PATCH",
            body: JSON.stringify({
                status: payload.status || "NEW",
                note: payload.note || "",
                data: {
                    ...current,
                    ...(payload.data || {}),
                    temperature: payload.temperature || "COLD",
                    assignee: payload.assignee || "",
                    appointmentAt: payload.appointmentAt || "",
                    note: payload.note || ""
                },
                updated_at: new Date().toISOString()
            })
        });
        return { ok: true, lead: rowToLead(rows[0]) };
    }

    async function handleAdminRequest(url, options = {}) {
        const method = options.method || "GET";
        const body = options.body ? JSON.parse(options.body) : {};
        if (url === "/api/admin/bootstrap") return adminBootstrap();
        if (url === "/api/admin/site" && method === "PUT") return saveSite(body);
        if (url === "/api/admin/listings" && method === "POST") return saveListing(body);
        if (url.startsWith("/api/admin/listings/")) {
            const listingId = decodeURIComponent(url.replace("/api/admin/listings/", ""));
            if (method === "PUT") return saveListing(body, listingId);
            if (method === "DELETE") return deleteListing(listingId);
        }
        const submissionAction = url.match(/^\/api\/admin\/submissions\/([^/]+)\/(approve|reject)$/);
        if (submissionAction && method === "POST") return reviewSubmission(decodeURIComponent(submissionAction[1]), submissionAction[2], body);
        const submissionUpdate = url.match(/^\/api\/admin\/submissions\/([^/]+)$/);
        if (submissionUpdate && method === "PUT") return updateSubmission(decodeURIComponent(submissionUpdate[1]), body);
        const leadUpdate = url.match(/^\/api\/admin\/leads\/([^/]+)$/);
        if (leadUpdate && method === "PUT") return updateLead(decodeURIComponent(leadUpdate[1]), body);
        throw new Error("Chức năng Supabase này chưa được nối.");
    }

    window.NDV_SUPABASE = {
        init,
        isConfigured,
        getListings,
        getSite,
        createSubmission,
        memberSubmissions,
        updateSubmission,
        adminBootstrap,
        handleAdminRequest
    };
})();
