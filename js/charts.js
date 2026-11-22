// Minimal accessible SVG charts (single series, so no categorical palette).
// Every value is also available in a table view built by the caller.

const NS = 'http://www.w3.org/2000/svg';
const el = (name, attrs = {}) => {
    const n = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
};

/**
 * Line chart for a 0..1 series. points: [{label, value, detail}]
 */
export function lineChart(container, points, { ariaLabel, format = (v) => Math.round(v * 100) + '%' } = {}) {
    container.innerHTML = '';
    container.classList.add('chart');
    const W = 640, H = 220, L = 44, R = 16, T = 14, B = 28;
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': ariaLabel, tabindex: '0', class: 'chart__svg' });
    const x = (i) => L + (points.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (points.length - 1));
    const y = (v) => T + (1 - v) * (H - T - B);
    for (const g of [0, 0.5, 1]) {
        svg.append(el('line', { x1: L, x2: W - R, y1: y(g), y2: y(g), class: 'chart__grid' }));
        const lab = el('text', { x: L - 8, y: y(g) + 4, class: 'chart__axis', 'text-anchor': 'end' });
        lab.textContent = format(g);
        svg.append(lab);
    }
    const first = el('text', { x: L, y: H - 8, class: 'chart__axis' });
    first.textContent = points[0].label;
    svg.append(first);
    if (points.length > 1) {
        const last = el('text', { x: W - R, y: H - 8, class: 'chart__axis', 'text-anchor': 'end' });
        last.textContent = points[points.length - 1].label;
        svg.append(last);
    }
    if (points.length > 1)
        svg.append(el('polyline', { points: points.map((p, i) => `${x(i)},${y(p.value)}`).join(' '), class: 'chart__line' }));
    for (const [i, p] of points.entries()) svg.append(el('circle', { cx: x(i), cy: y(p.value), r: 4, class: 'chart__dot' }));
    const cross = el('line', { y1: T, y2: H - B, class: 'chart__cross', visibility: 'hidden' });
    const ring = el('circle', { r: 6, class: 'chart__ring', visibility: 'hidden' });
    svg.append(cross, ring);

    const tip = document.createElement('div');
    tip.className = 'chart__tip';
    tip.hidden = true;
    container.append(svg, tip);

    let current = -1;
    const show = (i) => {
        current = i;
        const p = points[i];
        cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
        ring.setAttribute('cx', x(i)); ring.setAttribute('cy', y(p.value));
        cross.setAttribute('visibility', 'visible'); ring.setAttribute('visibility', 'visible');
        tip.replaceChildren();
        const strong = document.createElement('strong'); strong.textContent = format(p.value);
        const small = document.createElement('span'); small.textContent = p.label + (p.detail ? ' · ' + p.detail : '');
        tip.append(strong, small);
        tip.hidden = false;
        const box = svg.getBoundingClientRect();
        const px = (x(i) / W) * box.width;
        tip.style.left = Math.min(Math.max(px, 60), box.width - 60) + 'px';
        tip.style.top = ((y(p.value) / H) * box.height - 8) + 'px';
    };
    const hide = () => { cross.setAttribute('visibility', 'hidden'); ring.setAttribute('visibility', 'hidden'); tip.hidden = true; };
    svg.addEventListener('pointermove', (e) => {
        const box = svg.getBoundingClientRect();
        const vx = ((e.clientX - box.left) / box.width) * W;
        let best = 0, bd = Infinity;
        points.forEach((_, i) => { const d = Math.abs(x(i) - vx); if (d < bd) { bd = d; best = i; } });
        show(best);
    });
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('focus', () => show(points.length - 1));
    svg.addEventListener('blur', hide);
    svg.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') { show(Math.max(0, current - 1)); e.preventDefault(); }
        if (e.key === 'ArrowRight') { show(Math.min(points.length - 1, current + 1)); e.preventDefault(); }
    });
}

/** Horizontal bars, one per row: [{label, value (0..1|null), text, detail}] */
export function barList(container, rows) {
    container.innerHTML = '';
    container.classList.add('bars');
    for (const r of rows) {
        const row = document.createElement('div');
        row.className = 'bars__row';
        row.tabIndex = 0;
        const label = document.createElement('span'); label.className = 'bars__label'; label.textContent = r.label;
        const track = document.createElement('span'); track.className = 'bars__track';
        const fill = document.createElement('span'); fill.className = 'bars__fill';
        fill.style.width = r.value === null ? '0' : Math.max(2, r.value * 100) + '%';
        track.append(fill);
        const val = document.createElement('span'); val.className = 'bars__value'; val.textContent = r.text;
        row.setAttribute('aria-label', `${r.label}: ${r.text}${r.detail ? ', ' + r.detail : ''}`);
        if (r.detail) row.title = r.detail;
        row.append(label, track, val);
        container.append(row);
    }
}
