/* ============================================
   SCRIPT.JS — Engineering Portfolio v2
   Robin Noguier-inspired animations
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {

  // ============================================
  // 1. CURSOR GLOW (follows mouse)
  // ============================================
  const cursorGlow = document.getElementById('cursorGlow');
  
  if (window.matchMedia('(hover: hover)').matches) {
    document.addEventListener('mousemove', (e) => {
      cursorGlow.style.left = e.clientX + 'px';
      cursorGlow.style.top = e.clientY + 'px';
    });
  }

  // ============================================
  // 2. SCROLL PROGRESS BAR
  // ============================================
  const scrollProgress = document.getElementById('scrollProgress');

  function updateScrollProgress() {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    scrollProgress.style.width = progress + '%';
  }

  window.addEventListener('scroll', updateScrollProgress, { passive: true });

  // ============================================
  // 3. NAVBAR
  // ============================================
  const navbar = document.getElementById('navbar');
  const navLinks = document.querySelectorAll('.nav-links a');
  const allSections = document.querySelectorAll('.section, .hero');

  function updateNavbar() {
    navbar.classList.toggle('scrolled', window.scrollY > 30);

    let current = '';
    allSections.forEach(section => {
      const top = section.offsetTop - 120;
      if (window.scrollY >= top) {
        current = section.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('data-section') === current);
    });
  }

  window.addEventListener('scroll', updateNavbar, { passive: true });

  // Mobile toggle
  const navToggle = document.getElementById('navToggle');
  const navLinksContainer = document.getElementById('navLinks');

  navToggle.addEventListener('click', () => navLinksContainer.classList.toggle('open'));
  navLinksContainer.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => navLinksContainer.classList.remove('open'));
  });

  // ============================================
  // 4. DOT NAVIGATION
  // ============================================
  const dotNavItems = document.querySelectorAll('.dot-nav-item');
  const sectionMap = ['hero', 'about', 'skills', 'sop', 'projects', 'achievements', 'contact'];

  function updateDotNav() {
    let currentIdx = 0;
    sectionMap.forEach((id, i) => {
      const section = document.getElementById(id);
      if (section && window.scrollY >= section.offsetTop - 200) {
        currentIdx = i;
      }
    });

    dotNavItems.forEach((dot, i) => {
      dot.classList.toggle('active', i === currentIdx);
    });
  }

  window.addEventListener('scroll', updateDotNav, { passive: true });

  dotNavItems.forEach(dot => {
    dot.addEventListener('click', () => {
      const target = document.querySelector(dot.getAttribute('data-target'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // ============================================
  // 5. TEXT REVEAL & FADE ANIMATIONS
  // ============================================
  const revealTexts = document.querySelectorAll('.reveal-text');
  const revealFades = document.querySelectorAll('.reveal-fade');
  const revealScales = document.querySelectorAll('.reveal-scale');

  const observerOptions = {
    threshold: 0.15,
    rootMargin: '0px 0px -60px 0px'
  };

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, observerOptions);

  revealTexts.forEach(el => revealObserver.observe(el));
  revealFades.forEach(el => revealObserver.observe(el));
  revealScales.forEach(el => revealObserver.observe(el));

  // Auto-trigger hero elements (they're already in view)
  setTimeout(() => {
    document.querySelectorAll('.hero .reveal-text, .hero .reveal-fade, .hero .reveal-scale').forEach(el => {
      el.classList.add('visible');
    });
  }, 100);

  // ============================================
  // 6. PARALLAX (subtle on scroll)
  // ============================================
  const heroImage = document.getElementById('heroImage');
  const aboutPhoto = document.getElementById('aboutPhoto');

  function updateParallax() {
    const scrollY = window.scrollY;

    // Hero image subtle parallax
    if (heroImage) {
      const heroOffset = scrollY * 0.08;
      heroImage.style.transform = `rotateY(-8deg) rotateX(4deg) translateY(${heroOffset}px)`;
    }

    // About photo subtle parallax
    if (aboutPhoto) {
      const aboutSection = document.getElementById('about');
      if (aboutSection) {
        const aboutTop = aboutSection.offsetTop;
        const offset = (scrollY - aboutTop) * 0.04;
        aboutPhoto.style.transform = `rotateY(6deg) rotateX(-3deg) translateY(${Math.max(-20, Math.min(20, offset))}px)`;
      }
    }
  }

  window.addEventListener('scroll', updateParallax, { passive: true });

  // ============================================
  // 7. RADAR CHART (Canvas with drawing animation)
  // ============================================
  const radarCanvas = document.getElementById('radarChart');
  const ctx = radarCanvas.getContext('2d');

  const dpr = window.devicePixelRatio || 1;
  const canvasSize = 440;
  radarCanvas.width = canvasSize * dpr;
  radarCanvas.height = canvasSize * dpr;
  radarCanvas.style.width = canvasSize + 'px';
  radarCanvas.style.height = canvasSize + 'px';
  ctx.scale(dpr, dpr);

  const centerX = canvasSize / 2;
  const centerY = canvasSize / 2;
  const maxRadius = 165;

  const skills = [
    { label: 'Python', value: 0.85 },
    { label: 'C/C++', value: 0.70 },
    { label: 'Robotics', value: 0.75 },
    { label: 'IoT', value: 0.65 },
    { label: 'Web Dev', value: 0.80 },
    { label: 'AI/ML', value: 0.60 },
  ];

  const numSkills = skills.length;
  const angleStep = (Math.PI * 2) / numSkills;

  let radarProgress = 0;
  let radarStarted = false;

  function getPoint(angle, radius) {
    return {
      x: centerX + Math.cos(angle - Math.PI / 2) * radius,
      y: centerY + Math.sin(angle - Math.PI / 2) * radius
    };
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function drawRadar(progress) {
    ctx.clearRect(0, 0, canvasSize, canvasSize);

    // Grid rings
    const rings = 5;
    for (let r = 1; r <= rings; r++) {
      const ringR = (maxRadius / rings) * r;
      ctx.beginPath();
      for (let i = 0; i <= numSkills; i++) {
        const pt = getPoint(angleStep * i, ringR);
        if (i === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      }
      ctx.closePath();
      ctx.strokeStyle = r === rings ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.05)';
      ctx.lineWidth = r === rings ? 1.2 : 0.6;
      ctx.stroke();
    }

    // Axes
    for (let i = 0; i < numSkills; i++) {
      const pt = getPoint(angleStep * i, maxRadius);
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(pt.x, pt.y);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // Labels
    for (let i = 0; i < numSkills; i++) {
      const labelPt = getPoint(angleStep * i, maxRadius + 26);
      ctx.fillStyle = '#8B9DC3';
      ctx.font = '600 13px Inter, Noto Sans Thai, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(skills[i].label, labelPt.x, labelPt.y);
    }

    // Data polygon
    const p = Math.min(progress, 1);

    ctx.beginPath();
    for (let i = 0; i <= numSkills; i++) {
      const idx = i % numSkills;
      const pt = getPoint(angleStep * idx, maxRadius * skills[idx].value * p);
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.closePath();

    // Gradient fill
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
    gradient.addColorStop(0, 'rgba(96,165,250,0.15)');
    gradient.addColorStop(1, 'rgba(96,165,250,0.03)');
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.strokeStyle = 'rgba(96,165,250,0.6)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Data points
    for (let i = 0; i < numSkills; i++) {
      const pt = getPoint(angleStep * i, maxRadius * skills[i].value * p);

      // Glow
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(96,165,250,0.15)';
      ctx.fill();

      // Dot
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = '#60A5FA';
      ctx.fill();
      ctx.strokeStyle = '#1B2A4A';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Value labels (fade in at end)
    if (p > 0.8) {
      const alpha = (p - 0.8) / 0.2;
      for (let i = 0; i < numSkills; i++) {
        const pt = getPoint(angleStep * i, maxRadius * skills[i].value * p);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#60A5FA';
        ctx.font = '700 11px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(skills[i].value * 100) + '%', pt.x, pt.y - 16);
        ctx.globalAlpha = 1;
      }
    }
  }

  function animateRadar() {
    radarProgress += 0.016;
    const eased = easeOutCubic(Math.min(radarProgress, 1));
    drawRadar(eased);
    if (radarProgress < 1) requestAnimationFrame(animateRadar);
  }

  drawRadar(0);

  const radarObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !radarStarted) {
        radarStarted = true;
        radarProgress = 0;
        animateRadar();
      }
    });
  }, { threshold: 0.25 });

  radarObserver.observe(radarCanvas);

  // ============================================
  // 8. CONCIERGE CHATBOT
  // ============================================
  const fab = document.getElementById('conciergeFab');
  const panel = document.getElementById('conciergePanel');
  const greeting = document.getElementById('conciergeGreeting');
  const messagesContainer = document.getElementById('conciergeMessages');
  const input = document.getElementById('conciergeInput');
  const sendBtn = document.getElementById('conciergeSend');
  const quickReplies = document.querySelectorAll('.quick-reply-btn');

  let isOpen = false;
  let greetingShown = false;

  // Auto-greeting
  setTimeout(() => {
    if (!isOpen && !greetingShown) {
      greeting.classList.add('show');
      greetingShown = true;
      setTimeout(() => greeting.classList.remove('show'), 8000);
    }
  }, 5000);

  fab.addEventListener('click', () => {
    isOpen = !isOpen;
    panel.classList.toggle('open', isOpen);
    fab.classList.toggle('open', isOpen);
    greeting.classList.remove('show');
    if (isOpen) input.focus();
  });

  greeting.addEventListener('click', () => {
    greeting.classList.remove('show');
    isOpen = true;
    panel.classList.add('open');
    fab.classList.add('open');
    input.focus();
  });

  function sendMessage(text) {
    if (!text.trim()) return;
    addMessage(text, 'user');
    input.value = '';
    setTimeout(() => addMessage(getBotResponse(text), 'bot'), 500);
  }

  function addMessage(text, sender) {
    const msg = document.createElement('div');
    msg.classList.add('message', sender);
    msg.textContent = text;
    messagesContainer.appendChild(msg);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function getBotResponse(query) {
    const q = query.toLowerCase().trim();

    if (q.includes('sop') || q.includes('จุดมุ่งหมาย') || q.includes('statement'))
      return '📄 SOP ของเจ้าของ Portfolio เน้นเรื่องแรงบันดาลใจด้านวิศวกรรม ประสบการณ์การทำโปรเจกต์จริง และเป้าหมายในการเข้าศึกษาต่อคณะวิศวกรรมศาสตร์ครับ ท่านสามารถอ่านฉบับเต็มได้ที่ส่วน SOP ด้านบนครับ';

    if (q.includes('โปรเจกต์') || q.includes('โปรเจ็กต์') || q.includes('project') || q.includes('ผลงาน'))
      return '🚀 โปรเจกต์เด่นมีทั้งหมด 6 ชิ้นครับ ครอบคลุม IoT, Web Dev, AI/ML และ Robotics แสดงให้เห็นความสามารถรอบด้าน ดูรายละเอียดในส่วน "ผลงาน" ครับ';

    if (q.includes('ทักษะ') || q.includes('skill') || q.includes('ความสามารถ'))
      return '📊 ทักษะหลัก: Python (85%), Web Dev (80%), Robotics (75%), C/C++ (70%), IoT (65%) และ AI/ML (60%) ดู Radar Chart ในส่วน "ทักษะ" ครับ';

    if (q.includes('รางวัล') || q.includes('เกียรติบัตร') || q.includes('achievement'))
      return '🏆 มีเกียรติบัตรและรางวัลจากการแข่งขันหลากหลาย ดูในส่วน "รางวัล" ครับ';

    if (q.includes('ติดต่อ') || q.includes('contact') || q.includes('อีเมล') || q.includes('email'))
      return '📧 ติดต่อได้ผ่านอีเมล โทรศัพท์ หรือ GitHub ดูในส่วน "ติดต่อ" ด้านล่างครับ';

    if (q.includes('สวัสดี') || q.includes('หวัดดี') || q.includes('hello') || q.includes('hi'))
      return 'สวัสดีครับ! 😊 ยินดีต้อนรับสู่ Portfolio ครับ มีอะไรให้ช่วยแนะนำไหมครับ?';

    if (q.includes('ใคร') || q.includes('เจ้าของ') || q.includes('who'))
      return '👤 เจ้าของ Portfolio เป็นนักเรียนที่สมัครเข้าคณะวิศวกรรมศาสตร์ มีความเชี่ยวชาญด้าน Programming, Robotics และ IoT ครับ';

    if (q.includes('gpa') || q.includes('เกรด') || q.includes('การศึกษา') || q.includes('โรงเรียน'))
      return '🎓 ข้อมูลการศึกษาและ GPA อยู่ในส่วน "เกี่ยวกับ" ครับ';

    return '🤔 ลองถามเกี่ยวกับ SOP, โปรเจกต์, ทักษะ, ผลงาน หรือข้อมูลติดต่อ หรือกดปุ่มด้านบนได้เลยครับ';
  }

  sendBtn.addEventListener('click', () => sendMessage(input.value));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(input.value); });
  quickReplies.forEach(btn => {
    btn.addEventListener('click', () => sendMessage(btn.getAttribute('data-query')));
  });

  // ============================================
  // 9. SMOOTH SCROLL
  // ============================================
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });

  // ============================================
  // INIT
  // ============================================
  updateNavbar();
  updateScrollProgress();
  updateDotNav();

});
