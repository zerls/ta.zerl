/* ============================================================
   WGSL Syntax Highlighting for highlight.js
   Registers WGSL language definition and provides highlighting
   ============================================================ */

(function() {
  'use strict';

  // Register WGSL language definition
  if (typeof hljs !== 'undefined') {
    hljs.registerLanguage('wgsl', function(hljs) {
      const KEYWORDS = {
        keyword: [
          'fn', 'var', 'let', 'const', 'struct', 'return', 'if', 'else', 'for', 'while', 'loop',
          'break', 'continue', 'discard', 'switch', 'case', 'default', 'fallthrough',
          'alias', 'override', 'enable', 'requires', 'diagnostic'
        ].join(' '),
        type: [
          'bool', 'i32', 'u32', 'f32', 'f16',
          'vec2', 'vec3', 'vec4', 'vec2f', 'vec3f', 'vec4f',
          'vec2i', 'vec3i', 'vec4i', 'vec2u', 'vec3u', 'vec4u',
          'mat2x2', 'mat2x3', 'mat2x4', 'mat3x2', 'mat3x3', 'mat3x4',
          'mat4x2', 'mat4x3', 'mat4x4',
          'mat2x2f', 'mat3x3f', 'mat4x4f',
          'array', 'ptr', 'atomic', 'sampler', 'sampler_comparison',
          'texture_1d', 'texture_2d', 'texture_2d_array', 'texture_3d',
          'texture_cube', 'texture_cube_array', 'texture_multisampled_2d',
          'texture_storage_1d', 'texture_storage_2d', 'texture_storage_2d_array', 'texture_storage_3d',
          'texture_depth_2d', 'texture_depth_2d_array', 'texture_depth_cube', 'texture_depth_cube_array',
          'texture_depth_multisampled_2d'
        ].join(' '),
        built_in: [
          'abs', 'acos', 'acosh', 'all', 'any', 'arrayLength', 'asin', 'asinh', 'atan', 'atan2', 'atanh',
          'ceil', 'clamp', 'cos', 'cosh', 'cross', 'degrees', 'determinant', 'distance', 'dot',
          'exp', 'exp2', 'faceForward', 'floor', 'fma', 'fract', 'frexp', 'inverseSqrt',
          'ldexp', 'length', 'log', 'log2', 'max', 'min', 'mix', 'modf', 'normalize', 'pow',
          'radians', 'reflect', 'refract', 'round', 'saturate', 'sign', 'sin', 'sinh', 'smoothstep',
          'sqrt', 'step', 'tan', 'tanh', 'transpose', 'trunc',
          'dpdx', 'dpdxCoarse', 'dpdxFine', 'dpdy', 'dpdyCoarse', 'dpdyFine', 'fwidth', 'fwidthCoarse', 'fwidthFine',
          'textureDimensions', 'textureGather', 'textureGatherCompare', 'textureLoad', 'textureNumLayers',
          'textureNumLevels', 'textureNumSamples', 'textureSample', 'textureSampleBias', 'textureSampleCompare',
          'textureSampleCompareLevel', 'textureSampleGrad', 'textureSampleLevel', 'textureStore',
          'atomicLoad', 'atomicStore', 'atomicAdd', 'atomicSub', 'atomicMax', 'atomicMin',
          'atomicAnd', 'atomicOr', 'atomicXor', 'atomicExchange', 'atomicCompareExchangeWeak',
          'pack4x8snorm', 'pack4x8unorm', 'pack2x16snorm', 'pack2x16unorm', 'pack2x16float',
          'unpack4x8snorm', 'unpack4x8unorm', 'unpack2x16snorm', 'unpack2x16unorm', 'unpack2x16float',
          'storageBarrier', 'workgroupBarrier', 'workgroupUniformLoad'
        ].join(' '),
        literal: 'true false'
      };

      const ATTRIBUTES = {
        className: 'meta',
        begin: '@',
        end: /\s/,
        excludeEnd: true,
        keywords: {
          'meta-keyword': [
            'align', 'binding', 'builtin', 'compute', 'const', 'fragment', 'group', 'id',
            'interpolate', 'invariant', 'location', 'must_use', 'size', 'vertex', 'workgroup_size'
          ].join(' ')
        }
      };

      const NUMBER = {
        className: 'number',
        variants: [
          { begin: '\\b0[xX][0-9a-fA-F]+[iu]?\\b' }, // hex
          { begin: '\\b[0-9]+\\.[0-9]+([eE][+-]?[0-9]+)?[f]?\\b' }, // float
          { begin: '\\b[0-9]+[eE][+-]?[0-9]+[f]?\\b' }, // scientific
          { begin: '\\b[0-9]+[fiu]?\\b' } // integer
        ]
      };

      const STORAGE_CLASS = {
        className: 'keyword',
        begin: '\\b(function|private|workgroup|uniform|storage|read|write|read_write)\\b'
      };

      return {
        name: 'WGSL',
        aliases: ['wgsl'],
        keywords: KEYWORDS,
        contains: [
          hljs.C_LINE_COMMENT_MODE,
          hljs.C_BLOCK_COMMENT_MODE,
          ATTRIBUTES,
          STORAGE_CLASS,
          NUMBER,
          hljs.QUOTE_STRING_MODE
        ]
      };
    });
  }
})();
