import React, { useState, useEffect, useCallback } from "react";
import Editor from "@monaco-editor/react";
import "./MonacoEditor.css";

const MonacoEditor = ({
  files = [],
  activeFile,
  onFileChange,
  onCreateFile,
  onFileSelect,
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [editorContent, setEditorContent] = useState("");
  const [showNewFileForm, setShowNewFileForm] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  // Update editor content when activeFile changes
  useEffect(() => {
    if (activeFile) {
      setEditorContent(activeFile.content);
      setSelectedLanguage(activeFile.language || "javascript");
    }
  }, [activeFile]);

  // Update editor content when files change
  useEffect(() => {
    if (files.length > 0 && !activeFile) {
      // If no active file, set the first one as active
      onFileChange(files[0].id, files[0].content);
    }
  }, [files, activeFile, onFileChange]);

  const handleFileSelect = (file) => {
    setEditorContent(file.content);
    setSelectedLanguage(file.language || "javascript");

    // Notify parent component about file selection
    if (onFileSelect) {
      onFileSelect(file.id);
    }

    console.log("✅ File selected:", file.name);
  };

  const handleContentChange = useCallback(
    (value) => {
      setEditorContent(value);
      if (activeFile) {
        onFileChange(activeFile.id, value);
      }
    },
    [activeFile, onFileChange]
  );

  const handleCreateNewFile = () => {
    setShowNewFileForm(true);
    setNewFileName("");
  };

  const handleSubmitNewFile = () => {
    if (!newFileName.trim()) return;

    if (onCreateFile) {
      // Pass the filename to the parent component
      onCreateFile(newFileName.trim());
    }

    // Reset form
    setShowNewFileForm(false);
    setNewFileName("");
  };

  const handleCancelNewFile = () => {
    setShowNewFileForm(false);
    setNewFileName("");
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      handleSubmitNewFile();
    } else if (e.key === "Escape") {
      handleCancelNewFile();
    }
  };

  // Get file icon based on file type
  const getFileIcon = (fileName) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    const iconMap = {
      js: "📄",
      jsx: "⚛️",
      ts: "📘",
      tsx: "⚛️",
      py: "🐍",
      java: "☕",
      cpp: "⚙️",
      cs: "🔷",
      go: "🐹",
      rs: "🦀",
      php: "🐘",
      rb: "💎",
      swift: "🍎",
      kt: "🔴",
      html: "🌐",
      css: "🎨",
      scss: "🎨",
      json: "📋",
      xml: "📄",
      yml: "⚙️",
      yaml: "⚙️",
      md: "📝",
      sql: "🗄️",
      sh: "💻",
      bash: "💻",
      txt: "📄",
    };
    return iconMap[extension] || "📄";
  };

  return (
    <div className="monaco-editor-container">
      {/* Left Sidebar */}
      <div className="editor-sidebar">
        <div className="sidebar-header">
          <h3>Files</h3>
          <button
            className="add-file-btn"
            onClick={handleCreateNewFile}
            title="Create new file"
          >
            +
          </button>
        </div>

        <div className="file-explorer">
          {/* Inline file creation form */}
          {showNewFileForm && (
            <div className="new-file-form">
              <input
                type="text"
                placeholder="Enter filename (e.g., script.js)"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                onKeyDown={handleKeyPress}
                autoFocus
                className="new-file-input"
              />
              <div className="new-file-actions">
                <button
                  onClick={handleSubmitNewFile}
                  className="new-file-submit"
                  disabled={!newFileName.trim()}
                >
                  Create
                </button>
                <button
                  onClick={handleCancelNewFile}
                  className="new-file-cancel"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="file-list">
            {files.map((file) => (
              <div
                key={file.id}
                className={`file-item ${
                  activeFile?.id === file.id ? "active" : ""
                }`}
                onClick={() => handleFileSelect(file)}
              >
                <span className="file-icon">{getFileIcon(file.name)}</span>
                <span className="file-name">
                  {file.name || `File ${file.id}`}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="sidebar-footer">
          <div className="language-selector">
            <label htmlFor="language-select">Language:</label>
            <select
              id="language-select"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="language-dropdown"
            >
              {/* availableLanguages removed */}
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="cpp">C++</option>
              <option value="csharp">C#</option>
              <option value="go">Go</option>
              <option value="rust">Rust</option>
              <option value="php">PHP</option>
              <option value="ruby">Ruby</option>
              <option value="swift">Swift</option>
              <option value="kotlin">Kotlin</option>
              <option value="html">HTML</option>
              <option value="css">CSS</option>
              <option value="scss">SCSS</option>
              <option value="json">JSON</option>
              <option value="xml">XML</option>
              <option value="yaml">YAML</option>
              <option value="markdown">Markdown</option>
              <option value="sql">SQL</option>
              <option value="shell">Shell</option>
              <option value="plaintext">Plain Text</option>
            </select>
          </div>
          {/* Save button removed - files are managed locally for demo */}
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="editor-main">
        <div className="editor-header">
          {activeFile && (
            <div className="file-info">
              <span className="file-name">
                {activeFile.name || `File ${activeFile.id}`}
              </span>
            </div>
          )}
        </div>

        <div className="editor-content">
          {activeFile ? (
            <Editor
              height="100%"
              defaultLanguage="javascript"
              language={selectedLanguage}
              value={editorContent}
              onChange={handleContentChange}
              onMount={() => {
                console.log("✅ Monaco Editor mounted successfully");
              }}
              options={{
                theme: "vs-dark",
                fontSize: 14,
                lineNumbers: "on",
                roundedSelection: false,
                scrollBeyondLastLine: false,
                readOnly: false,
                automaticLayout: true,
                minimap: {
                  enabled: true,
                  size: "proportional",
                },
                wordWrap: "on",
                folding: true,
                foldingStrategy: "indentation",
                showFoldingControls: "always",
                renderWhitespace: "selection",
                renderControlCharacters: false,
                renderLineHighlight: "all",
                selectOnLineNumbers: true,
                cursorBlinking: "blink",
                cursorStyle: "line",
                hideCursorInOverviewRuler: false,
                overviewRulerBorder: false,
                scrollbar: {
                  vertical: "visible",
                  horizontal: "visible",
                  verticalScrollbarSize: 14,
                  horizontalScrollbarSize: 14,
                },
                tabSize: 2,
                insertSpaces: true,
                detectIndentation: true,
                trimAutoWhitespace: true,
                largeFileOptimizations: true,
                contextmenu: true,
                mouseWheelZoom: true,
                quickSuggestions: true,
                quickSuggestionsDelay: 10,
                parameterHints: {
                  enabled: true,
                  delay: 1000,
                },
                suggestOnTriggerCharacters: true,
                acceptSuggestionOnEnter: "on",
                tabCompletion: "on",
                wordBasedSuggestions: true,
                suggest: {
                  insertMode: "replace",
                  showKeywords: true,
                  showSnippets: true,
                  showClasses: true,
                  showFunctions: true,
                  showVariables: true,
                  showModules: true,
                  showProperties: true,
                  showEvents: true,
                  showOperators: true,
                  showUnits: true,
                  showValues: true,
                  showConstants: true,
                  showEnums: true,
                  showEnumMembers: true,
                  showColors: true,
                  showFiles: true,
                  showReferences: true,
                  showFolders: true,
                  showTypeParameters: true,
                  showWords: true,
                  showUserWords: true,
                  showIcons: true,
                  showStatusBar: true,
                },
              }}
            />
          ) : (
            <div className="no-file-selected">
              <p>Select a file to start editing</p>
            </div>
          )}
        </div>

        <div className="editor-footer">
          {activeFile && (
            <div className="file-details">
              <span className="detail-item">
                {/* availableLanguages removed */}
                {selectedLanguage}
              </span>
              <span className="detail-item">
                {editorContent.split("\n").length} lines
              </span>
              <span className="detail-item">{editorContent.length} chars</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MonacoEditor;
