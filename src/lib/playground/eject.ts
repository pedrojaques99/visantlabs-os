import type { Spec } from '@json-render/react';

interface EjectedFiles {
  '/App.tsx': string;
  '/styles.css': string;
  [key: string]: string;
}

const VISANT_TOKENS_CSS = `/* Visant Design Tokens */
:root {
  --brand-cyan: #00e5ff;
  --brand-orange: #ff6b35;
  --neutral-900: #0a0a0a;
  --neutral-800: #171717;
  --neutral-700: #262626;
  --neutral-400: #a3a3a3;
  --neutral-200: #e5e5e5;
  --radius: 8px;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: 'Inter', system-ui, sans-serif;
  background: var(--neutral-900);
  color: var(--neutral-200);
}`;

const COMPONENT_MAP: Record<string, string> = {
  PageShell: 'div className="p-6"',
  GlassPanel:
    'div className="bg-neutral-950/90 backdrop-blur-xl border border-neutral-800/50 rounded-xl p-4"',
  Stack: 'div className="flex flex-col gap-4"',
  Grid: 'div className="grid grid-cols-2 gap-4"',
  Card: 'div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4"',
  Heading: 'h2 className="font-semibold text-neutral-100"',
  Text: 'span className="text-sm text-neutral-300"',
  MicroTitle: 'span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500"',
  Button:
    'button className="px-4 py-2 rounded-lg bg-cyan-500 text-neutral-900 font-medium text-sm hover:bg-cyan-400 transition-colors"',
  Badge: 'span className="px-2 py-0.5 text-[10px] rounded-full bg-neutral-800 text-neutral-300"',
  Separator: 'hr className="border-neutral-800"',
  Metric:
    'div className="bg-neutral-950/90 backdrop-blur-xl border border-neutral-800/50 rounded-xl p-4"',
};

function propsToString(props: Record<string, unknown>): string {
  return Object.entries(props)
    .filter(([k]) => k !== 'text' && k !== 'label' && k !== 'value')
    .map(([k, v]) => {
      if (typeof v === 'string') return `${k}="${v}"`;
      if (typeof v === 'number') return `${k}={${v}}`;
      if (typeof v === 'boolean') return v ? k : '';
      return `${k}={${JSON.stringify(v)}}`;
    })
    .filter(Boolean)
    .join(' ');
}

function getTextContent(props: Record<string, unknown>): string {
  return (props.text as string) || (props.label as string) || (props.value as string) || '';
}

function elementToJsx(spec: Spec, key: string, indent: number): string {
  const el = spec.elements[key];
  if (!el) return '';

  const pad = '  '.repeat(indent);
  const props = (el.props || {}) as Record<string, unknown>;
  const children = el.children || [];
  const textContent = getTextContent(props);

  if (el.type === 'Metric') {
    return `${pad}<div className="bg-neutral-950/90 backdrop-blur-xl border border-neutral-800/50 rounded-xl p-4">
${pad}  <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">${
      props.label || ''
    }</span>
${pad}  <div className="flex items-baseline gap-2 mt-1">
${pad}    <span className="text-2xl font-semibold text-neutral-100">${props.value || ''}</span>
${pad}    ${
      props.change
        ? `<span className="text-xs font-mono ${
            props.trend === 'up'
              ? 'text-green-400'
              : props.trend === 'down'
              ? 'text-red-400'
              : 'text-neutral-400'
          }">${props.change}</span>`
        : ''
    }
${pad}  </div>
${pad}</div>`;
  }

  if (el.type === 'Stack') {
    const dir = props.direction === 'horizontal' ? 'flex-row' : 'flex-col';
    const gap = props.gap ? `gap-${props.gap}` : 'gap-4';
    const childrenJsx = children.map((c) => elementToJsx(spec, c, indent + 1)).join('\n');
    return `${pad}<div className="flex ${dir} ${gap}">
${childrenJsx}
${pad}</div>`;
  }

  if (el.type === 'Grid') {
    const cols = props.cols || 2;
    const gap = props.gap ? `gap-${props.gap}` : 'gap-4';
    const childrenJsx = children.map((c) => elementToJsx(spec, c, indent + 1)).join('\n');
    return `${pad}<div className="grid grid-cols-${cols} ${gap}">
${childrenJsx}
${pad}</div>`;
  }

  const mapped = COMPONENT_MAP[el.type];
  if (!mapped) {
    const childrenJsx = children.map((c) => elementToJsx(spec, c, indent + 1)).join('\n');
    return `${pad}<div data-type="${el.type}">
${childrenJsx}${textContent ? `\n${pad}  ${textContent}` : ''}
${pad}</div>`;
  }

  const tag = mapped.split(' ')[0];
  const cls = mapped.slice(tag.length + 1);
  const extraProps = propsToString(props);
  const allProps = [cls, extraProps].filter(Boolean).join(' ');

  if (children.length === 0 && !textContent) {
    return `${pad}<${tag} ${allProps} />`;
  }

  const childrenJsx = children.map((c) => elementToJsx(spec, c, indent + 1)).join('\n');
  const inner = textContent
    ? `${textContent}${childrenJsx ? '\n' + childrenJsx : ''}`
    : childrenJsx;

  return `${pad}<${tag} ${allProps}>
${inner ? inner + '\n' : ''}${pad}</${tag}>`;
}

export function ejectSpec(spec: Spec, title: string): EjectedFiles {
  const jsx = elementToJsx(spec, spec.root, 1);

  const appCode = `// Visual scaffold exported from Visant Playground.
// Buttons, inputs, and actions need state + handlers to be interactive.
import React from 'react';
import './styles.css';

export default function App() {
  return (
${jsx}
  );
}
`;

  return {
    '/App.tsx': appCode,
    '/styles.css': VISANT_TOKENS_CSS,
  };
}

export const SANDPACK_DEPS = {
  react: '^19.0.0',
  'react-dom': '^19.0.0',
};
