/* ============================================
   SCRIPT.JS — Portfolio v2
   Three.js + GSAP + Particles + Concierge
   ============================================ */
document.addEventListener('DOMContentLoaded', () => {

  // ===== WELCOME SCREEN =====
  const welcomeScreen = document.getElementById('welcomeScreen');
  const welcomeSkip = document.getElementById('welcomeSkip');
  const welcomeParticles = document.getElementById('welcomeParticles');
  
  // Create floating particles
  function createWelcomeParticles() {
    const particleCount = 50;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 8 + 's';
      particle.style.animationDuration = (8 + Math.random() * 4) + 's';
      welcomeParticles.appendChild(particle);
    }
  }
  
  // Sound effects (using Web Audio API for simple beeps)
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  function playSound(frequency, duration) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
  }
  
  // Typewriter effect function
  function typeWriter(element, text, speed = 100) {
    let i = 0;
    element.textContent = '';
    element.style.opacity = '1';
    
    function type() {
      if (i < text.length) {
        element.textContent += text.charAt(i);
        i++;
        setTimeout(type, speed);
      } else {
        // Remove cursor when done
        setTimeout(() => {
          element.style.removeProperty('position');
          element.classList.remove('typewriter');
        }, 500);
      }
    }
    type();
  }

  // Initialize welcome screen
  function initWelcomeScreen() {
    createWelcomeParticles();
    initWelcome3D();
    
    // Start typewriter effect
    const welcomeText = document.querySelector('.welcome-text');
    const portfolioText = document.querySelector('.welcome-highlight');
    
    setTimeout(() => {
      typeWriter(welcomeText, welcomeText.dataset.text, 80);
      playSound(523, 0.1); // C5 note
    }, 500);
    
    setTimeout(() => {
      typeWriter(portfolioText, portfolioText.dataset.text, 80);
      portfolioText.style.animation = 'glowPulse 2s ease forwards';
    }, 2000);
    
    // Auto-hide welcome screen after 6 seconds
    setTimeout(() => {
      playSound(659, 0.15); // E5 note
      hideWelcomeScreen();
    }, 6000);
  }

  // Welcome screen 3D animation
  function initWelcome3D() {
    const canvas = document.getElementById('welcome3dCanvas');
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true });
    
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.position.z = 30;

    // Create multiple geometric groups
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    // Central icosahedron with glow effect
    const icoGeo = new THREE.IcosahedronGeometry(8, 2);
    const icoMat = new THREE.MeshBasicMaterial({ 
      color: 0x3B82F6, 
      wireframe: true, 
      transparent: true, 
      opacity: 0.4 
    });
    const ico = new THREE.Mesh(icoGeo, icoMat);
    mainGroup.add(ico);

    // Multiple rotating torus knots at different positions
    const torusKnots = [];
    for (let i = 0; i < 3; i++) {
      const tkGeo = new THREE.TorusKnotGeometry(3 + i * 0.5, 0.4, 80, 12);
      const tkMat = new THREE.MeshBasicMaterial({ 
        color: i === 0 ? 0x60A5FA : i === 1 ? 0x93C5FD : 0x3B82F6,
        wireframe: true, 
        transparent: true, 
        opacity: 0.3 - i * 0.05 
      });
      const tk = new THREE.Mesh(tkGeo, tkMat);
      tk.position.set(
        Math.cos(i * Math.PI * 2 / 3) * 12,
        Math.sin(i * Math.PI * 2 / 3) * 12,
        0
      );
      torusKnots.push(tk);
      mainGroup.add(tk);
    }

    // Orbital rings
    const rings = [];
    for (let i = 0; i < 2; i++) {
      const ringGeo = new THREE.RingGeometry(8 + i * 4, 9 + i * 4, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x60A5FA,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.1
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2;
      rings.push(ring);
      mainGroup.add(ring);
    }

    // Enhanced particle system with multiple layers
    const particleSystems = [];
    for (let layer = 0; layer < 3; layer++) {
      const pointsCount = 150;
      const pointsGeo = new THREE.BufferGeometry();
      const positions = new Float32Array(pointsCount * 3);
      const colors = new Float32Array(pointsCount * 3);
      
      for (let i = 0; i < pointsCount; i++) {
        const radius = 15 + layer * 10;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        
        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);
        
        const color = new THREE.Color();
        color.setHSL(0.6, 0.8, 0.5 + layer * 0.1);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }
      
      pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      pointsGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      
      const pointsMat = new THREE.PointsMaterial({ 
        size: 0.06 - layer * 0.01,
        vertexColors: true,
        transparent: true, 
        opacity: 0.8 - layer * 0.2 
      });
      const points = new THREE.Points(pointsGeo, pointsMat);
      particleSystems.push(points);
      mainGroup.add(points);
    }

    // Add connecting lines between particles
    const lineMaterial = new THREE.LineBasicMaterial({
      color: 0x60A5FA,
      transparent: true,
      opacity: 0.1
    });

    // Animation with enhanced effects
    let time = 0;
    function animateWelcome3D() {
      requestAnimationFrame(animateWelcome3D);
      time += 0.01;

      // Central icosahedron rotation with pulsing
      ico.rotation.x += 0.003;
      ico.rotation.y += 0.004;
      ico.scale.setScalar(1 + Math.sin(time * 2) * 0.1);

      // Orbital torus knots
      torusKnots.forEach((tk, i) => {
        const angle = time * 0.5 + (i * Math.PI * 2 / 3);
        tk.position.x = Math.cos(angle) * 12;
        tk.position.y = Math.sin(angle) * 12;
        tk.rotation.x += 0.002 * (i + 1);
        tk.rotation.y += 0.003 * (i + 1);
      });

      // Ring rotations
      rings.forEach((ring, i) => {
        ring.rotation.z += 0.001 * (i + 1);
        ring.rotation.x = Math.PI / 2 + Math.sin(time + i) * 0.2;
      });

      // Particle system movements
      particleSystems.forEach((particles, layer) => {
        particles.rotation.y += 0.001 * (layer + 1);
        particles.rotation.x += 0.0005 * (layer + 1);
        
        // Subtle floating motion
        particles.position.y = Math.sin(time * 2 + layer) * 2;
      });

      renderer.render(scene, camera);
    }

    // Handle resize
    function handleResize() {
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    }
    window.addEventListener('resize', handleResize);

    animateWelcome3D();
  }
  
  // Hide welcome screen
  function hideWelcomeScreen() {
    welcomeScreen.classList.add('fade-out');
    setTimeout(() => {
      welcomeScreen.style.display = 'none';
      // Start main animations after welcome screen
      startMainAnimations();
    }, 800);
  }
  
    
  // Start welcome screen
  initWelcomeScreen();

  // ===== 1. THREE.JS 3D BACKGROUND =====
  const canvas3d = document.getElementById('threeBg');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  camera.position.z = 30;

  // Mouse tracking
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  document.addEventListener('mousemove', e => {
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // Create abstract geometry group
  const group = new THREE.Group();
  scene.add(group);

  // Icosahedron wireframe
  const icoGeo = new THREE.IcosahedronGeometry(8, 1);
  const icoMat = new THREE.MeshBasicMaterial({ color: 0x3B82F6, wireframe: true, transparent: true, opacity: 0.15 });
  const ico = new THREE.Mesh(icoGeo, icoMat);
  group.add(ico);

  // Torus knot
  const tkGeo = new THREE.TorusKnotGeometry(5, 0.8, 100, 16);
  const tkMat = new THREE.MeshBasicMaterial({ color: 0x60A5FA, wireframe: true, transparent: true, opacity: 0.08 });
  const tk = new THREE.Mesh(tkGeo, tkMat);
  group.add(tk);

  // Floating dots
  const dotCount = 200;
  const dotGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(dotCount * 3);
  for (let i = 0; i < dotCount * 3; i++) positions[i] = (Math.random() - 0.5) * 60;
  dotGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dotMat = new THREE.PointsMaterial({ color: 0x60A5FA, size: 0.12, transparent: true, opacity: 0.4 });
  const dots = new THREE.Points(dotGeo, dotMat);
  group.add(dots);

  // Animate Three.js
  function animate3D() {
    requestAnimationFrame(animate3D);
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    group.rotation.y += 0.002;
    group.rotation.x += 0.001;
    group.rotation.y += mouse.x * 0.01;
    group.rotation.x += mouse.y * 0.01;
    ico.rotation.z += 0.003;
    tk.rotation.x += 0.004;
    tk.rotation.y += 0.002;
    renderer.render(scene, camera);
  }
  animate3D();

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

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
  navToggle.addEventListener('click', () => navLinksEl.classList.toggle('open'));
  navLinksEl.querySelectorAll('a').forEach(a => a.addEventListener('click', () => navLinksEl.classList.remove('open')));

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

  // Init
  updateNav();
  updateProgress();
  updateDots();
});
