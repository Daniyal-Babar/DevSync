import React, { useEffect, useRef } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useUIStore } from '../stores/uiStore';
import { Lock } from 'lucide-react';

interface CodeEditorProps {
  path: string;
  value: string;
  onChange: (value: string) => void;
  readOnly: boolean;
  onSave?: () => void;
}

export const getLanguageFromPath = (filePath: string): string => {
  const ext = filePath.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
      return 'typescript';
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return 'javascript';
    case 'py':
      return 'python';
    case 'html':
    case 'htm':
      return 'html';
    case 'css':
    case 'scss':
    case 'less':
      return 'css';
    case 'json':
      return 'json';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'sql':
      return 'sql';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'xml':
    case 'svg':
      return 'xml';
    case 'dockerfile':
      return 'dockerfile';
    default:
      if (filePath.toLowerCase().endsWith('dockerfile')) return 'dockerfile';
      return 'plaintext';
  }
};

export const CodeEditor: React.FC<CodeEditorProps> = ({
  path,
  value,
  onChange,
  readOnly,
  onSave,
}) => {
  const theme = useUIStore((state) => state.theme);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const language = getLanguageFromPath(path);

  const handleEditorDidMount: OnMount = (editorInstance, monacoInstance: Monaco) => {
    editorRef.current = editorInstance;

    // Register Ctrl+S / Cmd+S save command inside Monaco
    editorInstance.addCommand(
      monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS,
      () => {
        if (!readOnly && onSave) {
          onSave();
        }
      }
    );
  };

  useEffect(() => {
    // Focus editor when path changes
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }, [path]);

  return (
    <div className="relative w-full h-full flex flex-col bg-[#1e1e1e]">
      {readOnly && (
        <div className="bg-amber-950/60 border-b border-amber-800/50 px-4 py-1.5 flex items-center justify-between text-xs text-amber-300 z-10">
          <div className="flex items-center gap-1.5 font-medium">
            <Lock className="w-3.5 h-3.5" />
            <span>Read-Only Mode: You have Viewer permissions for this workspace</span>
          </div>
          <span className="text-[11px] text-amber-400/80">Editing disabled</span>
        </div>
      )}

      <div className="flex-1 w-full h-full relative">
        <Editor
          height="100%"
          path={path}
          language={language}
          value={value}
          theme={theme}
          onChange={(val) => onChange(val || '')}
          onMount={handleEditorDidMount}
          options={{
            readOnly,
            fontSize: 14,
            lineHeight: 22,
            fontFamily: "'Fira Code', 'JetBrains Mono', Menlo, Monaco, Consolas, monospace",
            minimap: { enabled: true, maxColumn: 80 },
            automaticLayout: true,
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
            cursorBlinking: 'smooth',
            renderWhitespace: 'selection',
            bracketPairColorization: { enabled: true },
            guides: { bracketPairs: true, indentation: true },
            padding: { top: 12, bottom: 12 },
          }}
          loading={
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              Loading editor...
            </div>
          }
        />
      </div>
    </div>
  );
};
