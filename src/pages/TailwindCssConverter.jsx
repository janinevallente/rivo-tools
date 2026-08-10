import { useState, useCallback } from 'react'
import { Helmet } from 'react-helmet-async';
import { ArrowLeftRight, Copy, Check, Shuffle, RefreshCw, AlertCircle, X, Trash2 } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'

// Core client-side translation engine
class PureLocalConverter {
  // TAILWIND TO CSS
  static tailwindToCss(tailwindString) {
    const classes = tailwindString.split(/\s+/).filter(Boolean);
    const baseProps = new Map();
    const hoverProps = new Map(); // Separate storage bucket for hover values
    
    const scaleSpacing = (v) => {
      if (v.startsWith('[') && v.endsWith(']')) return v.slice(1, -1);
      const rem = parseFloat(v) * 0.25;
      return isNaN(rem) ? v : `${rem}rem`;
    };

    const scaleColor = (v) => {
      if (v.startsWith('[') && v.endsWith(']')) return v.slice(1, -1);
      const defaults = { 
        'white': '#ffffff', 'black': '#000000', 
        'blue-500': '#3b82f6', 'blue-700': '#1d4ed8', // Added explicit common colors
        'red-500': '#ef4444' 
      };
      return defaults[v] || v;
    };

    const matchers = [
      { reg: /^flex$/, run: (target) => target.set('display', 'flex') },
      { reg: /^block$/, run: (target) => target.set('display', 'block') },
      { reg: /^inline-block$/, run: (target) => target.set('display', 'inline-block') },
      { reg: /^hidden$/, run: (target) => target.set('display', 'none') },
      { reg: /^font-bold$/, run: (target) => target.set('font-weight', '700') },
      { reg: /^font-semibold$/, run: (target) => target.set('font-weight', '600') },
      
      // Spacing / Gaps
      { reg: /^gap-(.+)$/, run: (target, m) => {
          if (m[1].startsWith('x-')) target.set('column-gap', scaleSpacing(m[1].slice(2)));
          else if (m[1].startsWith('y-')) target.set('row-gap', scaleSpacing(m[1].slice(2)));
          else target.set('gap', scaleSpacing(m[1]));
        }
      },
      
      // Margins & Paddings
      { reg: /^(-)?([pm])([xytrlb]?)-(.+)$/, run: (target, m) => {
          const isNegative = !!m[1];
          const property = m[2] === 'p' ? 'padding' : 'margin';
          const dir = m[3];
          let rawVal = scaleSpacing(m[4]);
          if (isNegative && rawVal !== 'auto') rawVal = `-${rawVal}`;

          if (!dir) target.set(property, rawVal);
          else if (dir === 'x') { target.set(`${property}-left`, rawVal); target.set(`${property}-right`, rawVal); }
          else if (dir === 'y') { target.set(`${property}-top`, rawVal); target.set(`${property}-bottom`, rawVal); }
          else if (dir === 't') target.set(`${property}-top`, rawVal);
          else if (dir === 'r') target.set(`${property}-right`, rawVal);
          else if (dir === 'b') target.set(`${property}-bottom`, rawVal);
          else if (dir === 'l') target.set(`${property}-left`, rawVal);
        }
      },

      // Colors
      { reg: /^(bg|text|border)-(.+)$/, run: (target, m) => {
          const propMap = { 'bg': 'background-color', 'text': 'color', 'border': 'border-color' };
          target.set(propMap[m[1]], scaleColor(m[2]));
        }
      },

      // Border Radius
      { reg: /^rounded(-.+)?$/, run: (target, m) => {
          const size = m[1] ? m[1].slice(1) : 'base';
          const radMap = { 'base': '0.25rem', 'sm': '0.125rem', 'md': '0.375rem', 'lg': '0.5rem', 'xl': '0.75rem', '2xl': '1rem', 'full': '9999px' };
          target.set('border-radius', radMap[size] || scaleSpacing(size));
        }
      }
    ];

    for (let cls of classes) {
      // Detect whether this specific class targets a hover action
      const isHover = cls.startsWith('hover:');
      const cleanClass = cls.replace(/.*:/, '');
      const activeStorageMap = isHover ? hoverProps : baseProps;

      for (const matcher of matchers) {
        const match = cleanClass.match(matcher.reg);
        if (match) {
          matcher.run(activeStorageMap, match); // Send properties to correct storage block
          break;
        }
      }
    }

    if (baseProps.size === 0 && hoverProps.size === 0) {
      return '/* Could not parse utilities into CSS rules */';
    }

    // Build the Base Style Output Block
    let cssOutput = '.custom-element {\n';
    for (const [prop, val] of baseProps) {
      cssOutput += `  ${prop}: ${val};\n`;
    }
    cssOutput += '}';

    // Append isolated pseudoclass block if hover parameters were used
    if (hoverProps.size > 0) {
      cssOutput += '\n\n.custom-element:hover {\n';
      for (const [prop, val] of hoverProps) {
        cssOutput += `  ${prop}: ${val};\n`;
      }
      cssOutput += '}';
    }

    return cssOutput;
  }

  // CSS TO TAILWIND
  static cssToTailwind(cssString) {
    // Use a global regex match to extract all blocks: selector + content inside braces
    const blockRegex = /([^{]+)\{([^}]+)\}/g;
    let match;
    const classes = new Set();
    
    // Quick shorthand parsing tools
    const parseSpacingToTailwind = (val) => {
      if (val.endsWith('rem')) {
        const num = parseFloat(val) / 0.25;
        return Number.isInteger(num) ? `${num}` : `[${val}]`;
      }
      return `[${val}]`;
    };

    const reverseStaticMap = {
      'display: flex': 'flex',
      'display: block': 'block',
      'display: none': 'hidden',
      'display: grid': 'grid',
      'align-items: center': 'items-center',
      'justify-content: space-between': 'justify-between',
      'text-align: center': 'text-center',
      'font-weight: 700': 'font-bold',
      'font-weight: 600': 'font-semibold',
      'width: 100%': 'w-full',
      'height: 100%': 'h-full',
      'cursor: pointer': 'cursor-pointer',
    };

    // Keep looping while there are distinct CSS selector blocks left to parse
    while ((match = blockRegex.exec(cssString)) !== null) {
      const selector = match[1].trim();
      const body = match[2];
      
      // Check if this block belongs to a hover modifier
      const isHoverBlock = selector.includes(':hover');
      const prefix = isHoverBlock ? 'hover:' : '';

      const declarations = body.split(';').filter(d => d.trim());

      for (let decl of declarations) {
        decl = decl.trim().replace(/\s+/g, ' ');
        if (!decl) continue;

        // Handle structural static lookups
        if (reverseStaticMap[decl]) {
          classes.add(`${prefix}${reverseStaticMap[decl]}`);
          continue;
        }

        const [prop, val] = decl.split(':').map(s => s.trim());
        if (!prop || !val) continue;

        // Flexbox / Grid alignments
        if (prop === 'align-items') classes.add(`${prefix}items-${val.replace('flex-', '')}`);
        else if (prop === 'justify-content') classes.add(`${prefix}justify-${val.replace('space-', '').replace('flex-', '')}`);
        else if (prop === 'align-self') classes.add(`${prefix}self-${val.replace('flex-', '')}`);
        
        // Gaps
        else if (prop === 'gap') classes.add(`${prefix}gap-${parseSpacingToTailwind(val)}`);
        else if (prop === 'column-gap') classes.add(`${prefix}gap-x-${parseSpacingToTailwind(val)}`);
        else if (prop === 'row-gap') classes.add(`${prefix}gap-y-${parseSpacingToTailwind(val)}`);

        // Margins & Paddings
        else if (prop === 'padding' || prop === 'margin') {
          const type = prop === 'padding' ? 'p' : 'm';
          classes.add(`${prefix}${type}-${parseSpacingToTailwind(val)}`);
        } 
        else if (prop.startsWith('padding-') || prop.startsWith('margin-')) {
          const type = prop.startsWith('padding') ? 'p' : 'm';
          const edge = prop.split('-')[1][0]; // t, b, l, r
          classes.add(`${prefix}${type}${edge}-${parseSpacingToTailwind(val)}`);
        }

        // Sizes
        else if (prop === 'width' || prop === 'height') {
          const type = prop[0];
          if (val === '100%') classes.add(`${prefix}${type}-full`);
          else if (val === '100vw' || val === '100vh') classes.add(`${prefix}${type}-screen`);
          else classes.add(`${prefix}${type}-${parseSpacingToTailwind(val)}`);
        }

        // Colors & Radii
        else if (prop === 'background-color') {
          const colorMap = { '#3b82f6': 'blue-500', '#1d4ed8': 'blue-700' };
          classes.add(`${prefix}bg-${colorMap[val] || `[${val}]`}`);
        }
        else if (prop === 'color') {
          classes.add(val === '#ffffff' ? `${prefix}text-white` : `${prefix}text-[${val}]`);
        }
        else if (prop === 'border-color') {
          classes.add(`${prefix}border-[${val}]`);
        }
        else if (prop === 'border-radius') {
          const radMap = { '0.25rem': 'rounded', '0.5rem': 'rounded-lg', '9999px': 'rounded-full' };
          classes.add(`${prefix}${radMap[val] || `rounded-[${val}]`}`);
        }
      }
    }

    return Array.from(classes).join(' ') || '/* No matching Tailwind utilities found */';
  }
}

export default function TailwindCssConverter() {
  const [mode, setMode] = useState('tw-to-css');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [copied, setCopied] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState(null);

  const convert = useCallback(() => {
    if (!input.trim()) {
      setError('Please enter some code to convert');
      return;
    }
    
    setIsConverting(true);
    setError(null);
    
    try {
      const result = mode === 'tw-to-css' 
        ? PureLocalConverter.tailwindToCss(input)
        : PureLocalConverter.cssToTailwind(input);
        
      setOutput(result);
    } catch (err) {
      setError(`Conversion failed: ${err.message}`);
      setOutput('');
    } finally {
      setIsConverting(false);
    }
  }, [input, mode]);

  const loadDemo = () => {
    setError(null);
    if (mode === 'tw-to-css') {
      const demo = 'flex items-center justify-between p-4 bg-blue-500 text-white rounded-lg shadow-md';
      setInput(demo);
      setOutput(PureLocalConverter.tailwindToCss(demo));
    } else {
      const demo = `.button {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem;
        background-color: #3b82f6;
        color: #ffffff;
      }`;
      setInput(demo);
      setOutput(PureLocalConverter.cssToTailwind(demo));
    }
  };

  const copyOutput = () => {
    if (!output) return;
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const swap = () => {
    const next = mode === 'tw-to-css' ? 'css-to-tw' : 'tw-to-css';
    setMode(next);
    setInput(output);
    setOutput(input);
    setError(null);
  };

  const clearAll = () => {
    setInput('');
    setOutput('');
    setError(null);
  };

  return (
    <div className="mx-auto px-5 md:px-10 py-8 font-poppins">
      <Helmet>
        <title>Rivo - Tailwind to CSS Converter</title>
      </Helmet>
      <PageHeader
        title={mode === 'tw-to-css' ? 'Tailwind → CSS Converter' : 'CSS → Tailwind Converter'}
        description="Instant local parsing engine running 100% on your client device"
      />

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-2 p-1 bg-backgroundCard border border-borderColor rounded-xl">
          <button
            onClick={() => { setMode('tw-to-css'); clearAll(); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors
              ${mode === 'tw-to-css' ? 'bg-accentBg text-accent' : 'bg-transparent text-text hover:text-accent'}`}
          >
            Tailwind → CSS
          </button>
          <button
            onClick={() => { setMode('css-to-tw'); clearAll(); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium border-none cursor-pointer transition-colors
              ${mode === 'css-to-tw' ? 'bg-accentBg text-accent' : 'bg-transparent text-text hover:text-accent'}`}
          >
            CSS → Tailwind
          </button>
        </div>
        
        <button
          onClick={swap}
          disabled={!input || !output}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border cursor-pointer transition-opacity
            ${input && output ? 'bg-accentBg text-accent border-accentBorder hover:opacity-80' : 'bg-borderColor text-text cursor-not-allowed opacity-50'}`}
        >
          <RefreshCw size={13} /> Swap
        </button>
        
        <button
          onClick={loadDemo}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity"
        >
          <Shuffle size={13} /> Load Demo
        </button>

        <button
          onClick={clearAll}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-errorBg text-error border border-errorBorder cursor-pointer hover:opacity-80 transition-opacity"
        >
          <Trash2 size={13} /> Clear All
        </button>
      </div>

      {/* Conversion Interface */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 flex items-start gap-2">
          <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <span className="text-sm text-red-800 dark:text-red-200">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Card */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-textHeader m-0">
              {mode === 'tw-to-css' ? 'Tailwind Classes' : 'CSS Input'}
            </h2>
            <span className="text-xs text-text">
              {input.split(/\s+/).filter(Boolean).length} items
            </span>
          </div>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={mode === 'tw-to-css'
              ? 'e.g., flex items-center justify-between p-4 bg-blue-500 text-white rounded-lg shadow-md'
              : `.button {\n  display: flex;\n  padding: 1rem;\n}`}
            rows={14}
            className="w-full px-3 py-3 rounded-xl bg-backgroundColor border border-borderColor text-sm text-textHeader font-mono focus:outline-none focus:border-accent transition-colors resize-none"
            spellCheck={false}
          />
          <button
            onClick={convert}
            disabled={!input.trim() || isConverting}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold border-none transition-all flex items-center justify-center gap-2
              ${input.trim() && !isConverting ? 'bg-accent text-white cursor-pointer hover:opacity-90' : 'bg-borderColor text-text cursor-not-allowed'}`}
          >
            <ArrowLeftRight size={16} /> Convert
          </button>
        </div>

        {/* Output Card */}
        <div className="bg-backgroundCard border border-borderColor rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-textHeader m-0">
              {mode === 'tw-to-css' ? 'CSS Output' : 'Tailwind Classes'}
            </h2>
            {output && (
              <button
                onClick={copyOutput}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accentBg text-accent border border-accentBorder cursor-pointer hover:opacity-80 transition-opacity"
              >
                {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                Copy
              </button>
            )}
          </div>
          <div className="flex-1 min-h-[250px] p-3.5 rounded-xl bg-backgroundColor border border-borderColor overflow-auto">
            {output ? (
              <pre className="m-0 text-[13px] font-mono text-textHeader whitespace-pre-wrap break-all">{output}</pre>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center text-text text-sm gap-2">
                <ArrowLeftRight size={32} className="opacity-30" />
                <p>Click "Convert" to see the result</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}