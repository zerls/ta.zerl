/** hexo-mindmap-svg - 合并构建 */
(function(){

// ===== parser.js =====
/**
 * Markdown 缩进解析器 (Parser)
 * 将缩进层级树形 Markdown 文本解析为 JSON Tree
 *
 * 支持：
 *   - 列表符号: - * + 及 1. 2. 3.
 *   - 缩进粒度: 2空格 / 4空格 / Tab
 *   - 多行文本 (节点内容可换行)
 *   - 特殊属性 {style:xxx, note:xxx}
 *   - 保留 LaTeX 标记 $...$ $$...$$
 *   - 保留富文本标记 **加粗** *斜体* `代码`
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MindmapParser = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * 检测文本的缩进单位
   */
  function detectIndent(text) {
    var lines = text.split('\n');
    var counts = { 2: 0, 4: 0, tab: 0 };

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.trim().length === 0) continue;

      var match = line.match(/^(\s+)/);
      if (!match) continue;

      var leading = match[1];
      if (leading.indexOf('\t') !== -1) {
        counts.tab += (leading.match(/\t/g) || []).length;
      } else {
        var len = leading.length;
        if (len >= 4 && len % 4 === 0) counts[4] += len / 4;
        if (len >= 2 && len % 2 === 0) counts[2] += len / 2;
      }
    }

    if (counts.tab > Math.max(counts[2], counts[4])) {
      return { unit: 'tab', size: 1 };
    }
    if (counts[4] > counts[2]) {
      return { unit: 'space', size: 4 };
    }
    return { unit: 'space', size: 2 };
  }

  /**
   * 计算缩进级别
   */
  function getIndentLevel(line, indentConfig) {
    var leading = line.match(/^(\s*)/)[1];
    if (indentConfig.unit === 'tab') {
      return (leading.match(/\t/g) || []).length;
    }
    return Math.floor(leading.length / indentConfig.size);
  }

  /**
   * 解析一行，提取节点名和属性
   */
  function parseLine(line) {
    var trimmed = line.trim();
    if (trimmed.length === 0) return null;

    // 匹配列表符号
    var match = trimmed.match(/^([-*+]|\d+[\.\、])\s+(.+)/);
    if (!match) return null;

    var content = match[2];
    var attrs = {};

    // 检查特殊属性 {key:value, key2:value2}
    var attrMatch = content.match(/\s*\{(.+)\}$/);
    if (attrMatch) {
      var attrString = attrMatch[1];
      content = content.replace(/\s*\{[^}]+\}$/, '');

      // 解析 key:value 对
      var pairs = attrString.match(/(\w+)\s*:\s*([^,}]+)/g);
      if (pairs) {
        pairs.forEach(function (pair) {
          var kv = pair.split(':');
          var key = kv[0].trim();
          var value = kv.slice(1).join(':').trim();
          // 去掉可能的引号
          value = value.replace(/^['"]|['"]$/g, '');
          attrs[key] = value;
        });
      }
    }

    return { name: content, attrs: attrs };
  }

  /**
   * 将平铺的 items 构建为嵌套树
   * 使用栈追踪上下级关系
   */
  function buildTree(items) {
    if (items.length === 0) return null;

    var root = { name: 'Root', children: [] };
    var stack = [{ node: root, level: -1 }];

    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var newNode = { name: item.name };

      // 合并属性到节点
      for (var key in item.attrs) {
        if (item.attrs.hasOwnProperty(key)) {
          newNode[key] = item.attrs[key];
        }
      }

      // 回溯到父级：弹出所有 level >= 当前 level 的节点
      while (stack.length > 1 && stack[stack.length - 1].level >= item.level) {
        stack.pop();
      }

      var parent = stack[stack.length - 1].node;
      if (!parent.children) {
        parent.children = [];
      }
      parent.children.push(newNode);

      stack.push({ node: newNode, level: item.level });
    }

    if (root.children.length === 1) {
      return root.children[0];
    }
    return root;
  }

  /**
   * 主解析函数
   * @param {string} markdown - Markdown 文本
   * @returns {Object} 解析后的 JSON Tree
   */
  function parse(markdown) {
    if (!markdown || typeof markdown !== 'string') {
      return { name: '空导图', children: [] };
    }

    var lines = markdown.split('\n');
    var indentConfig = detectIndent(markdown);
    var items = [];

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line.trim().length === 0) continue;

      var parsed = parseLine(line);
      if (!parsed) {
        // 非列表行 → 视为上一个节点的多行文本续行
        if (items.length > 0) {
          items[items.length - 1].name += '\n' + line.trim();
        }
        continue;
      }

      var level = getIndentLevel(line, indentConfig);
      items.push({
        name: parsed.name,
        attrs: parsed.attrs,
        level: level
      });
    }

    if (items.length === 0) {
      return { name: '空导图', children: [] };
    }

    return buildTree(items);
  }

  var MindmapParser = {
    parse: parse,
    detectIndent: detectIndent,
    parseLine: parseLine
  };

  return MindmapParser;
}));


// ===== nodes.js =====
/**
 * XMind 风格节点形状库 (Node Shapes)
 * 使用 SVG 原生绘制各种节点外形
 *
 * 支持形状：
 *   rect, rounded, ellipse, diamond, parallelogram,
 *   hexagon, capsule, underline, cloud, topic
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MindmapNodes = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * 获取节点形状对应的 SVG 路径
   * @param {number} w - 宽度
   * @param {number} h - 高度
   * @param {number} x - 中心 x (偏移用，返回的 path 相对原点)
   * @param {number} y - 中心 y
   * @returns {string} SVG path d 属性
   */
  function getShapePath(shape, w, h) {
    var r;

    switch (shape) {
      case 'rect':
        return rectPath(w, h);

      case 'rounded':
        r = Math.min(w, h) * 0.3;
        return roundedRectPath(w, h, r);

      case 'ellipse':
        return ellipsePath(w, h);

      case 'diamond':
        return diamondPath(w, h);

      case 'parallelogram':
        return parallelogramPath(w, h);

      case 'hexagon':
        return hexagonPath(w, h);

      case 'capsule':
        r = h / 2;
        return capsulePath(w, h, r);

      case 'underline':
        return underlinePath(w, h);

      case 'cloud':
        return cloudPath(w, h);

      case 'topic':
        r = Math.min(w, h) * 0.25;
        return roundedRectPath(w, h, r);

      default:
        r = Math.min(w, h) * 0.3;
        return roundedRectPath(w, h, r);
    }
  }

  function rectPath(w, h) {
    var hw = w / 2, hh = h / 2;
    return 'M' + (-hw) + ',' + (-hh) +
      ' L' + hw + ',' + (-hh) +
      ' L' + hw + ',' + hh +
      ' L' + (-hw) + ',' + hh + ' Z';
  }

  function roundedRectPath(w, h, r) {
    var hw = w / 2, hh = h / 2;
    r = Math.min(r, hw, hh);
    return 'M' + (-hw + r) + ',' + (-hh) +
      ' L' + (hw - r) + ',' + (-hh) +
      ' Q' + hw + ',' + (-hh) + ' ' + hw + ',' + (-hh + r) +
      ' L' + hw + ',' + (hh - r) +
      ' Q' + hw + ',' + hh + ' ' + (hw - r) + ',' + hh +
      ' L' + (-hw + r) + ',' + hh +
      ' Q' + (-hw) + ',' + hh + ' ' + (-hw) + ',' + (hh - r) +
      ' L' + (-hw) + ',' + (-hh + r) +
      ' Q' + (-hw) + ',' + (-hh) + ' ' + (-hw + r) + ',' + (-hh) + ' Z';
  }

  function ellipsePath(w, h) {
    return 'M' + (-w / 2) + ',0 A' + (w / 2) + ',' + (h / 2) + ' 0 1,1 ' + (w / 2) + ',0 ' +
      'A' + (w / 2) + ',' + (h / 2) + ' 0 1,1 ' + (-w / 2) + ',0 Z';
  }

  function diamondPath(w, h) {
    return 'M0,' + (-h / 2) +
      ' L' + (w / 2) + ',0' +
      ' L0,' + (h / 2) +
      ' L' + (-w / 2) + ',0 Z';
  }

  function parallelogramPath(w, h) {
    var skew = w * 0.15;
    var hw = w / 2, hh = h / 2;
    return 'M' + (-hw + skew) + ',' + (-hh) +
      ' L' + (hw + skew) + ',' + (-hh) +
      ' L' + (hw - skew) + ',' + hh +
      ' L' + (-hw - skew) + ',' + hh + ' Z';
  }

  function hexagonPath(w, h) {
    var hw = w / 2, hh = h / 2;
    var indent = hh * 0.35;
    return 'M' + (-hw + indent) + ',' + (-hh) +
      ' L' + (hw - indent) + ',' + (-hh) +
      ' L' + hw + ',0' +
      ' L' + (hw - indent) + ',' + hh +
      ' L' + (-hw + indent) + ',' + hh +
      ' L' + (-hw) + ',0 Z';
  }

  function capsulePath(w, h, r) {
    var hw = w / 2, hh = h / 2;
    r = Math.min(r, hh);
    if (w <= h) {
      // 垂直胶囊
      return 'M' + (-hw) + ',' + (-hh + r) +
        ' A' + r + ',' + r + ' 0 0,1 ' + hw + ',' + (-hh + r) +
        ' A' + r + ',' + r + ' 0 0,1 ' + hw + ',' + (hh - r) +
        ' A' + r + ',' + r + ' 0 0,1 ' + (-hw) + ',' + (hh - r) +
        ' A' + r + ',' + r + ' 0 0,1 ' + (-hw) + ',' + (-hh + r) + ' Z';
    } else {
      return 'M' + (-hw + r) + ',' + (-hh) +
        ' L' + (hw - r) + ',' + (-hh) +
        ' A' + r + ',' + r + ' 0 0,1 ' + (hw - r) + ',' + hh +
        ' L' + (-hw + r) + ',' + hh +
        ' A' + r + ',' + r + ' 0 0,1 ' + (-hw + r) + ',' + (-hh) + ' Z';
    }
  }

  function underlinePath(w, h) {
    // 仅底部横线
    var hw = w / 2, hh = h / 2;
    return 'M' + (-hw) + ',' + hh +
      ' L' + hw + ',' + hh;
  }

  function cloudPath(w, h) {
    // 云朵形：用多个弧线拼接
    var hw = w / 2, hh = h / 2;
    var r = Math.min(w, h) * 0.15;
    // 简化版本：使用带多处鼓包的路径
    var bump = r * 1.2;
    return 'M' + (-hw + bump) + ',' + (-hh) +
      ' Q' + (-hw / 2) + ',' + (-hh - bump) + ' 0,' + (-hh + bump * 0.5) +
      ' Q' + (hw / 2) + ',' + (-hh - bump) + ' ' + (hw - bump) + ',' + (-hh) +
      ' Q' + (hw + bump) + ',' + (-hh / 2) + ' ' + (hw - bump * 0.5) + ',0' +
      ' Q' + (hw + bump) + ',' + (hh / 2) + ' ' + (hw - bump) + ',' + hh +
      ' Q' + (hw / 2) + ',' + (hh + bump * 0.5) + ' 0,' + (hh - bump * 0.3) +
      ' Q' + (-hw / 2) + ',' + (hh + bump * 0.5) + ' ' + (-hw + bump) + ',' + hh +
      ' Q' + (-hw - bump * 0.5) + ',' + (hh / 2) + ' ' + (-hw + bump * 0.3) + ',0' +
      ' Q' + (-hw - bump * 0.5) + ',' + (-hh / 2) + ' ' + (-hw + bump) + ',' + (-hh) + ' Z';
  }

  /**
   * 判断节点是否为根主题
   */
  function isRootNode(d) {
    return !d.parent || d.depth === 0;
  }

  /**
   * 获取节点默认形状
   */
  function getDefaultShape(d) {
    if (d.data && d.data.style) return d.data.style;
    if (isRootNode(d)) return 'topic';
    if (d.depth === 1) return 'rounded';
    return 'rect';
  }

  /**
   * 彩虹调色板 - 9 种主分支颜色
   * 每个一级分支及其子树获得唯一色调
   */
  var RAINBOW_PALETTE = [
    { bg: '#E74C3C', fg: '#ffffff', bgLight: '#FFF0F0', fgLight: '#C0392B', border: '#F5B7B1' },  // 红
    { bg: '#E67E22', fg: '#ffffff', bgLight: '#FFF5EC', fgLight: '#D35400', border: '#FAD7A0' },  // 橙
    { bg: '#F39C12', fg: '#ffffff', bgLight: '#FFFDE7', fgLight: '#D68910', border: '#F9E79F' },  // 金
    { bg: '#27AE60', fg: '#ffffff', bgLight: '#E8F8F0', fgLight: '#1E8449', border: '#A9DFBF' },  // 绿
    { bg: '#1ABC9C', fg: '#ffffff', bgLight: '#E8F9F7', fgLight: '#148F77', border: '#A3E4D7' },  // 青
    { bg: '#3498DB', fg: '#ffffff', bgLight: '#EBF5FB', fgLight: '#2471A3', border: '#AED6F1' },  // 蓝
    { bg: '#9B59B6', fg: '#ffffff', bgLight: '#F4ECF7', fgLight: '#7D3C98', border: '#D7BDE2' },  // 紫
    { bg: '#E91E63', fg: '#ffffff', bgLight: '#FDE8EF', fgLight: '#C2185B', border: '#F5B7C8' },  // 粉
    { bg: '#00BCD4', fg: '#ffffff', bgLight: '#E0F7FA', fgLight: '#00838F', border: '#80DEEA' }   // 氰
  ];

  /**
   * 查找节点所属的一级分支索引
   * 沿着树向上走到 root 的直接子节点
   */
  function getBranchIndex(d) {
    var node = d;
    while (node.parent && node.parent.parent) {
      node = node.parent;
    }
    if (node.parent && node.parent.children) {
      var idx = node.parent.children.indexOf(node);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  }

  /**
   * 获取节点颜色
   */
  function getNodeColor(d, theme) {
    theme = theme || 'light';
    var colors = {
      light: {
        root: { fill: '#4A90D9', stroke: '#357ABD', text: '#ffffff' },
        branch: { fill: '#f5f7fa', stroke: '#d0d7de', text: '#333333' },
        leaf: { fill: '#ffffff', stroke: '#e1e4e8', text: '#555555' }
      },
      dark: {
        root: { fill: '#58a6ff', stroke: '#1f6feb', text: '#ffffff' },
        branch: { fill: '#21262d', stroke: '#30363d', text: '#c9d1d9' },
        leaf: { fill: '#161b22', stroke: '#30363d', text: '#8b949e' }
      }
    };

    // 彩虹主题：按分支索引映射颜色
    if (theme === 'rainbow') {
      if (isRootNode(d)) {
        return { fill: '#5B6ABF', stroke: '#4A54A0', text: '#ffffff' };
      }
      var branchIdx = getBranchIndex(d);
      var branchColor = RAINBOW_PALETTE[branchIdx % RAINBOW_PALETTE.length];

      if (d.children && d.children.length > 0) {
        // 分支节点：深色底白字
        return { fill: branchColor.bg, stroke: branchColor.bg, text: branchColor.fg };
      }
      // 叶子节点：浅色底深字
      return { fill: branchColor.bgLight, stroke: branchColor.border, text: branchColor.fgLight };
    }

    var palette = colors[theme] || colors.light;

    if (isRootNode(d)) return palette.root;
    if (d.children && d.children.length > 0) return palette.branch;
    return palette.leaf;
  }

  var MindmapNodes = {
    getShapePath: getShapePath,
    getDefaultShape: getDefaultShape,
    getNodeColor: getNodeColor,
    isRootNode: isRootNode,
    getBranchIndex: getBranchIndex,
    RAINBOW_PALETTE: RAINBOW_PALETTE
  };

  return MindmapNodes;
}));


// ===== layout.js =====
/**
 * SVG 布局引擎 (Layout Engine)
 * 基于 D3.tree() 计算节点坐标
 * 支持多种布局方向和有机连线
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['d3'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('d3'));
  } else {
    root.MindmapLayout = factory(root.d3);
  }
}(typeof self !== 'undefined' ? self : this, function (d3) {
  'use strict';

  /**
   * 默认配置
   */
  var DEFAULTS = {
    direction: 'lr',          // lr | rl | tb | bt | lr-both
    nodeWidth: 180,           // 节点宽度（增加，防重叠）
    nodeHeight: 40,            // 节点高度
    nodePaddingX: 100,        // 节点水平间距（增加，防重叠）
    nodePaddingY: 12,         // 节点垂直间距
    margin: { top: 40, right: 160, bottom: 40, left: 160 },
    lineStyle: 'curved'       // straight | curved | angled | organic
  };

  /**
   * 根据文本估算节点尺寸
   */
  function estimateNodeSize(name, config) {
    var lines = name.split('\n');
    var maxLineLen = 0;
    var fontSize = 13;

    lines.forEach(function (line) {
      // 移除标记符号后计算长度
      var clean = line.replace(/[#*_`$\\{}[\]]/g, '');
      var len = clean.length;
      if (len > maxLineLen) maxLineLen = len;
    });

    var width = Math.max(config.nodeWidth, maxLineLen * (fontSize * 0.65) + 32);
    var height = Math.max(config.nodeHeight, lines.length * (fontSize * 1.5) + 16);
    return { width: width, height: height };
  }

  /**
   * 判断布局方向是否水平
   */
  function isHorizontal(direction) {
    return direction === 'lr' || direction === 'rl' || direction === 'lr-both';
  }

  /**
   * 判断是否为自右向左
   */
  function isReversed(direction) {
    return direction === 'rl' || direction === 'bt';
  }

  /**
   * 直接在原始树上设置节点尺寸（避免拷贝，保证 d.data === 原始节点）
   * toggleNode 修改才能持久化到 this.currentData 中
   */
  function addSizesToTree(node, config) {
    if (!node) return;
    var size = estimateNodeSize(node.name, config);
    node._width = size.width;
    node._height = size.height;
    if (node.children) {
      node.children.forEach(function (c) { addSizesToTree(c, config); });
    }
    if (node._children) {
      node._children.forEach(function (c) { addSizesToTree(c, config); });
    }
  }

  /**
   * 主布局函数
   */
  function layout(root, config) {
    config = Object.assign({}, DEFAULTS, config || {});
    var margin = config.margin;

    // 直接在原始树上添加尺寸信息（不拷贝，保证 d.data === 原始节点，使 toggle 持久化）
    addSizesToTree(root, config);

    // 构建 d3.tree() 分层
    var hierarchy = d3.hierarchy(root, function (d) { return d.children; });

    // 为所有节点预设尺寸（d.data 即原始节点，已有 _width/_height）
    hierarchy.each(function (d) {
      d._nodeWidth = d.data._width || config.nodeWidth;
      d._nodeHeight = d.data._height || config.nodeHeight;
    });

    // d3.tree 自然生长方向是自顶向下
    // 水平布局(lr/rl)需旋转 90°:
    //   nodeSize[0](x轴) → 兄弟间距 → 旋转后为 SVG 纵向 → 用 nodeHeight
    //   nodeSize[1](y轴) → 层级间距 → 旋转后为 SVG 横向 → 用 nodeWidth
    // 垂直布局(tb/bt)不旋转:
    //   nodeSize[0](x轴) → 兄弟间距 → 直接是 SVG 横向 → 用 nodeWidth
    //   nodeSize[1](y轴) → 层级间距 → 直接是 SVG 纵向 → 用 nodeHeight
    var treeLayout = d3.tree()
      .separation(function (a, b) {
        return (a.parent === b.parent) ? 1.5 : 2;
      });

    if (isHorizontal(config.direction)) {
      treeLayout.nodeSize([config.nodeHeight + config.nodePaddingY, config.nodeWidth + config.nodePaddingX]);
    } else {
      treeLayout.nodeSize([config.nodeWidth + config.nodePaddingX, config.nodeHeight + config.nodePaddingY]);
    }

    treeLayout(hierarchy);

    var nodes = hierarchy.descendants();

    if (config.direction === 'lr-both') {
      // ===== 双向布局：奇偶分支分别左右展开 =====
      var rootNode = nodes[0];

      // 保存原始坐标
      nodes.forEach(function (d) {
        d._ox = d.x;
        d._oy = d.y;
      });

      // 为一级子节点标记：偶数→右(0)、奇数→左(1)
      // 防止单节点空树时 rootNode.children 为 undefined 导致崩溃
      var sideMap = {};
      if (rootNode.children) {
        rootNode.children.forEach(function (child, i) {
          sideMap[child.data.name + '#' + child.depth] = i % 2;
        });
      }

      nodes.forEach(function (d) {
        if (d === rootNode) {
          d.x = margin.left;
          d.y = d._ox + margin.top;
          return;
        }
        // 找到该节点的一级祖先
        var anc = d;
        while (anc.parent && anc.parent !== rootNode) { anc = anc.parent; }
        var side = anc === rootNode ? 0 : (sideMap[anc.data.name + '#' + anc.depth] || 0);

        if (side === 0) {
          // 右侧：正常 lr
          d.x = margin.left + d._oy;
          d.y = d._ox + margin.top;
        } else {
          // 左侧：x 镜像 (根节点 _oy 为基准)
          d.x = margin.left - (d._oy - rootNode._oy);
          d.y = d._ox + margin.top;
        }
      });
    } else {
      // ===== 单向布局 =====
      nodes.forEach(function (d) {
        var ox = d.x, oy = d.y;
        switch (config.direction) {
          case 'lr':
            d.x = oy + margin.left;
            d.y = ox + margin.top;
            break;
          case 'rl':
            d.x = -oy;
            d.y = ox + margin.top;
            break;
          case 'tb':
            d.x = ox + margin.left;
            d.y = oy + margin.top;
            break;
          case 'bt':
            d.x = ox + margin.left;
            d.y = -oy;
            break;
          default:
            d.x = oy + margin.left;
            d.y = ox + margin.top;
        }
      });
    }

    // 计算边界
    var maxX = -Infinity, maxY = -Infinity, minX = Infinity, minY = Infinity;
    nodes.forEach(function (d) {
      if (d.x > maxX) maxX = d.x;
      if (d.y > maxY) maxY = d.y;
      if (d.x < minX) minX = d.x;
      if (d.y < minY) minY = d.y;
    });

    // rl/bt 方向偏移校正
    if (config.direction === 'rl') {
      var ox = maxX - minX;
      nodes.forEach(function (d) { d.x = d.x + ox + margin.right; });
      maxX += ox + margin.right;
    }
    if (config.direction === 'bt') {
      var oy = maxY - minY;
      nodes.forEach(function (d) { d.y = d.y + oy + margin.bottom; });
      maxY += oy + margin.bottom;
    }

    // lr-both: 全部节点平移至可见区
    if (config.direction === 'lr-both') {
      var shift = margin.left - minX;
      nodes.forEach(function (d) { d.x += shift; });
      maxX += shift;
      minX = margin.left;
    }

    // 生成连线
    var links = hierarchy.links();
    var linkPaths = links.map(function (link) {
      return {
        source: link.source,
        target: link.target,
        path: generateLinkPath(link.source, link.target, config)
      };
    });

    return {
      nodes: nodes,
      links: linkPaths,
      svgWidth: Math.max(maxX + margin.right + 200, 1000),
      svgHeight: Math.max(maxY + margin.bottom + 200, 600),
      minX: minX,
      minY: minY,
      config: config,
      root: hierarchy
    };
  }

  /**
   * 生成连线路径
   */
  function generateLinkPath(source, target, config) {
    var sx, sy, tx, ty;
    var sw2 = (source._nodeWidth || config.nodeWidth) / 2;
    var sh2 = (source._nodeHeight || config.nodeHeight) / 2;
    var tw2 = (target._nodeWidth || config.nodeWidth) / 2;
    var th2 = (target._nodeHeight || config.nodeHeight) / 2;

    var horizontal = isHorizontal(config.direction);

    // lr-both: 根据 target 实际位置判断左右
    var isTargetLeft = (config.direction === 'lr-both' && target.x < source.x);
    var reversed = isReversed(config.direction) || isTargetLeft;

    if (horizontal) {
      if (reversed) {
        sx = source.x - sw2;
        tx = target.x + tw2;
      } else {
        sx = source.x + sw2;
        tx = target.x - tw2;
      }
      sy = source.y;
      ty = target.y;
    } else {
      // 垂直布局
      sx = source.x;
      tx = target.x;
      if (reversed) {
        sy = source.y - sh2;
        ty = target.y + th2;
      } else {
        sy = source.y + sh2;
        ty = target.y - th2;
      }
    }

    switch (config.lineStyle) {
      case 'straight':
        return straightPath(sx, sy, tx, ty, horizontal);

      case 'curved':
        return curvedPath(sx, sy, tx, ty, horizontal, reversed);

      case 'angled':
        return angledPath(sx, sy, tx, ty, horizontal, reversed);

      case 'organic':
        return organicPath(sx, sy, tx, ty, horizontal, reversed, source, target, config);

      default:
        return curvedPath(sx, sy, tx, ty, horizontal, reversed);
    }
  }

  function straightPath(sx, sy, tx, ty, horizontal) {
    return 'M' + sx + ',' + sy + ' L' + tx + ',' + ty;
  }

  function curvedPath(sx, sy, tx, ty, horizontal, reversed) {
    var midX;
    if (horizontal) {
      midX = reversed ? (sx - (sx - tx) / 2) : (sx + (tx - sx) / 2);
      return 'M' + sx + ',' + sy +
        ' C' + midX + ',' + sy + ' ' + midX + ',' + ty + ' ' + tx + ',' + ty;
    } else {
      var midY = reversed ? (sy - (sy - ty) / 2) : (sy + (ty - sy) / 2);
      return 'M' + sx + ',' + sy +
        ' C' + sx + ',' + midY + ' ' + tx + ',' + midY + ' ' + tx + ',' + ty;
    }
  }

  function angledPath(sx, sy, tx, ty, horizontal, reversed) {
    if (horizontal) {
      var midX = reversed ? (sx - (sx - tx) / 2) : (sx + (tx - sx) / 2);
      return 'M' + sx + ',' + sy +
        ' L' + midX + ',' + sy +
        ' L' + midX + ',' + ty +
        ' L' + tx + ',' + ty;
    } else {
      var midY = reversed ? (sy - (sy - ty) / 2) : (sy + (ty - sy) / 2);
      return 'M' + sx + ',' + sy +
        ' L' + sx + ',' + midY +
        ' L' + tx + ',' + midY +
        ' L' + tx + ',' + ty;
    }
  }

  function organicPath(sx, sy, tx, ty, horizontal, reversed, source, target, config) {
    // 有机曲线：类似 XMind 的平滑分支
    var dx = tx - sx;
    var dy = ty - sy;
    var sw2 = (source._nodeWidth || config.nodeWidth) / 2;
    var tw2 = (target._nodeWidth || config.nodeWidth) / 2;

    if (horizontal) {
      var cpx1 = sx + Math.abs(dx) * 0.4;
      var cpx2 = tx - Math.abs(dx) * 0.4;
      if (reversed) {
        cpx1 = sx - Math.abs(dx) * 0.4;
        cpx2 = tx + Math.abs(dx) * 0.4;
      }
      return 'M' + sx + ',' + sy +
        ' C' + cpx1 + ',' + sy + ' ' + cpx2 + ',' + ty + ' ' + tx + ',' + ty;
    } else {
      var cpy1 = sy + Math.abs(dy) * 0.4;
      var cpy2 = ty - Math.abs(dy) * 0.4;
      if (reversed) {
        cpy1 = sy - Math.abs(dy) * 0.4;
        cpy2 = ty + Math.abs(dy) * 0.4;
      }
      return 'M' + sx + ',' + sy +
        ' C' + sx + ',' + cpy1 + ' ' + tx + ',' + cpy2 + ' ' + tx + ',' + ty;
    }
  }

  /**
   * 重新计算折叠/展开后的布局（动画用）
   */
  function relayout(hierarchy, config) {
    config = Object.assign({}, DEFAULTS, config || {});
    var margin = config.margin;

    var treeLayout = d3.tree()
      .separation(function (a, b) {
        return (a.parent === b.parent ? 1 : 1.2);
      });

    if (isHorizontal(config.direction)) {
      treeLayout.nodeSize([config.nodeHeight + config.nodePaddingY, config.nodeWidth + config.nodePaddingX]);
    } else {
      treeLayout.nodeSize([config.nodeWidth + config.nodePaddingX, config.nodeHeight + config.nodePaddingY]);
    }

    treeLayout(hierarchy);

    var nodes = hierarchy.descendants();
    var maxX = 0, maxY = 0, minX = Infinity, minY = Infinity;

    nodes.forEach(function (d) {
      var x = d.x, y = d.y;

      switch (config.direction) {
        case 'lr':
          d.x = y + margin.left;
          d.y = x + margin.top;
          break;
        case 'rl':
          d.x = -y;
          d.y = x + margin.top;
          break;
        case 'tb':
          d.x = x + margin.left;
          d.y = y + margin.top;
          break;
        case 'bt':
          d.x = x + margin.left;
          d.y = -y;
          break;
        default:
          d.x = y + margin.left;
          d.y = x + margin.top;
      }

      if (d.x > maxX) maxX = d.x;
      if (d.y > maxY) maxY = d.y;
      if (d.x < minX) minX = d.x;
      if (d.y < minY) minY = d.y;
    });

    if (config.direction === 'rl') {
      var offsetX = maxX - minX;
      nodes.forEach(function (d) { d.x = d.x + offsetX + margin.right; });
      maxX = maxX + offsetX + margin.right;
    }
    if (config.direction === 'bt') {
      var offsetY = maxY - minY;
      nodes.forEach(function (d) { d.y = d.y + offsetY + margin.bottom; });
      maxY = maxY + offsetY + margin.bottom;
    }

    var links = hierarchy.links();
    var linkPaths = links.map(function (link) {
      return {
        source: link.source,
        target: link.target,
        path: generateLinkPath(link.source, link.target, config)
      };
    });

    return {
      nodes: nodes,
      links: linkPaths,
      svgWidth: Math.max(maxX + margin.right + 200, 800),
      svgHeight: Math.max(maxY + margin.bottom + 200, 600),
      minX: minX,
      minY: minY,
      config: config,
      root: hierarchy
    };
  }

  var MindmapLayout = {
    layout: layout,
    relayout: relayout,
    defaults: DEFAULTS,
    generateLinkPath: generateLinkPath
  };

  return MindmapLayout;
}));


// ===== renderer.js =====
/**
 * SVG 渲染器 (Renderer)
 * 负责将布局数据绘制为 SVG 元素
 * 支持 XMind 风格的节点绘制、连线、文本
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['d3', './nodes', './layout'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('d3'), require('./nodes'), require('./layout'));
  } else {
    root.MindmapRenderer = factory(root.d3, root.MindmapNodes, root.MindmapLayout);
  }
}(typeof self !== 'undefined' ? self : this, function (d3, MindmapNodes, MindmapLayout) {
  'use strict';

  /**
   * 默认配置
   */
  var DEFAULTS = {
    theme: 'light',
    animationDuration: 500,
    enableCulling: false
  };

  /**
   * 渲染思维导图到指定容器
   * @param {string|Element} container - DOM 容器选择器或元素
   * @param {Object} layoutData - 来自 layout() 的布局数据
   * @param {Object} [config] - 渲染配置
   * @returns {Object} 返回 { svg, g, nodes, links }
   */
  function render(container, layoutData, config) {
    config = Object.assign({}, DEFAULTS, config || {});
    var sel = typeof container === 'string'
      ? d3.select(container)
      : d3.select(container);

    // 清空容器
    sel.html('');

    var containerHeight = sel.node().clientHeight;
    if (!containerHeight || containerHeight < 100) {
      containerHeight = 600;
    }

    var svg = sel.append('svg')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('viewBox', '0 0 ' + layoutData.svgWidth + ' ' + layoutData.svgHeight)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('class', 'mindmap-svg mindmap-theme-' + config.theme)
      .style('width', '100%')
      .style('height', containerHeight + 'px')
      .style('display', 'block');

    // 主容器组（用于 zoom/pan）
    var mainGroup = svg.append('g').attr('class', 'mindmap-main-group');

    // 绘制连线
    var linkGroup = mainGroup.append('g').attr('class', 'mindmap-links');
    drawLinks(linkGroup, layoutData.links, config);

    // 绘制节点
    var nodeGroup = mainGroup.append('g').attr('class', 'mindmap-nodes');
    drawNodes(nodeGroup, layoutData.nodes, config);

    return { svg: svg, g: mainGroup, nodes: layoutData.nodes, links: layoutData.links };
  }

  /**
   * 绘制连线
   */
  function drawLinks(linkGroup, links, config) {
    var linkEnter = linkGroup.selectAll('path')
      .data(links, function (d) {
        return d.source.data.name + '-' + d.target.data.name;
      });

    linkEnter.exit().remove();

    var linkMerge = linkEnter.enter()
      .append('path')
      .attr('class', 'mindmap-link')
      .attr('fill', 'none')
      .style('stroke', '#c0c8d0')
      .attr('stroke-width', function (d) {
        return d.target.depth <= 1 ? 2.5 : 1.5;
      })
      .attr('stroke-opacity', function (d) {
        return d.target.depth <= 1 ? 0.7 : 0.4;
      })
      .attr('d', function (d) { return d.path; })
      .merge(linkEnter);

    linkMerge
      .transition().duration(config.animationDuration)
      .attr('d', function (d) { return d.path; });

    // 主题切换：更新连线颜色
    linkMerge
      .style('stroke', '#c0c8d0')
      .attr('stroke-opacity', function (d) {
        return d.target.depth <= 1 ? 0.7 : 0.4;
      });
  }

  /**
   * 绘制节点
   */
  function drawNodes(nodeGroup, nodes, config) {
    var nodeEnter = nodeGroup.selectAll('g.mindmap-node')
      .data(nodes, function (d) { return d.data.id || d.data.name + '-' + d.depth; });

    // 移除旧节点
    nodeEnter.exit()
      .transition().duration(config.animationDuration / 2)
      .attr('opacity', 0)
      .remove();

    // 新建节点组
    var nodeGroupEnter = nodeEnter.enter()
      .append('g')
      .attr('class', 'mindmap-node')
      .attr('data-depth', function (d) { return d.depth; })
      .attr('data-shape', function (d) { return MindmapNodes.getDefaultShape(d); })
      .attr('opacity', 0);

    // 节点形状
    nodeGroupEnter.each(function (d) {
      var g = d3.select(this);
      var shape = MindmapNodes.getDefaultShape(d);
      var w = d._nodeWidth || config.nodeWidth || 160;
      var h = d._nodeHeight || config.nodeHeight || 40;
      var colors = MindmapNodes.getNodeColor(d, config.theme);
      var pathD = MindmapNodes.getShapePath(shape, w, h);

      if (shape !== 'underline') {
        // 主体形状（用 .style 而非 .attr，内联样式优先级高于 CSS 类）
        g.append('path')
          .attr('class', 'mindmap-node-shape')
          .attr('d', pathD)
          .style('fill', colors.fill)
          .style('stroke', colors.stroke)
          .attr('stroke-width', d.depth === 0 ? 2.5 : 1.5);
      } else {
        // 下划线样式：底部横线
        g.append('line')
          .attr('class', 'mindmap-node-underline')
          .attr('x1', -w / 2).attr('x2', w / 2)
          .attr('y1', h / 2).attr('y2', h / 2)
          .style('stroke', colors.stroke)
          .attr('stroke-width', 2);
      }

      // 折叠标记：有子节点或折叠子树的节点，显示小指示点
      var hasChildren = d.children && d.children.length > 0;
      var hasHidden = d.data && d.data._children && d.data._children.length > 0;
      if (hasChildren || hasHidden) {
        var dotR = 3.5;
        var dotX, dotY;
        if (config.direction === 'lr-both' && d.parent === null) {
          dotX = w / 2 + 8; dotY = 0;
        } else if (config.direction === 'lr-both' && d.x < (d.parent ? d.parent.x : 0)) {
          dotX = -w / 2 - 8; dotY = 0;
        } else if (config.direction === 'lr') {
          dotX = w / 2 + 8; dotY = 0;
        } else if (config.direction === 'rl') {
          dotX = -w / 2 - 8; dotY = 0;
        } else if (config.direction === 'tb' || config.direction === 'bt') {
          dotX = 0; dotY = h / 2 + 8;
        } else {
          dotX = w / 2 + 8; dotY = 0;
        }
        g.append('circle')
          .attr('class', 'mindmap-child-indicator')
          .attr('r', dotR)
          .attr('cx', dotX).attr('cy', dotY)
          .style('fill', hasChildren ? '#4A90D9' : '#d0d7de')
          .attr('opacity', 0.7);
      }

      // 文本
      drawNodeText(g, d, w, h, colors, config);
    });

    // 为已有节点和新增节点统一设置位置
    var allNodes = nodeGroupEnter.merge(nodeEnter);

    allNodes
      .transition().duration(config.animationDuration)
      .attr('transform', function (d) {
        return 'translate(' + d.x + ',' + d.y + ')';
      })
      .attr('opacity', 1);

    // 主题切换时更新所有节点颜色（enter + update 都要着色）
    allNodes.each(function (d) {
      var g = d3.select(this);
      var colors = MindmapNodes.getNodeColor(d, config.theme);

      g.select('.mindmap-node-shape')
        .style('fill', colors.fill)
        .style('stroke', colors.stroke);

      g.select('.mindmap-node-underline')
        .style('stroke', colors.stroke);

      g.select('.mindmap-node-text')
        .style('fill', colors.text);
      g.select('.mindmap-node-text').selectAll('tspan')
        .style('fill', colors.text);
    });
  }

  /**
   * 绘制节点文本
   */
  function drawNodeText(g, d, w, h, colors, config) {
    var text = d.data.name || '';
    var lines = text.split('\n');
    var fontSize = d.depth === 0 ? 15 : (d.depth === 1 ? 13 : 12);
    var lineHeight = fontSize * 1.5;

    if (lines.length === 1) {
      // 单行文本
      var textEl = g.append('text')
        .attr('class', 'mindmap-node-text')
        .attr('x', 0).attr('y', 0)
        .attr('dy', '0.35em')
        .attr('text-anchor', 'middle')
        .attr('font-size', fontSize + 'px')
        .attr('font-weight', d.depth === 0 ? 'bold' : 'normal')
        .style('fill', colors.text);

      // 支持富文本：**加粗** *斜体* `代码`
      renderRichText(textEl, text, fontSize);
    } else {
      // 多行文本
      var totalHeight = lines.length * lineHeight;
      var startY = -totalHeight / 2 + lineHeight / 2;

      lines.forEach(function (line, i) {
        var textEl = g.append('text')
          .attr('class', 'mindmap-node-text')
          .attr('x', 0)
          .attr('y', startY + i * lineHeight + lineHeight / 2)
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('font-size', fontSize + 'px')
          .style('fill', colors.text);

        renderRichText(textEl, line, fontSize);
      });
    }
  }

  /**
   * 富文本渲染：支持 **加粗** *斜体* `行内代码`
   */
  function renderRichText(textEl, text, fontSize) {
    // 使用 SVG foreignObject 或 tspan 分段渲染
    // 简化版：直接用 tspan
    var parts = parseRichText(text);

    if (parts.length <= 1) {
      textEl.text(text);
      return;
    }

    textEl.text(''); // 清除默认文本
    parts.forEach(function (part) {
      var tspan = textEl.append('tspan');
      tspan.text(part.text);
      if (part.bold) tspan.attr('font-weight', 'bold');
      if (part.italic) tspan.attr('font-style', 'italic');
      if (part.code) {
        tspan.attr('font-family', 'Consolas, Monaco, monospace');
        tspan.attr('font-size', (fontSize - 1) + 'px');
      }
    });
  }

  /**
   * 解析富文本标记
   */
  function parseRichText(text) {
    var parts = [];
    var regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g;
    var lastIdx = 0;
    var match;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIdx) {
        parts.push({ text: text.substring(lastIdx, match.index), bold: false, italic: false, code: false });
      }

      if (match[1]) {
        parts.push({ text: match[2], bold: true, italic: false, code: false });
      } else if (match[3]) {
        parts.push({ text: match[4], bold: false, italic: true, code: false });
      } else if (match[5]) {
        parts.push({ text: match[6], bold: false, italic: false, code: true });
      }

      lastIdx = match.index + match[0].length;
    }

    if (lastIdx < text.length) {
      parts.push({ text: text.substring(lastIdx), bold: false, italic: false, code: false });
    }

    return parts;
  }

  /**
   * 更新渲染（折叠/展开后）
   */
  function update(svg, layoutData, config) {
    config = Object.assign({}, DEFAULTS, config || {});
    var g = svg.select('g.mindmap-main-group');
    var linkGroup = g.select('g.mindmap-links');
    var nodeGroup = g.select('g.mindmap-nodes');

    // 更新 SVG viewBox
    svg
      .transition().duration(config.animationDuration)
      .attr('viewBox', '0 0 ' + layoutData.svgWidth + ' ' + layoutData.svgHeight);

    // 重绘连线和节点
    drawLinks(linkGroup, layoutData.links, config);
    drawNodes(nodeGroup, layoutData.nodes, config);
  }

  /**
   * 获取 CSS 变量值
   */
  function getCssVar(theme, varName, fallback) {
    if (typeof document !== 'undefined') {
      var container = document.querySelector('.mindmap-container');
      if (container) {
        var val = getComputedStyle(container).getPropertyValue(varName).trim();
        if (val) return val;
      }
    }
    return fallback;
  }

  var MindmapRenderer = {
    render: render,
    update: update,
    parseRichText: parseRichText,
    renderRichText: renderRichText
  };

  return MindmapRenderer;
}));


// ===== interact.js =====
/**
 * 交互系统 (Interaction System)
 * 拖拽、缩放、双击折叠/展开、键盘导航
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['d3'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('d3'));
  } else {
    root.MindmapInteract = factory(root.d3);
  }
}(typeof self !== 'undefined' ? self : this, function (d3) {
  'use strict';

  var DEFAULTS = {
    zoomMin: 0.3,
    zoomMax: 3.0,
    enableZoom: true,
    enableDrag: true,
    enableCollapse: true
  };

  var NS = '.mindmap';

  /**
   * 先解绑旧事件，再绑定新事件
   */
  function bind(instance) {
    unbind(instance);

    var config = Object.assign({}, DEFAULTS, instance.config || {});

    if (config.enableZoom) {
      bindZoom(instance, config);
    }

    if (config.enableCollapse) {
      bindCollapse(instance);
    }

    bindHover(instance);
    bindKeyboard(instance);
    bindContextMenu(instance);
  }

  /**
   * 解绑所有事件（防止重复渲染时累积）
   */
  function unbind(instance) {
    if (instance.svg) {
      instance.svg.on('click' + NS, null);
      instance.svg.on('dblclick' + NS, null);
      instance.svg.on('mouseover' + NS, null);
      instance.svg.on('mouseout' + NS, null);
      instance.svg.on('contextmenu' + NS, null);
      if (instance._zoom) {
        instance.svg.on('.zoom', null);
      }
    }
    var container = instance.container;
    if (typeof container === 'string') container = document.querySelector(container);
    if (container) {
      d3.select(container).on('keydown' + NS, null);
    }
  }

  function bindZoom(instance, config) {
    instance._zoom = d3.zoom()
      .scaleExtent([config.zoomMin, config.zoomMax])
      .on('zoom', function (event) {
        instance.g.attr('transform', event.transform);
      });

    // 调用 zoom 后注销 D3 默认的双击放大行为，释放 dblclick 给折叠逻辑
    instance.svg.call(instance._zoom).on('dblclick.zoom', null);
  }

  /**
   * 双击折叠/展开节点（不需要 +/- UI 按钮）
   */
  function bindCollapse(instance) {
    instance.svg.on('dblclick' + NS, function (event) {
      var nodeG = event.target.closest('.mindmap-node');
      if (!nodeG) {
        // 双击画布空白处：切换全屏
        if (instance._toggleFullscreen) {
          instance._toggleFullscreen();
        }
        return;
      }

      event.stopPropagation();

      var nodeData = d3.select(nodeG).datum();
      if (!nodeData) return;

      // 只对有子节点（含折叠子树）的节点响应
      var hasVisible = nodeData.children && nodeData.children.length > 0;
      var hasHidden = nodeData.data && nodeData.data._children && nodeData.data._children.length > 0;
      if (!hasVisible && !hasHidden) return;

      toggleNode(instance, nodeData);
    });

    // 单击选中节点（不干扰双击）
    instance.svg.on('click' + NS, function (event) {
      // 忽略双击合成事件
      if (event.detail > 1) return;

      var nodeG = event.target.closest('.mindmap-node');
      if (!nodeG) {
        clearSelection(instance);
        return;
      }

      var nodeData = d3.select(nodeG).datum();
      if (nodeData) {
        selectNode(instance, nodeData, d3.select(nodeG));
      }
    });
  }

  function toggleNode(instance, d) {
    var data = d.data;

    if (d.children && d.children.length > 0) {
      data._children = data.children;
      data.children = null;
    } else if (data._children && data._children.length > 0) {
      data.children = data._children;
      data._children = null;
    } else {
      return;
    }

    if (instance.config && instance.config.onToggle) {
      instance.config.onToggle(d);
    }
  }

  function expandAll(instance) {
    // 递归展开所有节点（包括被 collapseDepth 自动折叠的深层子树）
    // descendants() 只能遍历可见节点，无法触及 _children 中的隐藏子树
    function doExpand(dataNode) {
      if (dataNode._children && dataNode._children.length > 0) {
        dataNode.children = dataNode._children;
        dataNode._children = null;
      }
      // 继续深入，children 可能刚被恢复，也可能原本就存在
      var kids = dataNode.children;
      if (kids) {
        kids.forEach(doExpand);
      }
    }

    // 从根节点的原始数据对象开始递归
    var rootData = instance.hierarchy.data;
    if (rootData) {
      doExpand(rootData);
    }

    if (instance.config && instance.config.onToggle) {
      instance.config.onToggle(null);
    }
  }

  function collapseAll(instance, depth) {
    depth = depth || 1;
    var nodes = instance.hierarchy.descendants();
    nodes.forEach(function (node) {
      if (node.depth >= depth && node.data.children && node.data.children.length > 0) {
        node.data._children = node.data.children;
        node.data.children = null;
      }
    });
    if (instance.config && instance.config.onToggle) {
      instance.config.onToggle(null);
    }
  }

  function bindHover(instance) {
    instance.svg.on('mouseover' + NS, function (event) {
      var nodeG = event.target.closest('.mindmap-node');
      if (nodeG) {
        d3.select(nodeG).select('.mindmap-node-shape')
          .transition().duration(150)
          .attr('stroke-width', function () { return 2.5; })
          .attr('stroke', '#4A90D9');
      }
    });

    instance.svg.on('mouseout' + NS, function (event) {
      var nodeG = event.target.closest('.mindmap-node');
      if (nodeG) {
        d3.select(nodeG).select('.mindmap-node-shape')
          .transition().duration(150)
          .attr('stroke-width', null)
          .attr('stroke', null);
      }
    });
  }

  function bindKeyboard(instance) {
    var container = instance.container;
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) return;

    // 仅设置 tabindex 支持键盘聚焦（Tab 键跳转），不自动调用 focus()
    // 避免在 Hexo 多导图页面中自动滚动到最后一个导图
    container.setAttribute('tabindex', '0');

    d3.select(container).on('keydown' + NS, function (event) {
      if (!instance._selectedNode) return;

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          navigateNode(instance, 'prev');
          break;
        case 'ArrowDown':
          event.preventDefault();
          navigateNode(instance, 'next');
          break;
        case 'ArrowLeft':
          event.preventDefault();
          navigateNode(instance, 'prev');
          break;
        case 'ArrowRight':
          event.preventDefault();
          navigateNode(instance, 'next');
          break;
        case ' ':
          event.preventDefault();
          toggleNode(instance, instance._selectedNode);
          break;
        case 'Escape':
          event.preventDefault();
          clearSelection(instance);
          break;
      }
    });
  }

  function selectNode(instance, d, nodeSelection) {
    clearSelection(instance);
    instance._selectedNode = d;
    nodeSelection.select('.mindmap-node-shape')
      .attr('stroke', '#f0ad4e')
      .attr('stroke-width', 3);
  }

  function clearSelection(instance) {
    if (instance._selectedNode) {
      instance._selectedNode = null;
      instance.svg.selectAll('.mindmap-node-shape')
        .attr('stroke', null)
        .attr('stroke-width', null);
    }
  }

  function navigateNode(instance, direction) {
    if (!instance._selectedNode) return;
    var allNodes = instance.hierarchy.descendants();
    var idx = allNodes.indexOf(instance._selectedNode);
    if (idx < 0) return;

    idx = direction === 'next'
      ? Math.min(idx + 1, allNodes.length - 1)
      : Math.max(idx - 1, 0);

    var next = allNodes[idx];
    var nextG = instance.g.selectAll('.mindmap-node')
      .filter(function (d) { return d === next; });
    if (!nextG.empty()) {
      selectNode(instance, next, nextG);
    }
  }

  function bindContextMenu(instance) {
    instance.svg.on('contextmenu' + NS, function (event) {
      event.preventDefault();
    });
  }

  function fitView(instance) {
    if (!instance.svg || !instance._zoom || !instance.layoutData) return;

    var svgEl = instance.svg.node();
    var viewBox = svgEl.viewBox.baseVal;
    var nodes = instance.layoutData.nodes;

    // 计算所有可见节点的实际边界
    var minX = Infinity, minY = Infinity;
    var maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(function (d) {
      if (d.x < minX) minX = d.x;
      if (d.y < minY) minY = d.y;
      if (d.x > maxX) maxX = d.x;
      if (d.y > maxY) maxY = d.y;
    });

    var contentW = Math.max(maxX - minX, 1);
    var contentH = Math.max(maxY - minY, 1);
    var padding = 80;

    // 计算缩放比例：确保所有节点 + padding 都落在 viewBox 内
    var scaleX = viewBox.width / (contentW + padding * 2);
    var scaleY = viewBox.height / (contentH + padding * 2);
    var scale = Math.min(scaleX, scaleY, 1);

    // 内容中心点
    var cx = (minX + maxX) / 2;
    var cy = (minY + maxY) / 2;

    // 将内容中心平移到 SVG viewBox 中心，再缩放
    instance.svg
      .transition()
      .duration(750)
      .call(instance._zoom.transform, d3.zoomIdentity
        .translate(viewBox.width / 2, viewBox.height / 2)
        .scale(scale)
        .translate(-cx, -cy));
  }

  var MindmapInteract = {
    bind: bind,
    unbind: unbind,
    toggleNode: toggleNode,
    expandAll: expandAll,
    collapseAll: collapseAll,
    fitView: fitView,
    selectNode: selectNode,
    clearSelection: clearSelection
  };

  return MindmapInteract;
}));


// ===== minimap.js =====
/**
 * 全局缩略图 (Minimap)
 * 右下角迷你视口，显示导图全局拓扑结构
 * 支持拖拽导航，跟随 zoom/pan 更新视口指示器
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['d3'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('d3'));
  } else {
    root.MindmapMinimap = factory(root.d3);
  }
}(typeof self !== 'undefined' ? self : this, function (d3) {
  'use strict';

  var DEFAULTS = {
    width: 200,
    height: 160,
    padding: 16
  };

  /**
   * 缩放节点坐标到 minimap 内部坐标系
   */
  function scaleNodes(nodes, w, h, pad) {
    if (!nodes || nodes.length === 0) return { nodes: [], sx: 1, sy: 1, minX: 0, minY: 0 };

    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach(function (d) {
      if (d.x < minX) minX = d.x;
      if (d.y < minY) minY = d.y;
      if (d.x > maxX) maxX = d.x;
      if (d.y > maxY) maxY = d.y;
    });

    var dataW = maxX - minX || 1;
    var dataH = maxY - minY || 1;
    var availW = w - pad * 2;
    var availH = h - pad * 2;
    var sx = availW / dataW;
    var sy = availH / dataH;
    var s = Math.min(sx, sy);

    return {
      offsetX: pad + (availW - dataW * s) / 2,
      offsetY: pad + (availH - dataH * s) / 2,
      scale: s,
      minX: minX,
      minY: minY
    };
  }

  function create(instance, config) {
    config = Object.assign({}, DEFAULTS, config || {});

    // 先清理旧 minimap
    remove(instance);

    var container = d3.select(instance.svg.node().parentNode);

    // 创建 minimap 外层容器
    var minimap = container.append('div')
      .attr('class', 'mindmap-minimap')
      .style('position', 'absolute')
      .style('bottom', '16px')
      .style('right', '16px')
      .style('width', config.width + 'px')
      .style('height', config.height + 'px')
      .style('background', 'rgba(255,255,255,0.94)')
      .style('border', '1px solid #d0d7de')
      .style('border-radius', '8px')
      .style('box-shadow', '0 2px 10px rgba(0,0,0,0.10)')
      .style('overflow', 'hidden')
      .style('z-index', '100')
      .style('cursor', 'pointer');

    var svg = minimap.append('svg')
      .attr('width', config.width)
      .attr('height', config.height);

    var bg = svg.append('rect')
      .attr('width', config.width)
      .attr('height', config.height)
      .attr('fill', '#f8fafc');

    // 连线组
    var linkGroup = svg.append('g').attr('class', 'minimap-links');
    // 节点组
    var nodeGroup = svg.append('g').attr('class', 'minimap-nodes');
    // 视口指示器
    var viewport = svg.append('rect')
      .attr('class', 'minimap-viewport')
      .attr('fill', '#4A90D9')
      .attr('fill-opacity', 0.08)
      .attr('stroke', '#4A90D9')
      .attr('stroke-width', 1.5)
      .attr('rx', 2);

    // 重绘 minimap 内部内容
    function redraw() {
      if (!instance.layoutData) return;

      var layoutData = instance.layoutData;
      var nodes = layoutData.nodes;
      var links = layoutData.links;
      var pad = config.padding;

      var sc = scaleNodes(nodes, config.width, config.height, pad);

      // 绘制连线
      var linkSelection = linkGroup.selectAll('line')
        .data(links, function (d) {
          return d.source.data.name + '-' + d.target.data.name;
        });

      linkSelection.exit().remove();

      linkSelection.enter()
        .append('line')
        .merge(linkSelection)
        .attr('x1', function (d) { return (d.source.x - sc.minX) * sc.scale + sc.offsetX; })
        .attr('y1', function (d) { return (d.source.y - sc.minY) * sc.scale + sc.offsetY; })
        .attr('x2', function (d) { return (d.target.x - sc.minX) * sc.scale + sc.offsetX; })
        .attr('y2', function (d) { return (d.target.y - sc.minY) * sc.scale + sc.offsetY; })
        .attr('stroke', '#d0d7de')
        .attr('stroke-width', 0.8);

      // 绘制节点
      var nodeSelection = nodeGroup.selectAll('circle')
        .data(nodes, function (d) {
          return d.data.id || d.data.name + '-' + d.depth;
        });

      nodeSelection.exit().remove();

      nodeSelection.enter()
        .append('circle')
        .merge(nodeSelection)
        .attr('cx', function (d) { return (d.x - sc.minX) * sc.scale + sc.offsetX; })
        .attr('cy', function (d) { return (d.y - sc.minY) * sc.scale + sc.offsetY; })
        .attr('r', function (d) { return d.depth === 0 ? 4.5 : (d.depth <= 1 ? 3 : 2.2); })
        .attr('fill', function (d) { return d.depth === 0 ? '#3b82f6' : (d.depth <= 1 ? '#64748b' : '#94a3b8'); })
        .attr('opacity', 0.85);
    }

    // 初始绘制
    redraw();

    // 更新视口位置
    function updateViewport() {
      if (!instance.svg) return;

      var svgEl = instance.svg.node();
      var parentEl = svgEl.parentNode;
      var parentW = parentEl.clientWidth;
      var parentH = parentEl.clientHeight;

      var layoutData = instance.layoutData;
      if (!layoutData) return;

      var nodes = layoutData.nodes;
      var pad = config.padding;
      var sc = scaleNodes(nodes, config.width, config.height, pad);

      var viewBox = svgEl.viewBox.baseVal;
      var transform = d3.zoomTransform(svgEl);

      // 主 SVG viewBox 坐标 → minimap 坐标
      var viewX = (-transform.x / transform.k) * (config.width / viewBox.width) * (viewBox.width / layoutData.svgWidth);
      var viewY = (-transform.y / transform.k) * (config.height / viewBox.height) * (viewBox.height / layoutData.svgHeight);
      var viewW = (parentW / transform.k) * (config.width / viewBox.width) * (viewBox.width / layoutData.svgWidth);
      var viewH = (parentH / transform.k) * (config.height / viewBox.height) * (viewBox.height / layoutData.svgHeight);

      // 简化版：直接用容器和 viewBox 比例
      var scaleX = config.width / layoutData.svgWidth;
      var scaleY = config.height / layoutData.svgHeight;
      var vx = -transform.x / transform.k * scaleX;
      var vy = -transform.y / transform.k * scaleY;
      var vw = parentW / transform.k * scaleX;
      var vh = parentH / transform.k * scaleY;

      viewport
        .attr('x', Math.max(0, vx))
        .attr('y', Math.max(0, vy))
        .attr('width', Math.min(vw, config.width - Math.max(0, vx)))
        .attr('height', Math.min(vh, config.height - Math.max(0, vy)));
    }

    // 暴露方法
    instance._minimapRedraw = redraw;
    instance._minimapUpdate = updateViewport;

    // 绑定 zoom 事件
    if (instance._zoom) {
      instance._zoom.on('zoom.minimap', function () {
        if (instance._minimapUpdate) instance._minimapUpdate();
      });
    }

    // 点击 minimap 导航
    svg.on('mousedown', function (event) {
      event.stopPropagation();
      event.preventDefault();

      var layoutData = instance.layoutData;
      if (!layoutData) return;

      var rect = svg.node().getBoundingClientRect();
      var mx = event.clientX - rect.left;
      var my = event.clientY - rect.top;

      var scaleX = layoutData.svgWidth / config.width;
      var scaleY = layoutData.svgHeight / config.height;
      var targetX = mx * scaleX;
      var targetY = my * scaleY;

      var parentEl = instance.svg.node().parentNode;
      var parentW = parentEl.clientWidth;
      var parentH = parentEl.clientHeight;
      var transform = d3.zoomTransform(instance.svg.node());

      var newX = -(targetX * transform.k) + parentW / 2;
      var newY = -(targetY * transform.k) + parentH / 2;

      instance.svg
        .transition().duration(300)
        .call(instance._zoom.transform,
          d3.zoomIdentity.translate(newX, newY).scale(transform.k));
    });

    // 初始视口更新
    setTimeout(function () {
      if (instance._minimapUpdate) instance._minimapUpdate();
    }, 150);

    instance._minimap = minimap;
    return minimap;
  }

  function remove(instance) {
    if (instance._minimap) {
      instance._minimap.remove();
      instance._minimap = null;
    }
    if (instance._minimapRedraw) instance._minimapRedraw = null;
    if (instance._minimapUpdate) instance._minimapUpdate = null;
    if (instance._zoom) {
      instance._zoom.on('zoom.minimap', null);
    }
  }

  var MindmapMinimap = {
    create: create,
    remove: remove
  };

  return MindmapMinimap;
}));

// ===== focus.js =====
/**
 * 专注模式 (Focus Mode)
 * 双击节点进入专注模式，以其为临时根节点
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['d3'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('d3'));
  } else {
    root.MindmapFocus = factory(root.d3);
  }
}(typeof self !== 'undefined' ? self : this, function (d3) {
  'use strict';

  function init(instance) {
    instance._focusStack = [];
    instance._isFocused = false;
  }

  /**
   * 进入专注模式
   * @param {Object} instance - 思维导图实例
   * @param {Object} d - 要聚焦的 d3 hierarchy 节点
   */
  function enterFocus(instance, d) {
    if (!d) return;

    // 保存当前状态
    instance._focusStack.push({
      root: instance.originalData,
      hierarchy: instance.hierarchy
    });

    // 将当前节点作为新根
    var newRoot = cloneSubtree(d.data);
    instance.currentData = newRoot;

    // 标记为专注模式
    instance._isFocused = true;
    instance._focusNode = d.data;

    // 显示面包屑导航
    showBreadcrumb(instance, d);

    // 重新渲染
    rerender(instance);

    // 显示返回按钮
    showBackButton(instance);
  }

  /**
   * 退出专注模式
   */
  function exitFocus(instance) {
    if (instance._focusStack.length === 0) return;

    var prev = instance._focusStack.pop();
    instance.currentData = prev.root;
    instance._isFocused = instance._focusStack.length > 0;
    instance._focusNode = null;

    // 隐藏面包屑
    hideBreadcrumb(instance);

    // 隐藏返回按钮
    hideBackButton(instance);

    // 重新渲染
    rerender(instance);
  }

  /**
   * 克隆子树
   */
  function cloneSubtree(node) {
    var copy = { name: node.name };
    for (var key in node) {
      if (node.hasOwnProperty(key) && key !== 'children' && key !== '_children' &&
        key !== 'id' && key !== '_width' && key !== '_height') {
        copy[key] = node[key];
      }
    }
    if (node.children && node.children.length > 0) {
      copy.children = node.children.map(cloneSubtree);
    }
    return copy;
  }

  /**
   * 显示面包屑导航
   */
  function showBreadcrumb(instance, d) {
    var container = d3.select(instance.svg.node().parentNode);

    // 检查是否已存在
    if (container.select('.mindmap-breadcrumb').size() > 0) {
      container.select('.mindmap-breadcrumb').remove();
    }

    // 获取祖先路径
    var ancestors = [];
    var cur = d;
    while (cur) {
      ancestors.unshift(cur.data.name);
      cur = cur.parent;
    }

    var bc = container.insert('div', ':first-child')
      .attr('class', 'mindmap-breadcrumb')
      .style('position', 'absolute')
      .style('top', '8px')
      .style('left', '16px')
      .style('padding', '4px 12px')
      .style('background', 'rgba(255,255,255,0.95)')
      .style('border', '1px solid #d0d7de')
      .style('border-radius', '4px')
      .style('font-size', '12px')
      .style('z-index', '101')
      .style('color', '#586069');

    ancestors.forEach(function (name, i) {
      if (i > 0) {
        bc.append('span').text(' > ').style('color', '#8b949e');
      }
      bc.append('span')
        .text(name)
        .style('color', i === ancestors.length - 1 ? '#4A90D9' : '#586069')
        .style('cursor', 'pointer')
        .style('font-weight', i === ancestors.length - 1 ? 'bold' : 'normal')
        .on('click', function () {
          // 点击祖先退出专注模式回到该层级
          while (instance._focusStack.length > (ancestors.length - 1 - i)) {
            exitFocus(instance);
          }
        });
    });

    instance._breadcrumb = bc;
  }

  function hideBreadcrumb(instance) {
    if (instance._breadcrumb) {
      instance._breadcrumb.remove();
      instance._breadcrumb = null;
    }
  }

  function showBackButton(instance) {
    var container = d3.select(instance.svg.node().parentNode);

    if (container.select('.mindmap-back-btn').size() > 0) return;

    var btn = container.append('div')
      .attr('class', 'mindmap-back-btn')
      .style('position', 'absolute')
      .style('top', '12px')
      .style('right', '60px')
      .style('padding', '6px 12px')
      .style('background', '#4A90D9')
      .style('color', '#fff')
      .style('border-radius', '4px')
      .style('cursor', 'pointer')
      .style('font-size', '12px')
      .style('z-index', '101')
      .text('\u2190 返回上级')
      .on('click', function () { exitFocus(instance); });
  }

  function hideBackButton(instance) {
    var container = d3.select(instance.svg.node().parentNode);
    container.select('.mindmap-back-btn').remove();
  }

  function rerender(instance) {
    // 重新布局
    var layoutResult = instance._layout(instance.currentData, instance.config);
    instance.layoutData = layoutResult;
    instance.hierarchy = layoutResult.root;

    // 重新渲染
    instance._renderer.update(instance.svg, layoutResult, instance.config);

    // 重置 zoom
    instance.svg
      .transition().duration(500)
      .call(instance._zoom.transform, d3.zoomIdentity);
  }

  var MindmapFocus = {
    init: init,
    enterFocus: enterFocus,
    exitFocus: exitFocus,
    rerender: rerender
  };

  return MindmapFocus;
}));


// ===== export.js =====
/**
 * 导出功能 (Export)
 * 支持导出为 SVG / PNG / Markdown
 */

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MindmapExport = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * 导出为 SVG 文件
   */
  function exportSVG(instance, filename) {
    filename = filename || 'mindmap.svg';
    var svgEl = instance.svg.node();
    var clone = svgEl.cloneNode(true);

    // 内联样式
    inlineStyles(clone);

    var serializer = new XMLSerializer();
    var svgString = serializer.serializeToString(clone);
    var blob = new Blob([svgString], { type: 'image/svg+xml' });

    downloadBlob(blob, filename);
  }

  /**
   * 导出为 PNG
   */
  function exportPNG(instance, filename, scale) {
    filename = filename || 'mindmap.png';
    scale = scale || 2;

    var svgEl = instance.svg.node();
    var clone = svgEl.cloneNode(true);
    inlineStyles(clone);

    var svgString = new XMLSerializer().serializeToString(clone);
    var svgBlob = new Blob([svgString], { type: 'image/svg+xml' });
    var url = URL.createObjectURL(svgBlob);

    var canvas = document.createElement('canvas');
    var viewBox = svgEl.viewBox.baseVal;
    canvas.width = viewBox.width * scale;
    canvas.height = viewBox.height * scale;

    var ctx = canvas.getContext('2d');
    ctx.scale(scale, scale);

    var img = new Image();
    img.onload = function () {
      // 白色背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, viewBox.width, viewBox.height);
      ctx.drawImage(img, 0, 0, viewBox.width, viewBox.height);
      URL.revokeObjectURL(url);

      canvas.toBlob(function (blob) {
        downloadBlob(blob, filename);
      }, 'image/png');
    };
    img.src = url;
  }

  /**
   * 导出为 Markdown 文件
   */
  function exportMarkdown(instance, filename) {
    filename = filename || 'mindmap.md';
    var markdown = treeToMarkdown(instance.currentData);
    var blob = new Blob([markdown], { type: 'text/markdown' });
    downloadBlob(blob, filename);
  }

  /**
   * 将树还原为 Markdown
   */
  function treeToMarkdown(node, indent) {
    indent = indent || 0;
    var prefix = '  '.repeat(indent);
    var result = '';

    if (node.name) {
      result += prefix + '- ' + node.name;
      // 如果原始有特殊属性，加回去
      var attrs = [];
      if (node.style) attrs.push('style:' + node.style);
      if (node.note) attrs.push('note:' + node.note);
      if (attrs.length > 0) {
        result += ' {' + attrs.join(', ') + '}';
      }
      result += '\n';
    }

    if (node.children) {
      node.children.forEach(function (child) {
        result += treeToMarkdown(child, indent + 1);
      });
    }

    return result;
  }

  /**
   * 内联样式到 SVG
   */
  function inlineStyles(svgEl) {
    // 从 CSS 变量计算实际颜色值
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    var colors = {
      fill: isDark ? '#21262d' : '#f5f7fa',
      stroke: isDark ? '#30363d' : '#d0d7de',
      text: isDark ? '#c9d1d9' : '#333333',
      link: isDark ? '#484f58' : '#c0c8d0'
    };

    // 应用颜色到节点和连线
    svgEl.querySelectorAll('.mindmap-node-shape').forEach(function (el) {
      if (!el.getAttribute('fill') || el.getAttribute('fill') === '') {
        el.setAttribute('fill', colors.fill);
      }
      if (!el.getAttribute('stroke') || el.getAttribute('stroke') === '') {
        el.setAttribute('stroke', colors.stroke);
      }
    });
  }

  /**
   * 触发浏览器下载
   */
  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  var MindmapExport = {
    exportSVG: exportSVG,
    exportPNG: exportPNG,
    exportMarkdown: exportMarkdown,
    treeToMarkdown: treeToMarkdown
  };

  return MindmapExport;
}));


// ===== mindmap-core.js =====
/**
 * hexo-mindmap-svg 核心渲染引擎 (mindmap-core.js)
 *
 * 主入口：编排解析器、布局引擎、渲染器、交互系统
 * 支持独立运行（浏览器）和 Hexo 集成两种模式
 *
 * 用法：
 *   Mindmap.render('#container', markdownString, config);
 *   Mindmap.renderFromData('#container', jsonTree, config);
 *
 * @author hexo-mindmap-svg
 * @version 1.0.0
 */

(function (root) {
  var factory = function (d3) {
    'use strict';

    // 引用各模块（通过全局作用域 root）
    var Parser = root.MindmapParser;
    var Layout = root.MindmapLayout;
    var Nodes = root.MindmapNodes;
    var Renderer = root.MindmapRenderer;
    var Interact = root.MindmapInteract;
    var Minimap = root.MindmapMinimap;
    var Focus = root.MindmapFocus;
    var Export = root.MindmapExport;

  /**
   * 默认配置
   */
  var DEFAULTS = {
    // 布局
    direction: 'lr',            // lr | rl | tb | bt | lr-both
    nodeWidth: 180,
    nodeHeight: 40,
    nodePaddingX: 100,
    nodePaddingY: 12,
    lineStyle: 'curved',        // straight | curved | angled | organic

    // 主题
    theme: 'light',             // light | dark | auto

    // 交互
    zoomMin: 0.3,
    zoomMax: 3.0,
    enableZoom: true,
    enableDrag: true,
    enableCollapse: true,
    collapseDepth: 0,           // 0 = 全部展开; 1 = 仅根节点; 2 = 展开到第2层...

    // 高级
    enableMinimap: true,
    enableFocus: true,

    // 动画
    animationDuration: 500
  };

  /**
   * 思维导图实例
   */
  function MindmapInstance(container, config) {
    this.container = container;
    this.config = Object.assign({}, DEFAULTS, config || {});
    this.originalData = null;
    this.currentData = null;
    this.hierarchy = null;
    this.layoutData = null;
    this.svg = null;
    this.g = null;

    // 初始化 Focus
    if (Focus) Focus.init(this);
  }

  /**
   * 从 Markdown 字符串渲染
   */
  MindmapInstance.prototype.render = function (markdown) {
    // 1. 解析
    var tree = Parser.parse(markdown);
    return this.renderFromTree(tree);
  };

  /**
   * 从 JSON 树渲染
   */
  MindmapInstance.prototype.renderFromTree = function (tree) {
    this.originalData = tree;
    this.currentData = tree;

    // 绑定内部引用（供 focus 等模块使用）
    this._layout = Layout.layout;
    this._renderer = Renderer;

    // 2. 布局
    var layoutResult = Layout.layout(tree, this.config);
    this.layoutData = layoutResult;
    this.hierarchy = layoutResult.root;

    // 3. 渲染
    this._initContainer();
    var result = Renderer.render(this.container, layoutResult, this.config);
    this.svg = result.svg;
    this.g = result.g;

    // 4. 绑定交互
    var self = this;
    this.config.onToggle = function (d) {
      self._handleToggle(d);
    };
    this.config.onFocusNode = function (d) {
      if (self.config.enableFocus && Focus) {
        Focus.enterFocus(self, d);
      }
    };

    Interact.bind(this);

    // 4.5 根据 collapseDepth 配置自动折叠（0=全部展开）
    if (this.config.collapseDepth > 0) {
      Interact.collapseAll(this, this.config.collapseDepth);
    }

    // 5. Minimap
    if (this.config.enableMinimap && Minimap) {
      Minimap.create(this, this.config);
    }

    // 6. 工具栏
    this._createToolbar();

    // 7. 初始适应视图
    var self = this;
    setTimeout(function () {
      Interact.fitView(self);
    }, 100);

    return this;
  };

  /**
   * 初始化容器
   */
  MindmapInstance.prototype._initContainer = function () {
    var container = this.container;
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }

    if (!container) {
      throw new Error('[Mindmap] 容器不存在: ' + this.container);
    }

    container.classList.add('mindmap-container');
    container.classList.add(this.config.theme);

    this.container = container;
  };

  /**
   * 创建工具栏
   */
  MindmapInstance.prototype._createToolbar = function () {
    var container = this.container;
    if (typeof container === 'string') {
      container = document.querySelector(container);
    }

    // 移除已有工具栏和切换按钮
    var existing = container.querySelector('.mindmap-toolbar');
    if (existing) existing.remove();
    var existingToggle = container.querySelector('.mindmap-toolbar-toggle');
    if (existingToggle) existingToggle.remove();
    var existingClose = container.querySelector('.mindmap-fullscreen-close');
    if (existingClose) existingClose.remove();

    var toolbar = document.createElement('div');
    toolbar.className = 'mindmap-toolbar';

    var self = this;
    var buttons = [
      { label: '适应', action: function () { Interact.fitView(self); } },
      { label: '展开', action: function () { Interact.expandAll(self); } },
      { label: '折叠', action: function () {
        Interact.collapseAll(self, 1);
      }},
      { label: '主题', action: function () { self._toggleTheme(); } },
      { label: '全屏', action: function () { self._toggleFullscreen(); } }
    ];

    buttons.forEach(function (btn) {
      var button = document.createElement('button');
      button.textContent = btn.label;
      button.addEventListener('click', btn.action);
      toolbar.appendChild(button);
    });

    // 导出下拉菜单（替代三个独立按钮）
    var dropdown = document.createElement('div');
    dropdown.className = 'mindmap-dropdown';

    var dropdownBtn = document.createElement('button');
    dropdownBtn.textContent = '下载';
    dropdownBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });

    var dropdownMenu = document.createElement('div');
    dropdownMenu.className = 'mindmap-dropdown-menu';

    var exportItems = [
      { label: '导出 SVG', action: function () { Export.exportSVG(self); dropdown.classList.remove('open'); } },
      { label: '导出 PNG', action: function () { Export.exportPNG(self); dropdown.classList.remove('open'); } },
      { label: '导出 MD', action: function () { Export.exportMarkdown(self); dropdown.classList.remove('open'); } }
    ];

    exportItems.forEach(function (item) {
      var itemBtn = document.createElement('button');
      itemBtn.textContent = item.label;
      itemBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        item.action();
      });
      dropdownMenu.appendChild(itemBtn);
    });

    dropdown.appendChild(dropdownBtn);
    dropdown.appendChild(dropdownMenu);
    toolbar.appendChild(dropdown);

    // 点击工具栏外关闭下拉菜单
    document.addEventListener('click', function () {
      dropdown.classList.remove('open');
    });
    dropdown.addEventListener('click', function (e) {
      e.stopPropagation();
    });

    // 移动端工具栏切换按钮
    var toggleBtn = document.createElement('button');
    toggleBtn.className = 'mindmap-toolbar-toggle';
    toggleBtn.textContent = '☰';
    toggleBtn.title = '显示工具';
    toggleBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = container.classList.toggle('toolbar-open');
      toggleBtn.textContent = isOpen ? '✕' : '☰';
      toggleBtn.title = isOpen ? '隐藏工具' : '显示工具';
    });

    // 点击容器空白处关闭工具栏 (仅限于移动端 toggle 打开状态)
    container.addEventListener('click', function closeToolbar(e) {
      if (container.classList.contains('toolbar-open') &&
          !e.target.closest('.mindmap-toolbar') &&
          !e.target.closest('.mindmap-toolbar-toggle')) {
        container.classList.remove('toolbar-open');
        toggleBtn.textContent = '☰';
        toggleBtn.title = '显示工具';
      }
    });

    // 全屏关闭按钮
    var closeBtn = document.createElement('button');
    closeBtn.className = 'mindmap-fullscreen-close';
    closeBtn.textContent = '✕';
    closeBtn.title = '退出全屏';
    closeBtn.addEventListener('click', function () {
      self._toggleFullscreen();
    });

    container.appendChild(closeBtn);
    container.appendChild(toggleBtn);
    container.appendChild(toolbar);
    this._toolbar = toolbar;
    this._toolbarToggle = toggleBtn;
    this._fullscreenClose = closeBtn;
  };

  /**
   * 切换主题 (light → rainbow → dark → light)
   */
  MindmapInstance.prototype._toggleTheme = function () {
    var cycle = ['light', 'rainbow', 'dark'];
    var current = this.config.theme;
    var idx = cycle.indexOf(current);
    var newTheme = idx >= 0 ? cycle[(idx + 1) % cycle.length] : 'light';
    this.setTheme(newTheme);
  };

  /**
   * 切换全屏模式
   */
  MindmapInstance.prototype._toggleFullscreen = function () {
    var container = this.container;
    if (typeof container === 'string') container = document.querySelector(container);
    if (!container) return;

    var self = this;
    var isFullscreen = container.classList.contains('fullscreen');

    if (isFullscreen) {
      // 退出全屏
      container.classList.remove('fullscreen');
      if (self._fullscreenEsc) {
        document.removeEventListener('keydown', self._fullscreenEsc);
        self._fullscreenEsc = null;
      }
      // 恢复 SVG 高度为容器原始高度
      if (this.svg) {
        this.svg.style('height', (container.clientHeight || 500) + 'px');
      }
      setTimeout(function () { Interact.fitView(self); }, 200);
    } else {
      // 进入全屏
      container.classList.add('fullscreen');

      // SVG 高度设为 100% 填满全屏容器
      if (this.svg) {
        this.svg.style('height', '100%');
      }

      // Esc 退出全屏
      var escHandler = function (e) {
        if (e.key === 'Escape') {
          container.classList.remove('fullscreen');
          document.removeEventListener('keydown', escHandler);
          self._fullscreenEsc = null;
          if (self.svg) {
            self.svg.style('height', (container.clientHeight || 500) + 'px');
          }
          setTimeout(function () { Interact.fitView(self); }, 200);
        }
      };
      this._fullscreenEsc = escHandler;
      document.addEventListener('keydown', escHandler);

      setTimeout(function () { Interact.fitView(self); }, 200);
    }
  };

  /**
   * 设置主题
   */
  MindmapInstance.prototype.setTheme = function (theme) {
    this.config.theme = theme;

    // 更新 container class
    var container = this.container;
    if (typeof container === 'string') container = document.querySelector(container);
    container.classList.remove('light', 'dark', 'rainbow');
    container.classList.add(theme);

    // 更新 svg class
    if (this.svg) {
      this.svg.attr('class', 'mindmap-svg mindmap-theme-' + theme);
    }

    // 重新渲染
    this._rerender();
  };

  /**
   * 重新渲染
   */
  MindmapInstance.prototype._rerender = function () {
    if (!this.currentData || !this.svg) return;

    var layoutResult = Layout.layout(this.currentData, this.config);
    this.layoutData = layoutResult;
    this.hierarchy = layoutResult.root;

    Renderer.update(this.svg, layoutResult, this.config);

    // 更新 minimap
    if (this._minimapRedraw) this._minimapRedraw();
    if (this._minimapUpdate) this._minimapUpdate();
  };

  /**
   * 处理折叠/展开
   */
  MindmapInstance.prototype._handleToggle = function (d) {
    if (!this.hierarchy) return;
    this._rerender();
    // 折叠/展开后自动适应视图
    var self = this;
    setTimeout(function () {
      Interact.fitView(self);
    }, self.config.animationDuration + 100);
  };

  /**
   * 设置布局方向
   */
  MindmapInstance.prototype.setDirection = function (direction) {
    this.config.direction = direction;
    this._rerender();
  };

  /**
   * 设置连线样式
   */
  MindmapInstance.prototype.setLineStyle = function (style) {
    this.config.lineStyle = style;
    this._rerender();
  };

  /**
   * 更新 Markdown 内容（编辑刷新），保留容器和交互
   */
  MindmapInstance.prototype.setMarkdown = function (markdown) {
    var tree = Parser.parse(markdown);
    this.originalData = tree;
    this.currentData = tree;
    this._rerender();
  };

  /**
   * 获取导出对象
   */
  MindmapInstance.prototype.getExport = function () {
    return Export;
  };

  /**
   * 摧毁实例
   */
  MindmapInstance.prototype.destroy = function () {
    Minimap && Minimap.remove(this);
    Focus && Focus.hideBreadcrumb(this);
    Focus && Focus.hideBackButton(this);

    // 清理全屏 Esc 监听器
    if (this._fullscreenEsc) {
      document.removeEventListener('keydown', this._fullscreenEsc);
      this._fullscreenEsc = null;
    }

    if (this._toolbar) {
      this._toolbar.remove();
      this._toolbar = null;
    }

    if (this._toolbarToggle) {
      this._toolbarToggle.remove();
      this._toolbarToggle = null;
    }

    if (this._fullscreenClose) {
      this._fullscreenClose.remove();
      this._fullscreenClose = null;
    }

    var container = this.container;
    if (typeof container === 'string') container = document.querySelector(container);
    if (container) {
      container.innerHTML = '';
      container.classList.remove('mindmap-container');
    }

    this.svg = null;
    this.g = null;
    this.hierarchy = null;
    this.layoutData = null;
  };

  // ============================================================
  // 静态 API
  // ============================================================

  /**
   * 快捷方法：从 Markdown 渲染
   */
  function render(container, markdown, config) {
    var instance = new MindmapInstance(container, config);
    return instance.render(markdown);
  }

  /**
   * 快捷方法：从 JSON 树渲染
   */
  function renderFromData(container, tree, config) {
    var instance = new MindmapInstance(container, config);
    return instance.renderFromTree(tree);
  }

  /**
   * 自动扫描页面上的 .hexo-mindmap 元素并渲染
   * 用于 Hexo 集成场景
   */
  function autoRender(config) {
    var containers = document.querySelectorAll('.hexo-mindmap');
    containers.forEach(function (el) {
      var markdown = el.getAttribute('data-markdown');
      var content = el.getAttribute('data-content');
      var text = markdown || (content ? decodeURIComponent(content) : '');

      if (text) {
        var cfg = Object.assign({}, config || {});
        // 从 data-* 属性读取配置
        if (el.dataset.direction) cfg.direction = el.dataset.direction;
        if (el.dataset.theme) cfg.theme = el.dataset.theme;
        if (el.dataset.lineStyle) cfg.lineStyle = el.dataset.lineStyle;
        if (el.dataset.collapseDepth) cfg.collapseDepth = parseInt(el.dataset.collapseDepth, 10);

        render(el, text, cfg);
      }
    });
  }

  /**
   * 仅解析 Markdown，不渲染
   */
  function parse(markdown) {
    return Parser.parse(markdown);
  }

  // ============================================================
  // 公开 API
  // ============================================================

  var Mindmap = {
    // 版本
    version: '1.0.0',

    // 快捷方法
    render: render,
    renderFromData: renderFromData,
    parse: parse,
    autoRender: autoRender,

    // 实例构造
    create: function (container, config) {
      return new MindmapInstance(container, config);
    },

    // 默认配置
    defaults: DEFAULTS
  };

  return Mindmap;
  };

  // UMD 导出
  if (typeof define === 'function' && define.amd) {
    define(['d3'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('d3'));
  } else {
    root.Mindmap = factory(root.d3);
  }
}(typeof self !== 'undefined' ? self : this));


})();
