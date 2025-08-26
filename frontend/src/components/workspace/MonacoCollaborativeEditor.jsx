import React, { useState, useRef, useCallback, useEffect } from "react";
import Editor from "@monaco-editor/react";
import "./MonacoCollaborativeEditor.css";

const MonacoEditor = ({ files, onFileChange, onCreateFile }) => {
  const [activeFile, setActiveFile] = useState(files[0] || null);
  const [editorContent, setEditorContent] = useState("");
  const [editorInstance, setEditorInstance] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [nextFileId, setNextFileId] = useState(
    files.length > 0 ? Math.max(...files.map((f) => f.id)) + 1 : 1
  );

  const lastChangeRef = useRef(null);

  // Available languages for the editor
  const availableLanguages = [
    { value: "javascript", label: "JavaScript" },
    { value: "typescript", label: "TypeScript" },
    { value: "html", label: "HTML" },
    { value: "css", label: "CSS" },
    { value: "scss", label: "SCSS" },
    { value: "json", label: "JSON" },
    { value: "markdown", label: "Markdown" },
    { value: "python", label: "Python" },
    { value: "java", label: "Java" },
    { value: "cpp", label: "C++" },
    { value: "c", label: "C" },
    { value: "rust", label: "Rust" },
    { value: "go", label: "Go" },
    { value: "php", label: "PHP" },
    { value: "sql", label: "SQL" },
    { value: "xml", label: "XML" },
    { value: "yaml", label: "YAML" },
    { value: "plaintext", label: "Plain Text" },
  ];

  // Update editor content when active file changes
  useEffect(() => {
    if (activeFile) {
      setEditorContent(activeFile.content || "");
      // Auto-detect language from file extension if available
      if (activeFile.name) {
        const detectedLanguage = detectLanguageFromFileName(activeFile.name);
        setSelectedLanguage(detectedLanguage);
      }
    }
  }, [activeFile]);

  // Update nextFileId when files change
  useEffect(() => {
    if (files.length > 0) {
      setNextFileId(Math.max(...files.map((f) => f.id)) + 1);
    }
  }, [files]);

  // Detect language from file extension
  const detectLanguageFromFileName = (fileName) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    const languageMap = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      html: "html",
      htm: "html",
      css: "css",
      scss: "scss",
      sass: "scss",
      json: "json",
      md: "markdown",
      py: "python",
      java: "java",
      cpp: "cpp",
      cc: "cpp",
      cxx: "cpp",
      c: "c",
      rs: "rust",
      go: "go",
      php: "php",
      sql: "sql",
      xml: "xml",
      yml: "yaml",
      yaml: "yaml",
      txt: "plaintext",
    };
    return languageMap[extension] || "javascript";
  };

  const handleFileSelect = (file) => {
    setActiveFile(file);
    setEditorContent(file.content || "");
    // Auto-detect language for the selected file
    if (file.name) {
      const detectedLanguage = detectLanguageFromFileName(file.name);
      setSelectedLanguage(detectedLanguage);
    }
  };

  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [newFileName, setNewFileName] = useState("");

  const createNewEmptyFile = (name) => {
    const clean = (name || "").trim();
    if (!clean) return null;

    const language = detectLanguageFromFileName(clean);
    const newFile = {
      id: nextFileId,
      name: clean,
      content: "",
      language,
      isActive: false,
    };

    // Notify parent to add file
    if (onFileChange) {
      onFileChange(`new-${nextFileId}`, newFile.content, newFile);
    }

    // Set as active locally
    setActiveFile(newFile);
    setEditorContent("");
    setSelectedLanguage(language);
    setNextFileId(nextFileId + 1);

    return newFile;
  };

  const handleCreateNewFile = () => {
    setShowNewFileInput((prev) => !prev);
    setNewFileName("");
  };

  const confirmCreateNewFile = async () => {
    const clean = (newFileName || "").trim();
    if (!clean) return;

    if (typeof onCreateFile === "function") {
      try {
        const created = await onCreateFile(clean);
        if (created && created.id) {
          // Activate returned file
          setActiveFile(created);
          setEditorContent(created.content || "");
          setSelectedLanguage(
            created.language || detectLanguageFromFileName(created.name)
          );
          setShowNewFileInput(false);
          setNewFileName("");
          // Ensure nextFileId stays ahead
          setNextFileId((n) => (created.id >= n ? Number(created.id) + 1 : n));
          return;
        }
      } catch (e) {
        console.error("Remote create_file failed:", e);
        // fall through to local creation if desired, or keep input open
        return;
      }
    } else {
      console.error("onCreateFile is not a function");
    }

    const f = createNewEmptyFile(clean);
    if (f) {
      setShowNewFileInput(false);
      setNewFileName("");
    }
  };

  const handleNewFileKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      confirmCreateNewFile();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setShowNewFileInput(false);
      setNewFileName("");
    }
  };

  const handleEditorDidMount = (editor) => {
    setEditorInstance(editor);

    // Set initial content
    if (activeFile) {
      editor.setValue(activeFile.content || "");
    }

    // Debug: Log editor dimensions and options
    console.log("🎯 Monaco Editor mounted");
    console.log("Editor dimensions:", editor.getLayoutInfo());
    console.log("Line height option:", editor.getOption(1)); // lineHeight
    console.log("Font size option:", editor.getOption(13)); // fontSize
    console.log("Line numbers option:", editor.getOption(2)); // lineNumbers

    // Force layout update to fix line numbers
    setTimeout(() => {
      editor.layout();
      console.log("🔄 Editor layout updated");
      console.log("Dimensions after layout:", editor.getLayoutInfo());
    }, 100);
  };

  const handleContentChange = useCallback(() => {
    if (!activeFile) return;

    const newContent = editorInstance?.getValue() || "";
    setEditorContent(newContent);

    // Debounce the change to avoid overwhelming the parent component
    if (lastChangeRef.current) {
      clearTimeout(lastChangeRef.current);
    }

    lastChangeRef.current = setTimeout(() => {
      if (activeFile) {
        // Update the file in the parent component
        onFileChange(activeFile.id, newContent);
      }
    }, 300);
  }, [activeFile, onFileChange, editorInstance]);

  const handleSave = () => {
    if (activeFile && editorInstance) {
      const content = editorInstance.getValue();
      onFileChange(activeFile.id, content);
      console.log("💾 File saved:", {
        fileId: activeFile.id,
        contentLength: content.length,
      });
    }
  };

  const handleLanguageChange = (event) => {
    setSelectedLanguage(event.target.value);
  };

  const getFileIcon = (fileName) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    const iconMap = {
      js: "🔷",
      jsx: "⚛️",
      ts: "🔷",
      tsx: "⚛️",
      html: "🌐",
      htm: "🌐",
      css: "🎨",
      scss: "🎨",
      sass: "🎨",
      json: "📋",
      md: "📝",
      py: "🐍",
      java: "☕",
      cpp: "⚙️",
      cc: "⚙️",
      c: "⚙️",
      rs: "🦀",
      go: "🐹",
      php: "🐘",
      sql: "🗄️",
      xml: "📄",
      yml: "📄",
      yaml: "📄",
      txt: "📄",
    };
    return iconMap[extension] || "📄";
  };

  // Force editor layout update after mount
  useEffect(() => {
    if (editorInstance) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        editorInstance.layout();
        console.log("🔄 Forcing editor layout update from useEffect");
        console.log(
          "Dimensions after useEffect layout:",
          editorInstance.getLayoutInfo()
        );
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [editorInstance]);

  // Force layout update when active file or language changes
  useEffect(() => {
    if (editorInstance) {
      const timer = setTimeout(() => {
        editorInstance.layout();
        console.log("🔄 Forcing layout update due to file/language change");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [activeFile, selectedLanguage, editorInstance]);

  return (
    <div className="monaco-editor-container">
      {/* Left Sidebar */}
      <div className="editor-sidebar">
        <div className="sidebar-header">
          <h3>Files</h3>
          <button
            className="add-file-btn"
            onClick={handleCreateNewFile}
            title={showNewFileInput ? "Close" : "Create new file"}
          >
            {showNewFileInput ? "x" : "+"}
          </button>
        </div>

        {showNewFileInput && (
          <div style={{ padding: "8px 16px" }}>
            <input
              type="text"
              placeholder="New file name (e.g. index.js)"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              onKeyDown={handleNewFileKeyDown}
              style={{
                width: "100%",
                padding: "8px 10px",
                borderRadius: 6,
                border: "1px solid #3e3e42",
                outline: "none",
                background: "#1e1e1e",
                color: "#ccc",
                marginBottom: 6,
              }}
              autoFocus
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-primary" onClick={confirmCreateNewFile}>
                Create
              </button>
            </div>
          </div>
        )}

        <div className="file-explorer">
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

        <div className="sidebar-footer">
          <div className="language-selector">
            <label htmlFor="language-select">Language:</label>
            <select
              id="language-select"
              value={selectedLanguage}
              onChange={handleLanguageChange}
              className="language-dropdown"
            >
              {availableLanguages.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary" onClick={handleSave}>
            Save
          </button>
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
              key={`${activeFile.id}-${selectedLanguage}`}
              height="100%"
              language={selectedLanguage}
              value={editorContent}
              onChange={handleContentChange}
              onMount={handleEditorDidMount}
              options={{
                theme: "vs-dark",
                fontSize: 14,
                fontFamily:
                  "JetBrains Mono, Consolas, Monaco, 'Courier New', monospace",
                minimap: { enabled: true },
                wordWrap: "on",
                lineNumbers: "on",
                roundedSelection: false,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                lineNumbersMinChars: 5,
                fixedOverflowWidgets: true,
                lineHeight: 20,
                renderLineHighlight: "all",
                glyphMargin: false,
                folding: false,
                scrollbar: {
                  vertical: "visible",
                  horizontal: "visible",
                  verticalScrollbarSize: 14,
                  horizontalScrollbarSize: 14,
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
                {availableLanguages.find(
                  (lang) => lang.value === selectedLanguage
                )?.label || selectedLanguage}
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
