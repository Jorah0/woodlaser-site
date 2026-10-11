"use strict";
// Edit these to match your shop.
const BUSINESS_EMAIL = "orders@yourshop.com";
// Form service URL (e.g. "https://formspree.io/f/abcdwxyz"). Empty = open the customer's email app instead.
const FORM_ENDPOINT = "";
// ponytail: $75/hr is typical for small-shop CO2/diode laser work (US range ~$60–$120/hr).
const LASER_RATE_PER_HOUR = 75;
const LASER_MINIMUM = 25; // covers setup, file prep and material alignment
const BILLING_INCREMENT_MIN = 15;
const RUSH_MULTIPLIER = 1.25;
const LASER_BED_IN = [24, 16]; // working area of your laser, width × height in inches
// Either orientation is fine: a 10 × 20 piece fits a 24 × 16 bed rotated.
const fitsBed = (w, h) => {
    const [bw, bh] = LASER_BED_IN;
    return (w <= bw && h <= bh) || (w <= bh && h <= bw);
};
const MATERIALS = [
    { name: "Baltic birch plywood, 1/8\"", engraveSqInPerMin: 3, cutInPerMin: 35, costPerSqIn: 0.04 },
    { name: "Hardwood (maple, walnut, cherry), 1/4\"", engraveSqInPerMin: 2.5, cutInPerMin: 12, costPerSqIn: 0.12 },
    { name: "Acrylic, 1/8\"", engraveSqInPerMin: 2.5, cutInPerMin: 20, costPerSqIn: 0.08 },
    { name: "Leather", engraveSqInPerMin: 4, cutInPerMin: 40, costPerSqIn: 0.15 },
    { name: "Cardboard", engraveSqInPerMin: 5, cutInPerMin: 60, costPerSqIn: 0.01 },
    { name: "Anodized aluminum (engrave only)", engraveSqInPerMin: 1.5, cutInPerMin: 0, costPerSqIn: 0.2 },
];
const COMPLEXITY = [
    { name: "Simple: text, outlines, basic shapes", factor: 0.5 },
    { name: "Moderate: logos, several elements", factor: 1 },
    { name: "Detailed: photos, fine art, dense patterns", factor: 1.6 },
];
// Price multiplier per species, relative to maple.
const WOODS = { Maple: 1, Oak: 1.05, Cherry: 1.15, Walnut: 1.3 };
const ENGRAVING_PRICE = 25;
const PIECES = [
    { title: "End-Grain Cutting Board", description: "Walnut, maple & cherry checkerboard, food-safe oil finish.", priceFrom: 140,
        sizes: [{ name: "12\" × 18\"", factor: 1 }, { name: "14\" × 20\"", factor: 1.3 }, { name: "16\" × 22\"", factor: 1.6 }], engraving: true },
    { title: "Live-Edge Coffee Table", description: "Slab top with hairpin or trestle base, hand-rubbed finish.", priceFrom: 850,
        woods: ["Maple", "Walnut"], sizes: [{ name: "36\" long", factor: 1 }, { name: "48\" long", factor: 1.35 }, { name: "60\" long", factor: 1.7 }] },
    { title: "Floating Wall Shelves", description: "Solid oak or walnut, hidden steel brackets. Priced per shelf.", priceFrom: 95,
        woods: ["Oak", "Walnut"], sizes: [{ name: "24\" wide", factor: 1 }, { name: "36\" wide", factor: 1.3 }, { name: "48\" wide", factor: 1.6 }] },
    { title: "Engraved Keepsake Box", description: "Dovetailed box with a laser-engraved lid — names, dates or artwork.", priceFrom: 120,
        woods: ["Maple", "Cherry", "Walnut"], sizes: [{ name: "Small (6\" × 4\")", factor: 1 }, { name: "Large (10\" × 7\")", factor: 1.4 }] },
    { title: "Custom Business Sign", description: "Laser-cut lettering on stained hardwood, ready to hang.", priceFrom: 180,
        woods: ["Oak", "Walnut"], sizes: [{ name: "12\" × 24\"", factor: 1 }, { name: "18\" × 36\"", factor: 1.6 }, { name: "24\" × 48\"", factor: 2.4 }] },
    { title: "Charcuterie Board", description: "Long-grain board with handle and optional engraved monogram.", priceFrom: 75,
        woods: ["Maple", "Cherry", "Walnut"], sizes: [{ name: "Standard (8\" × 16\")", factor: 1 }, { name: "Large (10\" × 22\")", factor: 1.4 }], engraving: true },
];
function piecePrice(p, c) {
    if (!(c.qty >= 1))
        return 0;
    // Relative to the cheapest wood this piece offers, so "From" stays the true lowest price.
    const woodFactor = p.woods ? WOODS[c.wood] / Math.min(...p.woods.map(w => WOODS[w])) : 1;
    const each = p.priceFrom * woodFactor * c.sizeFactor + (c.engraved ? ENGRAVING_PRICE : 0);
    return Math.round(each) * c.qty;
}
const usd = (n) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0 });
function laserEstimate(j) {
    const area = j.width * j.height;
    if (!(area > 0) || !(j.qty >= 1))
        return { minutes: 0, materialCost: 0, total: 0 };
    const cutting = j.job !== "engrave" && j.material.cutInPerMin > 0;
    const engraving = j.job !== "cut" || !cutting; // can't cut this material → engrave it
    // ponytail: cut path = bounding-box perimeter; complexity covers interior cuts. Ask for path length if quotes run off.
    const perPiece = (engraving ? area / j.material.engraveSqInPerMin : 0)
        + (cutting ? (2 * (j.width + j.height)) / j.material.cutInPerMin : 0);
    const minutes = perPiece * j.complexity * j.qty;
    const billedMin = Math.ceil(minutes / BILLING_INCREMENT_MIN) * BILLING_INCREMENT_MIN;
    const materialCost = j.ownMaterial ? 0 : area * j.material.costPerSqIn * j.qty;
    const subtotal = Math.max(LASER_MINIMUM, (billedMin / 60) * LASER_RATE_PER_HOUR + materialCost);
    return { minutes, materialCost, total: Math.round(subtotal * (j.rush ? RUSH_MULTIPLIER : 1) * 100) / 100 };
}
function mailto(subject, body) {
    return `mailto:${BUSINESS_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
function el(tag, props = {}, ...kids) {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...kids);
    return node;
}
function renderGallery(root) {
    for (const p of PIECES) {
        const photo = el("div", { className: "photo" });
        if (p.img) {
            const img = el("img", { src: p.img, alt: p.title, loading: "lazy" });
            img.onerror = () => img.remove(); // falls back to the plain wood-tone tile
            photo.append(img);
        }
        const form = el("form", { className: "form" });
        const price = el("output");
        const field = (name) => form.elements.namedItem(name);
        const select = (name, options) => el("select", { name }, ...options.map(([value, textContent]) => el("option", { value, textContent })));
        if (p.woods)
            form.append(el("label", {}, "Wood", select("wood", p.woods.map(w => [w, w]))));
        if (p.sizes)
            form.append(el("label", {}, "Size", select("size", p.sizes.map((s, i) => [String(i), s.name]))));
        if (p.engraving)
            form.append(el("label", { className: "check" }, el("input", { name: "engraved", type: "checkbox" }), `Add engraving (+${usd(ENGRAVING_PRICE)} each)`));
        form.append(el("label", {}, "Quantity", el("input", { name: "qty", type: "number", min: "1", step: "1", value: "1", inputMode: "numeric", required: true })), el("p", { className: "estimate" }, "Estimate ", price), el("button", { className: "btn btn-beam", type: "submit", textContent: "Add to request" }));
        const size = () => p.sizes?.[+field("size").value];
        const choice = () => ({
            wood: p.woods ? field("wood").value : "",
            sizeFactor: size()?.factor ?? 1,
            engraved: !!p.engraving && field("engraved").checked,
            qty: Math.floor(field("qty").valueAsNumber),
        });
        const update = () => (price.textContent = usd(piecePrice(p, choice())));
        form.addEventListener("input", update);
        form.addEventListener("submit", e => {
            e.preventDefault();
            const c = choice();
            addToRequest([
                `${p.title}: estimate ${usd(piecePrice(p, c))}`,
                ...(c.wood ? [`  Wood: ${c.wood}`] : []),
                ...(p.sizes ? [`  Size: ${size().name}`] : []),
                ...(p.engraving ? [`  Engraving: ${c.engraved ? "yes" : "no"}`] : []),
                `  Quantity: ${c.qty}`,
            ].join("\n"));
        });
        update();
        root.append(el("article", { className: "piece" }, photo, el("h3", { textContent: p.title }), el("p", { textContent: p.description }), el("details", { className: "config" }, el("summary", { className: "piece-foot" }, el("span", { textContent: `From ${usd(p.priceFrom)}` }), el("span", { className: "config-toggle", textContent: "Customize & price" })), form)));
    }
}
// Appends an item to the request form in #contact, so one email can cover several pieces.
function addToRequest(text) {
    const box = document.getElementById("request-form").elements.namedItem("request");
    box.value = box.value.trim() ? `${box.value.trimEnd()}\n\n${text}` : text;
    document.getElementById("contact").scrollIntoView();
    box.focus({ preventScroll: true });
}
function initRequestForm() {
    const form = document.getElementById("request-form");
    const status = document.getElementById("request-status");
    const button = form.querySelector("button");
    const field = (name) => form.elements.namedItem(name);
    document.getElementById("artwork-field").hidden = !FORM_ENDPOINT; // mailto can't carry attachments
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const subject = `Quote request from ${field("name").value}`;
        // ponytail: some mail apps cap mailto links around 2,000 characters; setting FORM_ENDPOINT avoids that.
        const body = [
            "Hi,", "", field("request").value.trim(), "",
            `Name: ${field("name").value}`,
            `Needed by: ${field("needed").value || "no deadline"}`,
            ...(FORM_ENDPOINT ? [] : ["", "(I'll attach any artwork or photos to this email.)"]),
        ].join("\n");
        if (!FORM_ENDPOINT)
            return void (location.href = mailto(subject, body));
        const data = new FormData(form);
        data.set("_subject", subject);
        button.disabled = true;
        status.textContent = "Sending…";
        try {
            const res = await fetch(FORM_ENDPOINT, { method: "POST", body: data, headers: { Accept: "application/json" } });
            if (!res.ok)
                throw new Error(`HTTP ${res.status}`);
            form.reset();
            status.textContent = "Sent. We'll reply within one business day.";
        }
        catch {
            // Keep what they typed; give them a way to send it anyway.
            status.replaceChildren("That didn't send. ", el("a", { href: mailto(subject, body), textContent: "Email it to us instead" }), ".");
        }
        finally {
            button.disabled = false;
        }
    });
}
function initLaserForm() {
    const form = document.getElementById("laser-form");
    const out = document.getElementById("laser-total");
    const breakdown = document.getElementById("laser-breakdown");
    const field = (name) => form.elements.namedItem(name);
    field("material").append(...MATERIALS.map(m => el("option", { value: m.name, textContent: m.name })));
    field("complexity").append(...COMPLEXITY.map((c, i) => el("option", { value: c.name, textContent: c.name, defaultSelected: i === 1 })));
    const readJob = () => ({
        material: MATERIALS.find(m => m.name === field("material").value),
        job: field("job").value,
        width: field("width").valueAsNumber,
        height: field("height").valueAsNumber,
        complexity: COMPLEXITY.find(c => c.name === field("complexity").value).factor,
        qty: Math.floor(field("qty").valueAsNumber),
        ownMaterial: field("own").checked,
        rush: field("rush").checked,
    });
    const summary = () => {
        const j = readJob(), est = laserEstimate(j);
        return [
            `Laser job: estimate ${usd(est.total)} (about ${Math.round(est.minutes)} min of machine time)`,
            `  Material: ${j.material.name} (${j.ownMaterial ? "I'll supply it" : "shop-sourced"})`,
            `  Job: ${form.elements.namedItem("job").selectedOptions[0].text}`,
            `  Size: ${j.width} × ${j.height} in, quantity ${j.qty}`,
            `  Complexity: ${field("complexity").value}`,
            `  Rush: ${j.rush ? "yes" : "no"}`,
            ...(fitsBed(j.width, j.height) ? [] : ["  Note: larger than the laser bed, needs a custom quote"]),
        ].join("\n");
    };
    const update = () => {
        const j = readJob(), est = laserEstimate(j);
        out.textContent = usd(est.total);
        breakdown.textContent = !est.total
            ? "Enter a size and quantity."
            : !fitsBed(j.width, j.height)
                ? `That's bigger than our ${LASER_BED_IN.join(" × ")} in bed. We may be able to tile it or cut it in sections, so send it over and we'll quote it by hand.`
                : `About ${Math.round(est.minutes)} min of machine time · ${usd(est.materialCost)} material. Final price confirmed after we review your files.`;
    };
    form.addEventListener("input", update);
    form.addEventListener("submit", e => {
        e.preventDefault();
        addToRequest(summary());
    });
    update();
}
// Wood grain that drifts slowly while a laser line sweeps across, leaving a warm glow that fades back.
function initGrain(canvas) {
    const ctx = canvas.getContext("2d");
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SPACING = 13, SWEEP_MS = 9000, TRAIL = 320;
    let w = 0, h = 0;
    const resize = () => {
        const dpr = Math.min(devicePixelRatio, 2);
        w = canvas.clientWidth;
        h = canvas.clientHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const grain = (t) => {
        const path = new Path2D();
        const kx = w * 0.72, ky = h * 0.45; // a knot the lines bend around
        for (let base = -30; base < h + 30; base += SPACING) {
            const side = Math.sign(base - ky) || 1;
            const pull = 46 * Math.exp(-Math.abs(base - ky) / 90);
            for (let x = 0; x <= w + 8; x += 8) {
                const y = base
                    + Math.sin(x * 0.0035 + base * 0.021 + t * 0.00012) * 11
                    + Math.sin(x * 0.011 + base * 0.047) * 3
                    + side * pull * Math.exp(-((x - kx) ** 2) / 28000);
                x ? path.lineTo(x, y) : path.moveTo(x, y);
            }
        }
        return path;
    };
    const draw = (t) => {
        const path = grain(t);
        const lx = ((t % SWEEP_MS) / SWEEP_MS) * (w + TRAIL + 120) - 60;
        ctx.clearRect(0, 0, w, h);
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = "rgba(217, 185, 140, 0.32)";
        ctx.stroke(path);
        // Burned trail: same lines, brighter and warmer just behind the beam.
        const trail = ctx.createLinearGradient(lx - TRAIL, 0, lx, 0);
        trail.addColorStop(0, "rgba(217, 185, 140, 0)");
        trail.addColorStop(1, "rgba(255, 150, 50, 0.95)");
        ctx.save();
        ctx.beginPath();
        ctx.rect(lx - TRAIL, 0, TRAIL, h);
        ctx.clip();
        ctx.strokeStyle = trail;
        ctx.lineWidth = 1.6;
        ctx.stroke(path);
        ctx.restore();
        // The beam itself: soft glow plus a bright core.
        const glow = ctx.createLinearGradient(lx - 40, 0, lx + 40, 0);
        glow.addColorStop(0, "rgba(255, 138, 31, 0)");
        glow.addColorStop(0.5, "rgba(255, 138, 31, 0.35)");
        glow.addColorStop(1, "rgba(255, 138, 31, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(lx - 40, 0, 80, h);
        ctx.fillStyle = "rgba(255, 226, 190, 0.9)";
        ctx.fillRect(lx - 1, 0, 2, h);
    };
    resize();
    addEventListener("resize", () => { resize(); if (still)
        draw(SWEEP_MS * 0.8); });
    if (still)
        return draw(SWEEP_MS * 0.8);
    // ponytail: rAF already pauses in background tabs; add an IntersectionObserver if scrolled-away CPU matters.
    const loop = (t) => { draw(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
}
function init() {
    initGrain(document.getElementById("grain"));
    document.querySelectorAll("[data-rate]").forEach(n => (n.textContent = usd(LASER_RATE_PER_HOUR)));
    document.querySelectorAll("[data-minimum]").forEach(n => (n.textContent = usd(LASER_MINIMUM)));
    document.querySelectorAll("[data-email]").forEach(a => {
        a.href = `mailto:${BUSINESS_EMAIL}`;
        a.textContent = BUSINESS_EMAIL;
    });
    renderGallery(document.getElementById("gallery"));
    initLaserForm();
    initRequestForm();
    document.getElementById("year").textContent = String(new Date().getFullYear());
}
if (typeof document !== "undefined")
    init();
else {
    // Self-check: `npm test` runs this file in Node, where there is no document. A throw exits non-zero.
    const [ply, hardwood, , , , aluminum] = MATERIALS;
    const base = { material: ply, job: "engrave", width: 6, height: 4, complexity: 1, qty: 1, ownMaterial: false, rush: false };
    const check = (j, want, why) => {
        const got = laserEstimate({ ...base, ...j }).total;
        if (got !== want)
            throw new Error(`${why}: expected ${want}, got ${got}`);
    };
    check({ width: 0 }, 0, "no size");
    check({}, 25, "small job hits minimum");
    check({ rush: true }, 31.25, "rush on top of minimum");
    check({ material: hardwood, width: 12, height: 12, ownMaterial: true }, 75, "57.6 min bills as 60");
    check({ material: hardwood, width: 12, height: 12 }, 92.28, "plus material");
    check({ material: hardwood, job: "both", width: 12, height: 12, complexity: 1.6, qty: 10 }, 1410.3, "detailed batch");
    check({ material: aluminum, job: "cut", width: 10, height: 10, ownMaterial: true }, 93.75, "uncuttable falls back to engrave");
    if (!fitsBed(24, 16) || !fitsBed(16, 24) || fitsBed(25, 10) || fitsBed(20, 20))
        throw new Error("bed fit check");
    const shelf = { title: "t", description: "", priceFrom: 100, woods: ["Oak", "Walnut"] };
    const one = { wood: "Oak", sizeFactor: 1, engraved: false, qty: 1 };
    const checkPiece = (p, c, want, why) => {
        const got = piecePrice(p, { ...one, ...c });
        if (got !== want)
            throw new Error(`${why}: expected ${want}, got ${got}`);
    };
    checkPiece(shelf, {}, 100, "cheapest listed wood is the From price");
    checkPiece(shelf, { wood: "Walnut", sizeFactor: 1.5, engraved: true, qty: 2 }, 422, "wood × size + engraving, per piece");
    checkPiece({ ...shelf, woods: undefined }, { wood: "" }, 100, "no wood choice");
    checkPiece(shelf, { qty: NaN }, 0, "empty quantity");
    console.log("pricing checks passed");
}
