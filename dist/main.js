"use strict";
// Edit these to match your shop.
const BUSINESS_EMAIL = "orders@yourshop.com";
// ponytail: $75/hr is typical for small-shop CO2/diode laser work (US range ~$60–$120/hr).
const LASER_RATE_PER_HOUR = 75;
const LASER_MINIMUM = 25; // covers setup, file prep and material alignment
const BILLING_INCREMENT_MIN = 15;
const PIECES = [
    { title: "End-Grain Cutting Board", description: "Walnut, maple & cherry checkerboard, food-safe oil finish. 12\" × 18\".", priceFrom: 140 },
    { title: "Live-Edge Coffee Table", description: "Slab top with hairpin or trestle base, hand-rubbed finish.", priceFrom: 850 },
    { title: "Floating Wall Shelves", description: "Solid oak or walnut, hidden steel brackets. Priced per shelf.", priceFrom: 95 },
    { title: "Engraved Keepsake Box", description: "Dovetailed box with a laser-engraved lid — names, dates or artwork.", priceFrom: 120 },
    { title: "Custom Business Sign", description: "Laser-cut lettering on stained hardwood, ready to hang.", priceFrom: 180 },
    { title: "Charcuterie Board", description: "Long-grain board with handle and optional engraved monogram.", priceFrom: 75 },
];
const usd = (n) => n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: n % 1 ? 2 : 0 });
function laserQuote(minutes) {
    if (!(minutes > 0))
        return 0;
    const billedMin = Math.ceil(minutes / BILLING_INCREMENT_MIN) * BILLING_INCREMENT_MIN;
    return Math.max(LASER_MINIMUM, (billedMin / 60) * LASER_RATE_PER_HOUR);
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
        const quote = el("a", {
            href: mailto(`Quote request: ${p.title}`, `Hi,\n\nI'd like a quote for the "${p.title}" (listed from ${usd(p.priceFrom)}).\n\nSize / wood / finish:\nEngraving or custom details:\nNeeded by:\n\nThanks!`),
            textContent: "Request a quote",
        });
        root.append(el("article", { className: "piece" }, photo, el("h3", { textContent: p.title }), el("p", { textContent: p.description }), el("div", { className: "piece-foot" }, el("span", { textContent: `From ${usd(p.priceFrom)}` }), quote)));
    }
}
function initLaserCalc() {
    const minutes = document.getElementById("laser-minutes");
    const out = document.getElementById("laser-total");
    const book = document.getElementById("laser-book");
    const update = () => {
        const m = minutes.valueAsNumber;
        const total = laserQuote(m);
        out.textContent = usd(total);
        book.href = mailto("Laser job request", `Hi,\n\nI'd like to book about ${m || 0} minutes of laser time (estimate ${usd(total)}).\n\nMaterial:\nSize:\nArtwork attached: yes / no\n\nThanks!`);
    };
    minutes.addEventListener("input", update);
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
    initLaserCalc();
    document.getElementById("year").textContent = String(new Date().getFullYear());
}
// Self-check: `npm test` runs this file in Node, where there is no document.
console.assert(laserQuote(0) === 0, "zero minutes");
console.assert(laserQuote(5) === 25, "minimum charge");
console.assert(laserQuote(30) === 37.5, "half hour");
console.assert(laserQuote(31) === 56.25, "rounds up to 45 min");
console.assert(laserQuote(120) === 150, "two hours");
if (typeof document !== "undefined")
    init();
