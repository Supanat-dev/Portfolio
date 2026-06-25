/* ============================================
   SCRIPT.JS — Portfolio v2
   Three.js + GSAP + Particles + Concierge
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {

  // ===== PARTICLE TEXT WELCOME SCREEN =====
  const welcomeScreen = document.getElementById('welcomeScreen');
  const ptCanvas = document.getElementById('particleTextCanvas');
  const enterBtn = document.getElementById('enterPortfolioBtn');
  const progressBarEl = document.getElementById('welcomeProgressBar');
  const ptCtx = ptCanvas ? ptCanvas.getContext('2d') : null;

  // Responsive internal canvas resolution
  const isMobileCanvas = window.innerWidth < 768;
  const CANVAS_W = isMobileCanvas ? 600 : 1200;
  const CANVAS_H = isMobileCanvas ? 1000 : 600;

  if (ptCanvas) {
    ptCanvas.width = CANVAS_W;
    ptCanvas.height = CANVAS_H;
  }

  // -- Particle Class --
  class WelcomeParticle {
    constructor() {
      this.posX = 0; this.posY = 0;
      this.velX = 0; this.velY = 0;
      this.accX = 0; this.accY = 0;
      this.targetX = 0; this.targetY = 0;
      this.closeEnoughTarget = 100;
      this.maxSpeed = 1.0;
      this.maxForce = 0.1;
      this.isKilled = false;
      this.sR = 0; this.sG = 0; this.sB = 0;
      this.tR = 0; this.tG = 0; this.tB = 0;
      this.colorWeight = 0;
      this.colorBlendRate = 0.01;
    }

    move() {
      let proximityMult = 1;
      const dx = this.posX - this.targetX;
      const dy = this.posY - this.targetY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < this.closeEnoughTarget) proximityMult = dist / this.closeEnoughTarget;

      let twX = this.targetX - this.posX;
      let twY = this.targetY - this.posY;
      const mag = Math.sqrt(twX * twX + twY * twY);
      if (mag > 0) {
        twX = (twX / mag) * this.maxSpeed * proximityMult;
        twY = (twY / mag) * this.maxSpeed * proximityMult;
      }

      let stX = twX - this.velX;
      let stY = twY - this.velY;
      const sMag = Math.sqrt(stX * stX + stY * stY);
      if (sMag > 0) {
        stX = (stX / sMag) * this.maxForce;
        stY = (stY / sMag) * this.maxForce;
      }

      this.accX += stX;
      this.accY += stY;
      this.velX += this.accX;
      this.velY += this.accY;
      this.posX += this.velX;
      this.posY += this.velY;
      this.accX = 0;
      this.accY = 0;
    }

    draw(ctx) {
      if (this.colorWeight < 1.0) {
        this.colorWeight = Math.min(this.colorWeight + this.colorBlendRate, 1.0);
      }
      const r = Math.round(this.sR + (this.tR - this.sR) * this.colorWeight);
      const g = Math.round(this.sG + (this.tG - this.sG) * this.colorWeight);
      const b = Math.round(this.sB + (this.tB - this.sB) * this.colorWeight);
      ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
      ctx.fillRect(this.posX, this.posY, 1, 1);
    }

    kill() {
      if (!this.isKilled) {
        const rp = ptRandomPos(CANVAS_W / 2, CANVAS_H / 2, (CANVAS_W + CANVAS_H) / 2);
        this.targetX = rp.x;
        this.targetY = rp.y;
        this.sR = this.sR + (this.tR - this.sR) * this.colorWeight;
        this.sG = this.sG + (this.tG - this.sG) * this.colorWeight;
        this.sB = this.sB + (this.tB - this.sB) * this.colorWeight;
        this.tR = 0; this.tG = 0; this.tB = 0;
        this.colorWeight = 0;
        this.isKilled = true;
      }
    }
  }

  function ptRandomPos(cx, cy, mag) {
    const rx = Math.random() * CANVAS_W;
    const ry = Math.random() * CANVAS_H;
    let dx = rx - cx, dy = ry - cy;
    const m = Math.sqrt(dx * dx + dy * dy);
    if (m > 0) { dx = (dx / m) * mag; dy = (dy / m) * mag; }
    return { x: cx + dx, y: cy + dy };
  }

  // -- State --
  const ptParticles = [];
  const ptColor = { r: 147, g: 197, b: 253 }; // Light blue particle core
  let ptAnimId = null;
  
  // Responsive Performance Optimization
  const isMobile = isMobileCanvas;
  const ptPixelSteps = isMobile ? 2 : 1; // Moderate density (2x2 grid) on mobile, Maximum (1x1) on desktop

  // Add CSS glow to the canvas (simplified on mobile to save GPU)
  if (ptCanvas) {
    if (isMobile) {
      ptCanvas.style.filter = "drop-shadow(0 0 4px rgba(147, 197, 253, 0.4))";
    } else {
      ptCanvas.style.filter = "drop-shadow(0 0 4px rgba(147, 197, 253, 0.4)) drop-shadow(0 0 12px rgba(59, 130, 246, 0.3))";
    }
  }

  function ptRenderText() {
    // Offscreen canvas for text pixel scan
    const offC = document.createElement('canvas');
    offC.width = CANVAS_W;
    offC.height = CANVAS_H;
    const offCtx = offC.getContext('2d');

    offCtx.fillStyle = 'white';
    offCtx.textAlign = 'center';

    if (isMobileCanvas) {
      // Mobile: Portrait layout (600x1000) — larger relative text, more lines
      offCtx.font = '900 72px Arial, sans-serif';
      offCtx.fillText('Welcome to', CANVAS_W / 2, CANVAS_H * 0.22);

      offCtx.font = '900 80px Arial, sans-serif';
      offCtx.fillText('Supanat', CANVAS_W / 2, CANVAS_H * 0.38);

      offCtx.font = '900 68px Arial, sans-serif';
      offCtx.fillText("Mekmosuik's", CANVAS_W / 2, CANVAS_H * 0.52);

      offCtx.font = '900 90px Arial, sans-serif';
      offCtx.fillText('Portfolio', CANVAS_W / 2, CANVAS_H * 0.68);
    } else {
      // Desktop: Landscape layout (1200x600) — original
      offCtx.font = '900 65px Arial, sans-serif';
      offCtx.fillText('Welcome to', CANVAS_W / 2, CANVAS_H * 0.28);

      offCtx.font = '900 85px Arial, sans-serif';
      offCtx.fillText("Supanat Mekmosuik's", CANVAS_W / 2, CANVAS_H * 0.50);

      offCtx.font = '900 95px Arial, sans-serif';
      offCtx.fillText('Portfolio', CANVAS_W / 2, CANVAS_H * 0.72);
    }

    const imgData = offCtx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    const pixels = imgData.data;

    let pIdx = 0;
    const coords = [];
    
    // Uniform 2D grid sampling
    for (let y = 0; y < CANVAS_H; y += ptPixelSteps) {
      for (let x = 0; x < CANVAS_W; x += ptPixelSteps) {
        const idx = (y * CANVAS_W + x) * 4;
        // Check alpha channel > 200 (only the sharpest core of the text)
        if (pixels[idx + 3] > 200) {
          coords.push({ x, y });
        }
      }
    }

    // Shuffle for fluid motion
    for (let i = coords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = coords[i]; coords[i] = coords[j]; coords[j] = tmp;
    }

    for (let ci = 0; ci < coords.length; ci++) {
      const { x, y } = coords[ci];

      let p;
      if (pIdx < ptParticles.length) {
        p = ptParticles[pIdx];
        p.isKilled = false;
        pIdx++;
      } else {
        p = new WelcomeParticle();
        const rp = ptRandomPos(CANVAS_W / 2, CANVAS_H / 2, (CANVAS_W + CANVAS_H) / 2);
        p.posX = rp.x;
        p.posY = rp.y;
        p.maxSpeed = Math.random() * 4 + 2; // Tighter speed
        p.maxForce = p.maxSpeed * 0.1;      // Tighter snapping
        p.colorBlendRate = Math.random() * 0.0275 + 0.0025;
        ptParticles.push(p);
      }

      // Color — slight variation per particle for depth
      const variation = (Math.random() - 0.5) * 40;
      p.sR = p.sR + (p.tR - p.sR) * p.colorWeight;
      p.sG = p.sG + (p.tG - p.sG) * p.colorWeight;
      p.sB = p.sB + (p.tB - p.sB) * p.colorWeight;
      p.tR = Math.min(255, Math.max(0, ptColor.r + variation));
      p.tG = Math.min(255, Math.max(0, ptColor.g + variation * 0.6));
      p.tB = Math.min(255, Math.max(0, ptColor.b + variation * 0.3));
      p.colorWeight = 0;

      p.targetX = x;
      p.targetY = y;
    }

    // Kill remaining
    for (let i = pIdx; i < ptParticles.length; i++) {
      ptParticles[i].kill();
    }
  }

  function ptAnimate() {
    if (!ptCtx) return;

    // Motion blur (lower alpha = longer trails/more glow)
    ptCtx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    ptCtx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Update and draw
    for (let i = ptParticles.length - 1; i >= 0; i--) {
      const p = ptParticles[i];
      p.move();
      p.draw(ptCtx);

      if (p.isKilled) {
        if (p.posX < -50 || p.posX > CANVAS_W + 50 || p.posY < -50 || p.posY > CANVAS_H + 50) {
          ptParticles.splice(i, 1);
        }
      }
    }

    ptAnimId = requestAnimationFrame(ptAnimate);
  }

  // -- Hide Welcome Screen --
  function hideWelcomeScreen() {
    // Kill all particles for dramatic exit
    for (let i = 0; i < ptParticles.length; i++) {
      ptParticles[i].kill();
    }

    setTimeout(function() {
      if (welcomeScreen) welcomeScreen.classList.add('fade-out');
      setTimeout(function() {
        if (welcomeScreen) welcomeScreen.style.display = 'none';
        if (ptAnimId) cancelAnimationFrame(ptAnimId);
        ptParticles.length = 0;
        startMainAnimations();
      }, 1000);
    }, 500);
  }

  // Enter button
  if (enterBtn) {
    enterBtn.addEventListener('click', function(e) {
      e.preventDefault();
      hideWelcomeScreen();
    });

    // Liquid Glass Button Mouse Tracking
    if (typeof gsap !== 'undefined') {
      const xTo = gsap.quickTo(enterBtn, "x", { duration: 0.8, ease: "elastic.out(1, 0.5)" });
      const yTo = gsap.quickTo(enterBtn, "y", { duration: 0.8, ease: "elastic.out(1, 0.5)" });

      window.addEventListener('mousemove', function(e) {
        if (welcomeScreen.style.display !== 'none' && !welcomeScreen.classList.contains('fade-out')) {
          const x = e.clientX - window.innerWidth / 2;
          const y = e.clientY - window.innerHeight / 2;
          xTo(x / 10);
          yTo(y / 10);
        }
      });
    }
  }

  // -- Initialize Particle Text --
  if (ptCanvas && ptCtx) {
    ptRenderText();
    ptAnimate();
  }

  // Auto-enter after ~20 seconds
  setTimeout(function() {
    if (welcomeScreen && !welcomeScreen.classList.contains('fade-out')) {
      hideWelcomeScreen();
    }
  }, 20000);

  // ===== 1. ANIMATED PATHS BACKGROUND (Canvas 2D) =====
  const bgCanvas = document.getElementById('threeBg');
  if (bgCanvas) {
    const bgCtx = bgCanvas.getContext('2d');

    function resizeBgCanvas() {
      bgCanvas.width = window.innerWidth;
      bgCanvas.height = window.innerHeight;
    }
    resizeBgCanvas();

    // Pre-calculate all path control points (same curves as original)
    const bgPaths = [];
    [1, -1].forEach(function(position) {
      for (let i = 0; i < 36; i++) {
        bgPaths.push({
          // moveTo
          mx: -(380 - i * 5 * position),
          my: -(189 + i * 6),
          // first bezierCurveTo
          c1x: -(380 - i * 5 * position),
          c1y: -(189 + i * 6),
          c2x: -(312 - i * 5 * position),
          c2y: 216 - i * 6,
          ex:  152 - i * 5 * position,
          ey:  343 - i * 6,
          // second bezierCurveTo
          c3x: 616 - i * 5 * position,
          c3y: 470 - i * 6,
          c4x: 684 - i * 5 * position,
          c4y: 875 - i * 6,
          // rendering properties
          opacity: 0.02 + i * 0.005,
          width: 0.5 + i * 0.03,
          speed: 12 + (i % 7) * 4,
          offset: i * 60,
        });
      }
    });

    const DASH = 600;

    function animateBgPaths(time) {
      requestAnimationFrame(animateBgPaths);
      const w = bgCanvas.width, h = bgCanvas.height;
      if (w === 0 || h === 0) return;

      bgCtx.clearRect(0, 0, w, h);

      // Map viewBox(0 0 696 316) → fill entire canvas (like SVG slice)
      const scale = Math.max(w / 696, h / 316);
      const ox = (w - 696 * scale) / 2;
      const oy = (h - 316 * scale) / 2;

      bgCtx.save();
      bgCtx.translate(ox, oy);
      bgCtx.scale(scale, scale);
      bgCtx.lineCap = 'round';

      const t = time / 1000;

      for (let j = 0; j < bgPaths.length; j++) {
        const p = bgPaths[j];
        bgCtx.beginPath();
        bgCtx.moveTo(p.mx, p.my);
        bgCtx.bezierCurveTo(p.c1x, p.c1y, p.c2x, p.c2y, p.ex, p.ey);
        bgCtx.bezierCurveTo(p.c3x, p.c3y, p.c4x, p.c4y, p.c4x, p.c4y);
        bgCtx.strokeStyle = 'rgba(59,130,246,' + p.opacity + ')';
        bgCtx.lineWidth = p.width;
        bgCtx.setLineDash([DASH * 0.35, DASH * 0.65]);
        bgCtx.lineDashOffset = -(t * p.speed) + p.offset;
        bgCtx.stroke();
      }

      bgCtx.restore();
    }

    requestAnimationFrame(animateBgPaths);
    window.addEventListener('resize', resizeBgCanvas);
  }

  // ===== 2. INTERACTIVE PARTICLES =====
  const pCanvas = document.getElementById('particleCanvas');
  const pCtx = pCanvas.getContext('2d');
  let particles = [];
  const pMouse = { x: -1000, y: -1000 };

  function resizeParticles() {
    pCanvas.width = window.innerWidth;
    pCanvas.height = window.innerHeight;
    initParticles();
  }

  function initParticles() {
    particles = [];
    const count = Math.min(80, Math.floor(window.innerWidth * window.innerHeight / 15000));
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * pCanvas.width,
        y: Math.random() * pCanvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 2 + 1,
        alpha: Math.random() * 0.3 + 0.1
      });
    }
  }

  function drawParticles() {
    pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);
    particles.forEach((p, i) => {
      // Mouse repulsion
      const dx = p.x - pMouse.x;
      const dy = p.y - pMouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150) {
        const force = (150 - dist) / 150;
        p.vx += (dx / dist) * force * 0.3;
        p.vy += (dy / dist) * force * 0.3;
      }
      p.vx *= 0.98; p.vy *= 0.98;
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = pCanvas.width;
      if (p.x > pCanvas.width) p.x = 0;
      if (p.y < 0) p.y = pCanvas.height;
      if (p.y > pCanvas.height) p.y = 0;

      pCtx.beginPath();
      pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      pCtx.fillStyle = `rgba(59,130,246,${p.alpha})`;
      pCtx.fill();

      // Connect nearby particles
      for (let j = i + 1; j < particles.length; j++) {
        const p2 = particles[j];
        const d = Math.hypot(p.x - p2.x, p.y - p2.y);
        if (d < 120) {
          pCtx.beginPath();
          pCtx.moveTo(p.x, p.y);
          pCtx.lineTo(p2.x, p2.y);
          pCtx.strokeStyle = `rgba(59,130,246,${0.06 * (1 - d / 120)})`;
          pCtx.lineWidth = 0.5;
          pCtx.stroke();
        }
      }
    });
    requestAnimationFrame(drawParticles);
  }

  document.addEventListener('mousemove', e => { pMouse.x = e.clientX; pMouse.y = e.clientY; });
  resizeParticles();
  drawParticles();
  window.addEventListener('resize', resizeParticles);

  // ===== 3. GSAP SCROLL ANIMATIONS =====
  gsap.registerPlugin(ScrollTrigger);

  // Function to start main animations after welcome screen
  function startMainAnimations() {
    // Scroll animations
    gsap.utils.toArray('.anim-reveal').forEach((el, i) => {
      gsap.fromTo(el,
        { opacity: 0, y: 50 },
        {
          opacity: 1, y: 0, duration: 0.8,
          ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 85%', toggleActions: 'play none none none' },
          delay: i % 5 * 0.1
        }
      );
    });

    // Hero animations (immediate after welcome screen)
    gsap.fromTo('.hero .anim-reveal',
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.12, delay: 0.2 }
    );
  }

  // Initialize animations immediately if welcome screen is not present
  if (!welcomeScreen || welcomeScreen.style.display === 'none') {
    startMainAnimations();
  }

  // ===== 4. SCROLL PROGRESS =====
  const scrollProgress = document.getElementById('scrollProgress');
  function updateProgress() {
    const h = document.documentElement.scrollHeight - window.innerHeight;
    scrollProgress.style.width = (h > 0 ? (window.scrollY / h) * 100 : 0) + '%';
  }
  window.addEventListener('scroll', updateProgress, { passive: true });

  // ===== 5. NAVBAR =====
  const navbar = document.getElementById('navbar');
  const navLinks = document.querySelectorAll('.nav-links a');
  const sections = document.querySelectorAll('.section, .hero');

  function updateNav() {
    navbar.classList.toggle('scrolled', window.scrollY > 30);
    let cur = '';
    sections.forEach(s => { if (window.scrollY >= s.offsetTop - 120) cur = s.id; });
    navLinks.forEach(l => l.classList.toggle('active', l.dataset.section === cur));
  }
  window.addEventListener('scroll', updateNav, { passive: true });

  const navToggle = document.getElementById('navToggle');
  const navLinksEl = document.getElementById('navLinks');
  navToggle.addEventListener('click', () => {
    navLinksEl.classList.toggle('open');
    navToggle.classList.toggle('open');
  });
  navLinksEl.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
    navLinksEl.classList.remove('open');
    navToggle.classList.remove('open');
  }));

  // ===== 6. DOT NAV =====
  const dotItems = document.querySelectorAll('.dot-nav-item');
  const sectionIds = ['hero', 'about', 'sop', 'projects', 'achievements', 'contact'];

  function updateDots() {
    let idx = 0;
    sectionIds.forEach((id, i) => {
      const s = document.getElementById(id);
      if (s && window.scrollY >= s.offsetTop - 200) idx = i;
    });
    dotItems.forEach((d, i) => d.classList.toggle('active', i === idx));
  }
  window.addEventListener('scroll', updateDots, { passive: true });
  dotItems.forEach(d => d.addEventListener('click', () => {
    const t = document.querySelector(d.dataset.target);
    if (t) t.scrollIntoView({ behavior: 'smooth' });
  }));

  // ===== 7. PROJECT CARD TILT =====
  document.querySelectorAll('[data-tilt]').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.transform = `translateY(-8px) perspective(600px) rotateX(${-y * 6}deg) rotateY(${x * 6}deg)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });

  // ===== 8. RADAR CHART =====
  const rc = document.getElementById('radarChart');
  if (rc) {
    const ctx = rc.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const sz = 440;
    rc.width = sz * dpr; rc.height = sz * dpr;
    rc.style.width = sz + 'px'; rc.style.height = sz + 'px';
    ctx.scale(dpr, dpr);
    const cx = sz / 2, cy = sz / 2, mr = 160;
    const skills = [
      { l: 'Python', v: 0.85 }, { l: 'C/C++', v: 0.70 }, { l: 'Robotics', v: 0.75 },
      { l: 'IoT', v: 0.65 }, { l: 'Web Dev', v: 0.80 }, { l: 'AI/ML', v: 0.60 }
    ];
    const n = skills.length, step = (Math.PI * 2) / n;
    const pt = (a, r) => ({ x: cx + Math.cos(a - Math.PI / 2) * r, y: cy + Math.sin(a - Math.PI / 2) * r });
    let prog = 0, started = false;

    function drawRadar(p) {
      ctx.clearRect(0, 0, sz, sz);
      // Grid
      for (let r = 1; r <= 5; r++) {
        const rr = (mr / 5) * r;
        ctx.beginPath();
        for (let i = 0; i <= n; i++) { const pp = pt(step * i, rr); i === 0 ? ctx.moveTo(pp.x, pp.y) : ctx.lineTo(pp.x, pp.y); }
        ctx.closePath();
        ctx.strokeStyle = r === 5 ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.08)';
        ctx.lineWidth = r === 5 ? 1.2 : 0.6;
        ctx.stroke();
      }
      // Axes
      for (let i = 0; i < n; i++) {
        const pp = pt(step * i, mr);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(pp.x, pp.y);
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 0.6; ctx.stroke();
      }
      // Labels
      for (let i = 0; i < n; i++) {
        const lp = pt(step * i, mr + 24);
        ctx.fillStyle = '#94A3B8'; ctx.font = '600 13px Inter,Noto Sans Thai,sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(skills[i].l, lp.x, lp.y);
      }
      // Data
      const pp2 = Math.min(p, 1);
      ctx.beginPath();
      for (let i = 0; i <= n; i++) { const idx = i % n; const dp = pt(step * idx, mr * skills[idx].v * pp2); i === 0 ? ctx.moveTo(dp.x, dp.y) : ctx.lineTo(dp.x, dp.y); }
      ctx.closePath();
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, mr);
      g.addColorStop(0, 'rgba(59,130,246,0.15)'); g.addColorStop(1, 'rgba(59,130,246,0.03)');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = 'rgba(59,130,246,0.5)'; ctx.lineWidth = 2; ctx.stroke();
      // Dots
      for (let i = 0; i < n; i++) {
        const dp = pt(step * i, mr * skills[i].v * pp2);
        ctx.beginPath(); ctx.arc(dp.x, dp.y, 7, 0, Math.PI * 2); ctx.fillStyle = 'rgba(59,130,246,0.12)'; ctx.fill();
        ctx.beginPath(); ctx.arc(dp.x, dp.y, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#3B82F6'; ctx.fill();
        ctx.strokeStyle = '#0F172A'; ctx.lineWidth = 1.5; ctx.stroke();
      }
      if (pp2 > 0.8) {
        const a = (pp2 - 0.8) / 0.2;
        for (let i = 0; i < n; i++) {
          const dp = pt(step * i, mr * skills[i].v * pp2);
          ctx.globalAlpha = a; ctx.fillStyle = '#60A5FA'; ctx.font = '700 11px Inter,sans-serif';
          ctx.textAlign = 'center'; ctx.fillText(Math.round(skills[i].v * 100) + '%', dp.x, dp.y - 16);
          ctx.globalAlpha = 1;
        }
      }
    }
    function animRadar() {
      prog += 0.016;
      const e = 1 - Math.pow(1 - Math.min(prog, 1), 3);
      drawRadar(e);
      if (prog < 1) requestAnimationFrame(animRadar);
    }
    drawRadar(0);
    const rObs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting && !started) { started = true; prog = 0; animRadar(); } });
    }, { threshold: 0.25 });
    rObs.observe(rc);
  }

  // ===== 9. CONCIERGE =====
  const fab = document.getElementById('conciergeFab');
  const panel = document.getElementById('conciergePanel');
  const greet = document.getElementById('conciergeGreeting');
  const msgs = document.getElementById('conciergeMessages');
  const inp = document.getElementById('conciergeInput');
  const sendBtn = document.getElementById('conciergeSend');
  const qrs = document.querySelectorAll('.qr-btn');
  let isOpen = false, greeted = false;

  setTimeout(() => { if (!isOpen && !greeted) { greet.classList.add('show'); greeted = true; setTimeout(() => greet.classList.remove('show'), 8000); } }, 5000);

  fab.addEventListener('click', () => {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    fab.classList.toggle('open', isOpen);
    greet.classList.remove('show');
    if (isOpen) inp.focus();
  });
  greet.addEventListener('click', () => { greet.classList.remove('show'); isOpen = true; panel.classList.add('open'); fab.classList.add('open'); inp.focus(); });

  const closeChatBtn = document.getElementById('conciergeCloseBtn');
  if (closeChatBtn) {
    closeChatBtn.addEventListener('click', () => {
      isOpen = false;
      panel.classList.remove('open');
      fab.classList.remove('open');
    });
  }

  function send(text) {
    if (!text.trim()) return;
    addMsg(text, 'user'); inp.value = '';
    // Typing indicator
    const typing = document.createElement('div');
    typing.classList.add('message', 'bot');
    typing.textContent = '...';
    typing.style.opacity = '0.5';
    msgs.appendChild(typing);
    msgs.scrollTop = msgs.scrollHeight;
    setTimeout(() => { typing.remove(); addMsg(getReply(text), 'bot'); }, 600);
  }
  function addMsg(text, sender) {
    const m = document.createElement('div');
    m.classList.add('message', sender);
    // Check if reply contains navigation
    if (sender === 'bot' && text.includes('[[NAV:')) {
      const match = text.match(/\[\[NAV:(\w+)\]\]/);
      if (match) {
        text = text.replace(/\[\[NAV:\w+\]\]/, '');
        m.textContent = text;
        const navBtn = document.createElement('button');
        navBtn.textContent = '➡️ ไปที่ส่วนนี้';
        navBtn.style.cssText = 'display:block;margin-top:8px;padding:6px 16px;background:rgba(37,99,235,0.1);color:#2563EB;border:1px solid rgba(37,99,235,0.2);border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit';
        navBtn.addEventListener('click', () => {
          const target = document.getElementById(match[1]);
          if (target) target.scrollIntoView({ behavior: 'smooth' });
          isOpen = false; panel.classList.remove('open'); fab.classList.remove('open');
        });
        m.appendChild(navBtn);
      } else {
        m.textContent = text;
      }
    } else {
      m.textContent = text;
    }
    msgs.appendChild(m);
    msgs.scrollTop = msgs.scrollHeight;
  }
  function getReply(q) {
    const l = q.toLowerCase().trim();
    if (l.includes('sop') || l.includes('จุดมุ่งหมาย') || l.includes('statement'))
      return '📄 SOP เน้นแรงบันดาลใจด้าน Autonomous Systems และเป้าหมายเข้าวิศวกรรมศาสตร์ สจล. อ่านฉบับเต็มได้เลยครับ [[NAV:sop]]';
    if (l.includes('โปรเจกต์') || l.includes('project') || l.includes('ผลงาน'))
      return '🚀 มีโปรเจกต์เด่น 5 ชิ้น ครอบคลุม IoT, AI/ML, Robotics และ Web Dev ครับ [[NAV:projects]]';
    if (l.includes('ทักษะ') || l.includes('skill'))
      return '📊 ทักษะหลัก: Python 85%, Web Dev 80%, Robotics 75%, C/C++ 70%, IoT 65%, AI/ML 60% ดู Radar Chart ได้ครับ [[NAV:about]]';
    if (l.includes('รางวัล') || l.includes('เกียรติบัตร') || l.includes('achievement'))
      return '🏆 มีรางวัลจากการแข่งขันหลากหลาย ทั้ง OTOP, EERC และเกียรติบัตรอบรมครับ [[NAV:achievements]]';
    if (l.includes('ติดต่อ') || l.includes('contact') || l.includes('อีเมล'))
      return '📧 ติดต่อผ่าน Email, โทรศัพท์ หรือ LINE ได้เลยครับ [[NAV:contact]]';
    if (l.includes('สวัสดี') || l.includes('hello') || l.includes('hi'))
      return 'สวัสดีครับ! 😊 ยินดีต้อนรับสู่ Portfolio มีอะไรให้ช่วยแนะนำไหมครับ?';
    if (l.includes('ใคร') || l.includes('เจ้าของ') || l.includes('who'))
      return '👤 เจ้าของ Portfolio คือ "ภู" นักเรียน ม.5 ผู้สมัครเข้าวิศวกรรมศาสตร์ สจล. มีทักษะ Programming, Robotics และ IoT ครับ [[NAV:about]]';
    return '🤔 ลองถามเกี่ยวกับ SOP, โปรเจกต์, ทักษะ, ผลงาน หรือข้อมูลติดต่อ หรือกดปุ่มด้านบนได้เลยครับ';
  }

  sendBtn.addEventListener('click', () => send(inp.value));
  inp.addEventListener('keydown', e => { if (e.key === 'Enter') send(inp.value); });
  qrs.forEach(b => b.addEventListener('click', () => send(b.dataset.query)));

  // ===== 10. SMOOTH SCROLL =====
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => { e.preventDefault(); const t = document.querySelector(a.getAttribute('href')); if (t) t.scrollIntoView({ behavior: 'smooth' }); });
  });

  // ===== 11. MODAL SYSTEM LOGIC =====
  const projectData = {
    'echo-glove': {
      title: 'Echo Glove',
      role: 'Lead Innovator',
      icon: '🧤',
      tags: ['Hardware', 'AI/ML', 'Innovation'],
      desc: '<p><strong>ถุงมือแปลภาษามืออัจฉริยะ (Echo Glove)</strong> พัฒนาขึ้นเพื่อช่วยแก้ไขปัญหาช่องว่างในการสื่อสารของผู้พิการทางการได้ยิน โดยตัวถุงมือจะทำหน้าที่ตรวจจับการเคลื่อนไหวและการงอของนิ้วมือ รวมถึงทิศทางของมือ จากนั้นประมวลผลด้วยโมเดลปัญญาประดิษฐ์ (AI) เพื่อแปลเป็นคำพูดหรือข้อความเสียงผ่านแอปพลิเคชันบนสมาร์ตโฟน</p><p>โครงการนี้ได้รับรางวัลชนะเลิศการประกวด OTOP ระดับโรงเรียน และมีเป้าหมายในการพัฒนาต่อยอดไปสู่การแปลประโยคภาษาภาษามือที่ซับซ้อนขึ้นในระดับสากล</p>',
      tech: ['ESP32 Microcontroller', 'Flex Sensors (เซนเซอร์วัดการงอ)', 'MPU6050 Accelerometer/Gyroscope', 'Python & TensorFlow (สำหรับฝึกคัดแยกท่าทาง)', 'Bluetooth SPP', 'Android Application']
    },
    'eerc-2025': {
      title: 'EERC 2025',
      role: 'Robotics Competitor',
      icon: '🤖',
      tags: ['Robotics', 'Engineering'],
      desc: '<p>การออกแบบและสร้างหุ่นยนต์เพื่อเข้าร่วมการแข่งขัน <strong>Engineering Education Robot Contest 2025 (EERC)</strong> ณ สถาบันเทคโนโลยีพระจอมเกล้าเจ้าคุณทหารลาดกระบัง โดยทีมของเราได้รับรางวัลรองชนะเลิศอันดับ 1</p><p>หุ่นยนต์ถูกพัฒนาด้วยแนวคิดการขับเคลื่อนอัตโนมัติความเร็วสูงเพื่อวิ่งทำภารกิจคัดแยกสิ่งของตามสีและระยะ โดยใช้เซนเซอร์วัดค่าต่างๆ นำมาเขียนโปรแกรมควบคุม PID ร่วมกับการออกแบบโครงสร้างทางกลที่ทนทานและกระจายน้ำหนักได้ดี</p>',
      tech: ['C/C++ (Arduino IDE)', 'STM32 / Arduino Boards', 'DC Encoder Motors (ควบคุมความเร็วและทิศทางแม่นยำ)', 'Infrared Reflective Sensors (ตรวจจับเส้น)', 'Color Sensors', 'Custom Aluminum Chassis & 3D Printed Parts']
    },
    'ai-object-detection': {
      title: 'AI Object Detection',
      role: 'AI Developer',
      icon: '🧠',
      tags: ['Python', 'Roboflow', 'ML'],
      desc: '<p>พัฒนาและทดสอบระบบตรวจจับวัตถุ <strong>Real-time Object Detection</strong> ในกิจกรรม iDektep Mini Coding Challenge โดยการรวบรวมข้อมูลรูปภาพ นำมาทำ Data Labeling บนแพลตฟอร์ม Roboflow จากนั้นเทรนโมเดลตรวจจับด้วยอัลกอริทึม YOLO</p><p>ระบบสามารถประมวลผลภาพจากกล้องวิดีโอแบบสดเพื่อระบุตำแหน่งและจำแนกประเภทของวัตถุเป้าหมายได้อย่างแม่นยำและมีความหน่วงต่ำ (Low Latency)</p>',
      tech: ['Python', 'YOLOv8 / YOLOv5 (Ultralytics)', 'OpenCV (Image Processing)', 'Roboflow (Dataset Management)', 'Google Colab (GPU Training)']
    },
    'raspberry-pi-automation': {
      title: 'Raspberry Pi Automation',
      role: 'Hardware / MCU',
      icon: '🔧',
      tags: ['Raspberry Pi', 'Hardware'],
      desc: '<p>พัฒนาระบบควบคุมอุปกรณ์และเซนเซอร์อัตโนมัติในโครงการเวิร์กชอปจัดโดย <strong>สถาบันวิทยาการหุ่นยนต์ภาคสนาม (FIBO)</strong> มหาวิทยาลัยเทคโนโลยีพระจอมเกล้าธนบุรี</p><p>โครงการนี้เป็นการเขียนสคริปต์บน Raspberry Pi เพื่อทำหน้าที่เป็น IoT Gateway คอยรวบรวมข้อมูลจากเซนเซอร์ชนิดต่างๆ (เช่น อุณหภูมิ ความชื้น ระยะทาง) และสั่งการรีเลย์เพื่อควบคุมอุปกรณ์ไฟฟ้าภายนอก พร้อมส่งผ่านข้อมูลเข้าสู่คลาวด์ผ่านโปรโตคอลการสื่อสารของ IoT</p>',
      tech: ['Raspberry Pi 4', 'Python Scripts', 'I2C, SPI & GPIO Interfaces', 'MQTT Communication Protocol', 'Node-RED Dashboard']
    },
    'lidar-arduino': {
      title: 'LiDAR & Arduino SLAM',
      role: 'Robotics Firmware',
      icon: '📡',
      tags: ['LiDAR', 'Arduino'],
      desc: '<p>ศึกษาและพัฒนาโครงงานระบบการทำแผนที่และการนำทางสำหรับหุ่นยนต์อัตโนมัติเบื้องต้น ในงาน K-Engineering World Tour ณ สจล.</p><p>โดยการนำเซนเซอร์ <strong>LiDAR (Light Detection and Ranging)</strong> มาเชื่อมต่อเพื่อสแกนสภาพแวดล้อมรอบตัวแบบ 360 องศา และส่งค่าข้อมูลระยะทางแบบพอร์ตอนุกรม (Serial) นำมาพลอตกราฟจุดพิกัดเพื่อทำแผนที่และนำทางหลบหลีกสิ่งกีดขวางร่วมกับการควบคุมมอเตอร์ขับเคลื่อนด้วย Arduino</p>',
      tech: ['Arduino Microcontroller', 'C++ Programming', 'LiDAR Sensor (YDLIDAR/RPLIDAR)', 'Processing (สำหรับแสดงผล Visualizer)', 'Serial Communication']
    }
  };

  const projectModal = document.getElementById('projectModal');
  const certModal = document.getElementById('certModal');

  // Elements inside project modal
  const pmTitle = document.getElementById('pmTitle');
  const pmRole = document.getElementById('pmRole');
  const pmFallbackVisual = document.getElementById('pmFallbackVisual');
  const pmTags = document.getElementById('pmTags');
  const pmBody = document.getElementById('pmBody');
  const pmTechList = document.getElementById('pmTechList');

  // Elements inside cert modal
  const cmTitle = document.getElementById('cmTitle');
  const cmDesc = document.getElementById('cmDesc');
  const cmYear = document.getElementById('cmYear');
  const cmMockTitle = document.getElementById('cmMockTitle');
  const cmMockDesc = document.getElementById('cmMockDesc');
  const cmMockYear = document.getElementById('cmMockYear');
  const certRealImg = document.getElementById('certRealImg');
  const certMockup = document.getElementById('certMockup');

  function openModal(modal) {
    modal.classList.add('active');
    document.body.classList.add('modal-open');
  }

  function closeModal(modal) {
    modal.classList.remove('active');
    if (!document.querySelector('.modal.active')) {
      document.body.classList.remove('modal-open');
    }
  }

  // Setup close events for all close buttons and backdrops
  document.querySelectorAll('.modal').forEach(modal => {
    const closeBtn = modal.querySelector('.modal-close');
    const backdrop = modal.querySelector('.modal-backdrop');
    
    closeBtn.addEventListener('click', () => closeModal(modal));
    backdrop.addEventListener('click', () => closeModal(modal));
  });

  // ESC key to close
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      const activeModal = document.querySelector('.modal.active');
      if (activeModal) closeModal(activeModal);
    }
  });

  // Project cards click handler
  document.querySelectorAll('[data-project-id]').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.projectId;
      const data = projectData[id];
      if (!data) return;

      pmTitle.textContent = data.title;
      pmRole.textContent = data.role;
      pmFallbackVisual.textContent = data.icon;
      
      pmTags.innerHTML = '';
      data.tags.forEach(tag => {
        const span = document.createElement('span');
        span.className = 'tag';
        span.textContent = tag;
        pmTags.appendChild(span);
      });

      pmBody.innerHTML = data.desc;

      pmTechList.innerHTML = '';
      data.tech.forEach(t => {
        const li = document.createElement('li');
        li.textContent = t;
        pmTechList.appendChild(li);
      });

      openModal(projectModal);
    });
  });

  // Achievement cards click handler
  document.querySelectorAll('.achievement-card').forEach(card => {
    card.addEventListener('click', () => {
      const title = card.dataset.certTitle;
      const desc = card.dataset.certDesc;
      const year = card.dataset.certYear;
      const imgSrc = card.dataset.certSrc;

      if (!title) return;

      cmTitle.textContent = title;
      cmDesc.textContent = desc;
      cmYear.textContent = year;

      if (imgSrc && imgSrc !== '#' && imgSrc !== '') {
        certRealImg.src = imgSrc;
        certRealImg.style.display = 'block';
        certMockup.style.display = 'none';
      } else {
        cmMockTitle.textContent = title;
        cmMockDesc.textContent = desc;
        cmMockYear.textContent = `ปีการศึกษา ${year}`;
        certRealImg.style.display = 'none';
        certMockup.style.display = 'flex';
      }

      openModal(certModal);
    });
  });

  // Init
  updateNav();
  updateProgress();
  updateDots();
});
