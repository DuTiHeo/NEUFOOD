// SNOW EFFECT 

// tạo bột tuyết
function initSnow() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let canvas = document.getElementById('snowCanvas');
    if (!canvas) {
        canvas = document.createElement('canvas');
        canvas.id = 'snowCanvas';
        canvas.className = 'snow-canvas';
        document.body.appendChild(canvas);
    }

    const ctx = canvas.getContext('2d');
    let width, height, flakes, flakeCount;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        const density = Math.min(260, Math.max(90, Math.floor((width * height) / 20000)));
        flakeCount = density;
        createFlakes();
    }
    // tạo bột tuyết
    function createFlakes() {
        flakes = new Array(flakeCount).fill(0).map(() => ({
            x: Math.random() * width,
            y: Math.random() * height,
            r: 0.9 + Math.random() * 2.6,
            s: 0.35 + Math.random() * 1.0,
            w: 0.5 + Math.random() * 1.5,
            a: Math.random() * Math.PI * 2
        }));
    }

    // vẽ bột tuyết
    function draw() {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        for (let i = 0; i < flakeCount; i++) {
            const f = flakes[i];
            f.y += f.s; // rơi
            f.a += 0.01; // lệch
            f.x += Math.sin(f.a) * f.w * 0.3; // lệch ngang

            // vòng tròn lại nếu rơi ra ngoài
            if (f.y > height + 5) {
                f.y = -5;
                f.x = Math.random() * width;
            }
            if (f.x > width + 5) { f.x = -5; }
            if (f.x < -5) { f.x = width + 5; }

            // vẽ bột tuyết
            ctx.moveTo(f.x, f.y);
            ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        }
        ctx.fill();
        requestAnimationFrame(draw);
    }

    resize();
    draw();
    window.addEventListener('resize', resize);
}

export { initSnow };