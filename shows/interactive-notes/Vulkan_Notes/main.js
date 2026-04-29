/* ═══════════════════════════════════════════════════════════════
   Vulkan Notes — main.js
   Handles: Circuit BG canvas, object tree, tab switching,
            scroll nav highlight, animated counters, interactions
   ═══════════════════════════════════════════════════════════════ */

'use strict';

/* ── Back to top ── */
(function initBackToTop() {
  const btn = document.getElementById('backToTopBtn');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('show', window.scrollY > 300);
  });
  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

/* ─── Circuit Board Canvas Background ──────────────────────── */
(function initCircuitCanvas() {
  const canvas = document.getElementById('circuit-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H, nodes, lines;

  const NODE_COUNT = 60;
  const LINE_PROB  = 0.25;
  const NODE_COLOR = '#00c8ff';
  const LINE_COLOR = '#1e3550';

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    build();
  }

  function build() {
    nodes = [];
    lines = [];

    for (let i = 0; i < NODE_COUNT; i++) {
      nodes.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 2 + 1,
        px: (Math.random() - 0.5) * 0.15,
        py: (Math.random() - 0.5) * 0.15,
      });
    }

    // build grid-like connections — prefer horizontal/vertical neighbors
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < W * 0.18 && Math.random() < LINE_PROB) {
          // prefer right-angle segments
          lines.push({ a: i, b: j, corner: Math.random() > 0.5 });
        }
      }
    }
  }

  function drawCornerLine(ax, ay, bx, by, corner) {
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    if (corner) {
      ctx.lineTo(bx, ay); // horizontal first
      ctx.lineTo(bx, by);
    } else {
      ctx.lineTo(ax, by); // vertical first
      ctx.lineTo(bx, by);
    }
    ctx.stroke();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // lines
    ctx.strokeStyle = LINE_COLOR;
    ctx.lineWidth   = 0.8;
    for (const l of lines) {
      const a = nodes[l.a], b = nodes[l.b];
      drawCornerLine(a.x, a.y, b.x, b.y, l.corner);
    }

    // nodes
    for (const n of nodes) {
      // outer ring
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r + 2, 0, Math.PI * 2);
      ctx.strokeStyle = NODE_COLOR + '40';
      ctx.lineWidth   = 0.5;
      ctx.stroke();

      // core dot
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = NODE_COLOR + '80';
      ctx.fill();
    }
  }

  function update() {
    for (const n of nodes) {
      n.x += n.px;
      n.y += n.py;
      if (n.x < 0 || n.x > W) n.px *= -1;
      if (n.y < 0 || n.y > H) n.py *= -1;
    }
  }

  let raf;
  function loop() {
    update();
    draw();
    raf = requestAnimationFrame(loop);
  }

  window.addEventListener('resize', () => {
    cancelAnimationFrame(raf);
    resize();
    loop();
  });

  resize();
  loop();
})();


/* ─── Hero Object Tree ──────────────────────────────────────── */
(function buildHeroTree() {
  const container = document.getElementById('hero-obj-tree');
  if (!container) return;

  const nodes = [
    { label: 'VkInstance',           dot: 'dot-orange', indent: '' },
    { label: 'VkPhysicalDevice',     dot: 'dot-cyan',   indent: 'ot-indent' },
    { label: 'VkDevice',             dot: 'dot-green',  indent: 'ot-indent' },
    { label: 'VkQueue',              dot: 'dot-cyan',   indent: 'ot-indent2' },
    { label: 'VkCommandPool',        dot: 'dot-yellow', indent: 'ot-indent2' },
    { label: 'VkCommandBuffer',      dot: 'dot-yellow', indent: 'ot-indent2' },
    { label: 'VkSwapchainKHR',       dot: 'dot-green',  indent: 'ot-indent' },
    { label: 'VkRenderPass',         dot: 'dot-orange', indent: 'ot-indent2' },
    { label: 'VkPipeline',           dot: 'dot-purple', indent: 'ot-indent2' },
    { label: 'VkDescriptorSet',      dot: 'dot-cyan',   indent: 'ot-indent2' },
    { label: 'VkImage / VkBuffer',   dot: 'dot-yellow', indent: 'ot-indent2' },
    { label: 'VmaAllocator',         dot: 'dot-green',  indent: 'ot-indent2' },
    { label: 'VkFence / VkSemaphore',dot: 'dot-red',    indent: 'ot-indent2' },
  ];

  nodes.forEach((n, i) => {
    if (i > 0 && i < 6) {
      const line = document.createElement('div');
      line.className = 'ot-line';
      if (n.indent === 'ot-indent2') line.style.marginLeft = '48px';
      else if (n.indent === 'ot-indent') line.style.marginLeft = '28px';
      container.appendChild(line);
    } else if (i >= 6) {
      const line = document.createElement('div');
      line.className = 'ot-line';
      if (n.indent === 'ot-indent2') line.style.marginLeft = '48px';
      else if (n.indent === 'ot-indent') line.style.marginLeft = '28px';
      container.appendChild(line);
    }

    const el = document.createElement('div');
    el.className = `ot-node ${n.indent}`;
    el.style.animationDelay = `${0.9 + i * 0.07}s`;
    el.style.opacity = '0';
    el.style.animation = `fadeUp 0.4s ${0.9 + i * 0.06}s forwards`;

    const dot = document.createElement('div');
    dot.className = `ot-dot ${n.dot}`;

    const label = document.createElement('span');
    label.textContent = n.label;
    label.style.fontFamily = 'JetBrains Mono, monospace';
    label.style.fontSize   = '0.7rem';
    label.style.color      = 'var(--text-secondary)';

    el.appendChild(dot);
    el.appendChild(label);
    container.appendChild(el);
  });
})();


/* ─── Tab Switching ─────────────────────────────────────────── */
(function initTabs() {
  const tabsContainer = document.getElementById('compare-tabs');
  if (!tabsContainer) return;

  tabsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;

    const tabId = btn.dataset.tab;
    if (!tabId) return;

    // update buttons
    tabsContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-active'));
    btn.classList.add('tab-active');

    // update content
    document.querySelectorAll('.tab-content').forEach(c => {
      c.classList.remove('tab-active-content');
    });
    const target = document.getElementById(`tab-${tabId}`);
    if (target) {
      target.classList.add('tab-active-content');
    }
  });
})();


/* ─── Scroll-based Nav Highlight ────────────────────────────── */
(function initScrollNav() {
  const sections = ['part1', 'part2', 'part3', 'part4', 'compare', 'timeline'];
  const navLinks  = document.querySelectorAll('.nav-link');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(link => {
          link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(id => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
})();


/* ─── Smooth Scroll for Nav Links ───────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});


/* ─── Intersection Observer: fade-in on scroll ──────────────── */
(function initScrollReveal() {
  const targets = document.querySelectorAll(
    '.phil-card, .chain-node, .sync-card, .hist-content, .card-dark, .rhi-layer'
  );

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        entry.target.style.opacity    = '1';
        entry.target.style.transform  = 'translateY(0)';
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -60px 0px' });

  targets.forEach(el => {
    el.style.opacity   = '0';
    el.style.transform = 'translateY(16px)';
    io.observe(el);
  });
})();


/* ─── Code Block Hover: copy-to-clipboard hint ──────────────── */
(function initCodeCopy() {
  const blocks = document.querySelectorAll(
    '.node-code, .vma-code, .struct-code, .dir-tree, pre'
  );

  blocks.forEach(block => {
    block.style.position = 'relative';
    block.style.cursor   = 'pointer';

    const hint = document.createElement('div');
    hint.textContent = 'click to copy';
    hint.style.cssText = `
      position: absolute; top: 6px; right: 8px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.6rem;
      color: var(--text-dim);
      opacity: 0;
      transition: opacity 0.2s;
      pointer-events: none;
    `;
    block.appendChild(hint);

    block.addEventListener('mouseenter', () => { hint.style.opacity = '1'; });
    block.addEventListener('mouseleave', () => { hint.style.opacity = '0'; });

    block.addEventListener('click', () => {
      const text = block.innerText.replace('click to copy', '').trim();
      navigator.clipboard.writeText(text).then(() => {
        hint.textContent = '✓ copied!';
        hint.style.color = 'var(--accent-green)';
        hint.style.opacity = '1';
        setTimeout(() => {
          hint.textContent = 'click to copy';
          hint.style.color = 'var(--text-dim)';
        }, 1500);
      }).catch(() => {
        hint.textContent = 'copy failed';
        hint.style.color = 'var(--accent-red)';
        hint.style.opacity = '1';
        setTimeout(() => {
          hint.textContent = 'click to copy';
          hint.style.color = 'var(--text-dim)';
        }, 1500);
      });
    });
  });
})();


/* ─── Keyboard Navigation ───────────────────────────────────── */
(function initKeyNav() {
  const sectionIds = ['part1', 'part2', 'part3', 'part4', 'compare', 'timeline'];
  let currentIdx   = -1;

  function scrollToSection(idx) {
    const el = document.getElementById(sectionIds[idx]);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      currentIdx = idx;
    }
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault();
      scrollToSection(Math.min(currentIdx + 1, sectionIds.length - 1));
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault();
      scrollToSection(Math.max(currentIdx - 1, 0));
    }
  });
})();


/* ─── Pipeline Stage Tooltip ────────────────────────────────── */
(function initPipelineTooltips() {
  const stageInfo = {
    'Input Assembly':   'VkPipelineInputAssemblyStateCreateInfo\ntopology: TRIANGLE_LIST / STRIP / FAN\nprimitiveRestartEnable: VK_FALSE',
    'Vertex Shader':    'SPIR-V 可编程阶段\n从 VertexBuffer 读取顶点数据\n输出裁剪空间坐标 gl_Position',
    'Tessellation':     'TCS (Hull) + TES (Domain)\n可选阶段，用于细分曲面\n需要 VkPhysicalDeviceFeatures::tessellationShader',
    'Geometry Shader':  '可选阶段，每图元调用一次\n性能较低，现代替代方案：Mesh Shader\n可生成新图元或丢弃图元',
    'Rasterization':    'VkPipelineRasterizationStateCreateInfo\ncullMode: BACK_BIT\nfrontFace: COUNTER_CLOCKWISE\ndepthBiasEnable: 阴影 bias 控制',
    'Fragment Shader':  'SPIR-V 可编程阶段\n每个片元（像素）调用一次\n输出颜色到颜色附件',
    'Color Blend':      'VkPipelineColorBlendAttachmentState\nblendEnable: VK_TRUE\nsrcColorBlendFactor: SRC_ALPHA\ndstColorBlendFactor: ONE_MINUS_SRC_ALPHA',
  };

  // Create global tooltip element
  const tooltip = document.createElement('div');
  tooltip.style.cssText = `
    position: fixed;
    background: #05080d;
    border: 1px solid var(--border-bright);
    border-radius: 6px;
    padding: 10px 14px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.68rem;
    color: var(--text-code);
    white-space: pre;
    line-height: 1.6;
    pointer-events: none;
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.15s;
    max-width: 340px;
    box-shadow: 0 4px 20px #00000088;
  `;
  document.body.appendChild(tooltip);

  document.querySelectorAll('.pipe-stage').forEach(stage => {
    const name = stage.querySelector('.stage-name')?.textContent?.trim();
    if (!name || !stageInfo[name]) return;

    stage.addEventListener('mouseenter', (e) => {
      tooltip.textContent = stageInfo[name];
      tooltip.style.opacity = '1';
      positionTooltip(e);
    });
    stage.addEventListener('mousemove', positionTooltip);
    stage.addEventListener('mouseleave', () => {
      tooltip.style.opacity = '0';
    });
  });

  function positionTooltip(e) {
    const x = e.clientX + 14;
    const y = e.clientY - 10;
    const rect = tooltip.getBoundingClientRect();
    tooltip.style.left = Math.min(x, window.innerWidth  - rect.width  - 16) + 'px';
    tooltip.style.top  = Math.max(y, 8) + 'px';
  }
})();


/* ─── Sync Card Interaction — visual pulse on click ─────────── */
(function initSyncCardPulse() {
  document.querySelectorAll('.sync-card').forEach(card => {
    card.addEventListener('click', () => {
      card.style.transition = 'box-shadow 0.1s';
      const color = card.classList.contains('sync-fence')
        ? '#ff456060' : card.classList.contains('sync-sem')
        ? '#00c8ff40' : '#b060ff40';
      card.style.boxShadow = `0 0 30px ${color}`;
      setTimeout(() => { card.style.boxShadow = ''; }, 600);
    });
  });
})();


/* ─── History Timeline — progressive reveal ─────────────────── */
(function initHistoryReveal() {
  const items = document.querySelectorAll('.hist-item');

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        entry.target.style.opacity    = '1';
        entry.target.style.transform  = 'translateX(0)';
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -40px 0px' });

  items.forEach(el => {
    el.style.opacity   = '0';
    el.style.transform = 'translateX(-20px)';
    io.observe(el);
  });
})();


/* ─── Header scroll shrink ──────────────────────────────────── */
(function initHeaderScroll() {
  const header = document.querySelector('.site-header');
  if (!header) return;

  let lastScroll = 0;
  window.addEventListener('scroll', () => {
    const scroll = window.scrollY;
    if (scroll > 60) {
      header.style.boxShadow = '0 2px 20px #00000060';
    } else {
      header.style.boxShadow = '';
    }
    lastScroll = scroll;
  }, { passive: true });
})();


/* ─── Descriptor Set — interactive highlight ────────────────── */
(function initDescriptorHighlight() {
  const rows = document.querySelectorAll('.set-freq-table .vk-table tbody tr');
  rows.forEach(row => {
    row.addEventListener('mouseenter', () => {
      row.style.background = 'var(--bg-card-hover)';
    });
    row.addEventListener('mouseleave', () => {
      row.style.background = '';
    });
  });
})();


/* ─── console Easter Egg ────────────────────────────────────── */
console.log(
  '%c Vulkan Notes %c v1.0 ',
  'background:#ac3232;color:#fff;font-weight:bold;padding:4px 8px;border-radius:4px 0 0 4px;font-family:monospace',
  'background:#1e2d3d;color:#00c8ff;padding:4px 8px;border-radius:0 4px 4px 0;font-family:monospace'
);
console.log('%c// 从 Instance 到 Swapchain，从同步原语到 Bindless', 'color:#6a8a6a;font-family:monospace;font-size:12px');
