/* toc.js - 滚动高亮 + 分级折叠展开 */
document.addEventListener('DOMContentLoaded', () => {
  const tocLinks = document.querySelectorAll('.post-toc-link');
  const headings = Array.from(document.querySelectorAll(
    '.post-content__body h1, .post-content__body h2, .post-content__body h3, .post-content__body h4'
  ));
  const headerHeight = 90;

  if (!tocLinks.length || !headings.length) return;

  // --- 折叠辅助函数 ---

  // 获取某个 <li> 的直接子 <ol>（即下一级列表）
  const getChildList = (li) => li.querySelector(':scope > ol');

  // 展开一个子列表
  const expandList = (ol) => {
    if (!ol) return;
    ol.classList.add('toc-expanded');
  };

  // 获取某个 <li> 所属的父 <li>（向上找最近的 li 祖先）
  const getParentLi = (li) => {
    const parentOl = li.parentElement; // <ol>
    if (!parentOl) return null;
    const grandParent = parentOl.parentElement; // 可能是 <li> 或 .toc-outer
    return grandParent && grandParent.tagName === 'LI' ? grandParent : null;
  };

  // 获取某个 <li> 的 level（从 class 中读取）
  const getLevel = (li) => {
    const match = li.className.match(/post-toc-level-(\d+)/);
    return match ? parseInt(match[1], 10) : 1;
  };

  // 折叠所有子列表（初始化用）
  const collapseAll = () => {
    document.querySelectorAll('.toc-outer ol ol').forEach(ol => {
      ol.classList.remove('toc-expanded');
    });
  };

  // --- 核心激活函数 ---
  const activate = (id) => {
    if (!id) return;

    // 清除所有激活状态
    document.querySelectorAll('.post-toc-item').forEach(item => {
      item.classList.remove('active');
    });

    const activeLink = document.querySelector(`.post-toc-link[href="#${id}"]`);
    if (!activeLink) return;

    const activeLi = activeLink.closest('.post-toc-item');
    if (!activeLi) return;

    activeLi.classList.add('active');
    activeLi.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    const activeLevel = getLevel(activeLi);

    // 折叠所有子列表，然后按需展开
    collapseAll();

    if (activeLevel === 1) {
      // 当前在 h1：展开其直接子列表（h2 层）
      expandList(getChildList(activeLi));

    } else if (activeLevel === 2) {
      // 当前在 h2：展开父 h1 的子列表（保持 h2 可见），并展开自身子列表（h3 层）
      const parentLi = getParentLi(activeLi);
      if (parentLi) {
        expandList(getChildList(parentLi));
      }
      expandList(getChildList(activeLi));

    } else if (activeLevel >= 3) {
      // 当前在 h3+：展开整条祖先链
      let current = activeLi;
      while (current) {
        const parent = getParentLi(current);
        if (parent) {
          expandList(getChildList(parent));
        }
        current = parent;
      }
      // 展开自身子列表（如果有 h4）
      expandList(getChildList(activeLi));
    }
  };

  // --- 初始化：折叠所有，然后激活当前位置 ---
  collapseAll();

  const initActive = () => {
    let currentId = '';
    const scrollPos = window.scrollY;

    if (scrollPos <= headerHeight) {
      currentId = headings[0].getAttribute('id');
    } else {
      for (let i = headings.length - 1; i >= 0; i--) {
        const top = headings[i].getBoundingClientRect().top;
        if (top <= headerHeight + 20) {
          currentId = headings[i].getAttribute('id');
          break;
        }
      }
    }
    activate(currentId);
  };

  // --- IntersectionObserver 滚动监听 ---
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        activate(entry.target.getAttribute('id'));
      }
    });
  }, {
    rootMargin: '-80px 0px -70% 0px',
    threshold: 0
  });

  headings.forEach(heading => observer.observe(heading));
  initActive();
});
