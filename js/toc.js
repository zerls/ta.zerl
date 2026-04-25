/* toc.js - 高性能滚动高亮监听 (支持默认生效) */
document.addEventListener('DOMContentLoaded', () => {
  const tocLinks = document.querySelectorAll('.post-toc-link');
  const headings = Array.from(document.querySelectorAll('.post-content__body h1, .post-content__body h2, .post-content__body h3, .post-content__body h4'));
  const headerHeight = 90; // 考虑导航栏高度的偏移量

  if (!tocLinks.length || !headings.length) return;

  // 1. 核心激活函数：统一处理文字变色与圆点显示
  const activate = (id) => {
    if (!id) return;
    
    // 清除所有旧状态
    document.querySelectorAll('.post-toc-item').forEach(item => {
      item.classList.remove('active');
    });

    // 匹配并激活当前项
    const activeLink = document.querySelector(`.post-toc-link[href="#${id}"]`);
    if (activeLink) {
      const listItem = activeLink.closest('.post-toc-item');
      if (listItem) {
        listItem.classList.add('active');
        // 自动滚动目录区域，确保激活项可见
        listItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  };

  // 2. 初始化检测：让脚本在加载时“默认生效”
  const initActive = () => {
    let currentId = '';
    const scrollPos = window.scrollY;

    // 如果在页面最顶部，默认激活第一个标题
    if (scrollPos <= headerHeight) {
      currentId = headings[0].getAttribute('id');
    } else {
      // 否则，从下往上找第一个位于触发线以上的标题
      for (let i = headings.length - 1; i >= 0; i--) {
        const top = headings[i].getBoundingClientRect().top;
        if (top <= headerHeight + 20) { // 留出 20px 的余量
          currentId = headings[i].getAttribute('id');
          break;
        }
      }
    }
    activate(currentId);
  };

  // 3. 动态监听：IntersectionObserver 处理滚动中的高效切换
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      // 只有当标题进入我们设定的“触发带”时才更新状态
      if (entry.isIntersecting) {
        activate(entry.target.getAttribute('id'));
      }
    });
  }, {
    // 判定区域：避开顶部导航栏，触发点设在视口上半部分
    rootMargin: '-80px 0px -70% 0px',
    threshold: 0
  });

  // 开始观察所有标题
  headings.forEach(heading => observer.observe(heading));

  // 立即执行初始化检测
  initActive();
});