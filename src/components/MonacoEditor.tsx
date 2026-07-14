import React from 'react';
import CodeEditor from './editor/CodeEditor';

interface MonacoEditorProps {
  value: string;
  language: string;
  theme: 'dark' | 'light';
  onChange?: (value: string) => void;
  options?: any;
}

/**
 * Standalone Monaco integration, now backed by the polished, monochrome
 * `CodeEditor` wrapper (theme + CSS overrides + Xcode-like polish live there).
 */
const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  language,
  theme,
  onChange,
  options,
}) => {
  return (
    <CodeEditor
      value={value}
      language={language}
      theme={theme}
      onChange={onChange}
      options={options}
    />
  );
};

export default MonacoEditor;
