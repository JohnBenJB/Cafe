import React, { useState, useEffect, useRef, useCallback } from "react";
import { Editor } from "@monaco-editor/react";
import { storageService } from "../../services/storageService";
import "./MonacoEditor.css";

const MonacoEditor = ({ files = [], onFileChange, tableId, identity }) => {
  const [activeFile, setActiveFile] = useState(files[0] || null);
  const [selectedLanguage, setSelectedLanguage] = useState("javascript");
  const [editorContent, setEditorContent] = useState("");
  const [editorInstance, setEditorInstance] = useState(null);
  const [isStorageReady, setIsStorageReady] = useState(false);
  const [nextFileId, setNextFileId] = useState(
    files.length > 0 ? Math.max(...files.map((f) => f.id)) + 1 : 1
  );

  const lastChangeRef = useRef(null);

  // Available languages for the editor
  const availableLanguages = [
    { value: "javascript", label: "JavaScript" },
    { value: "typescript", label: "TypeScript" },
    { value: "python", label: "Python" },
    { value: "java", label: "Java" },
    { value: "cpp", label: "C++" },
    { value: "csharp", label: "C#" },
    { value: "go", label: "Go" },
    { value: "rust", label: "Rust" },
    { value: "php", label: "PHP" },
    { value: "ruby", label: "Ruby" },
    { value: "swift", label: "Swift" },
    { value: "kotlin", label: "Kotlin" },
    { value: "html", label: "HTML" },
    { value: "css", label: "CSS" },
    { value: "scss", label: "SCSS" },
    { value: "json", label: "JSON" },
    { value: "xml", label: "XML" },
    { value: "yaml", label: "YAML" },
    { value: "markdown", label: "Markdown" },
    { value: "sql", label: "SQL" },
    { value: "shell", label: "Shell" },
    { value: "plaintext", label: "Plain Text" },
  ];

  // Initialize storage service when component mounts
  useEffect(() => {
    if (identity && tableId) {
      storageService
        .initialize(identity)
        .then(() => {
          setIsStorageReady(true);
          console.log("✅ Storage service initialized successfully");
        })
        .catch((error) => {
          console.error("❌ Failed to initialize storage service:", error);
          setIsStorageReady(false);
        });
    }
  }, [identity, tableId]);

  // Update editor content when active file changes
  useEffect(() => {
    if (activeFile) {
      setEditorContent(activeFile.content || "");
      // Auto-detect language for the selected file
      if (activeFile.name) {
        const detectedLanguage = detectLanguageFromFileName(activeFile.name);
        setSelectedLanguage(detectedLanguage);
      }
    }
  }, [activeFile]);

  // Update nextFileId when files change
  useEffect(() => {
    if (files.length > 0) {
      const maxId = Math.max(...files.map((f) => f.id));
      setNextFileId(maxId + 1);
    }
  }, [files]);

  // Force layout update when editor instance changes
  useEffect(() => {
    if (editorInstance) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        editorInstance.layout();
        console.log("🔄 Forcing editor layout update from useEffect");
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

  // Detect language from file extension
  const detectLanguageFromFileName = (fileName) => {
    const extension = fileName.split(".").pop()?.toLowerCase();
    const languageMap = {
      js: "javascript",
      jsx: "javascript",
      ts: "typescript",
      tsx: "typescript",
      py: "python",
      java: "java",
      cpp: "cpp",
      cc: "cpp",
      cxx: "cpp",
      cs: "csharp",
      go: "go",
      rs: "rust",
      php: "php",
      rb: "ruby",
      swift: "swift",
      kt: "kotlin",
      html: "html",
      htm: "html",
      css: "css",
      scss: "scss",
      json: "json",
      xml: "xml",
      yml: "yaml",
      yaml: "yaml",
      md: "markdown",
      sql: "sql",
      sh: "shell",
      bash: "shell",
      txt: "plaintext",
    };
    return languageMap[extension] || "plaintext";
  };

  // Handle file selection
  const handleFileSelect = (file) => {
    setActiveFile(file);
  };

  // Handle language change
  const handleLanguageChange = (event) => {
    setSelectedLanguage(event.target.value);
  };

  // Handle editor mount
  const handleEditorDidMount = (editor) => {
    setEditorInstance(editor);
    console.log("✅ Monaco Editor mounted successfully");
  };

  // Handle content change with debouncing
  const handleContentChange = useCallback(
    (value) => {
      if (!activeFile) return;

      setEditorContent(value);

      // Debounce file change notifications
      if (lastChangeRef.current) {
        clearTimeout(lastChangeRef.current);
      }

      lastChangeRef.current = setTimeout(() => {
        if (onFileChange && activeFile) {
          onFileChange({
            ...activeFile,
            content: value,
          });
        }
      }, 300);
    },
    [activeFile, onFileChange]
  );

  // Handle save
  const handleSave = async () => {
    if (!activeFile || !isStorageReady) return;

    try {
      console.log("💾 Saving file:", activeFile.id);

      // Update file content in storage canister
      await storageService.updateFileContent(activeFile.id, editorContent);

      // Create a snapshot
      await storageService.createSnapshot(activeFile.id, "Manual save");

      console.log("✅ File saved successfully");
    } catch (error) {
      console.error("❌ Failed to save file:", error);
    }
  };

  // Handle create new file
  const handleCreateNewFile = async () => {
    if (!isStorageReady || !tableId) {
      console.error("❌ Storage not ready or tableId missing");
      return;
    }

    try {
      const fileName = `file-${nextFileId}.js`;
      const mimeType = "text/javascript";

      console.log("🔧 Creating new file:", { fileName, mimeType, tableId });

      // Create file in storage canister
      const fileId = await storageService.createFile(
        tableId,
        fileName,
        mimeType,
        ""
      );

      // Create local file object
      const newFile = {
        id: fileId,
        name: fileName,
        content: "",
        language: "javascript",
        isActive: true,
      };

      // Notify parent component about the new file
      if (onFileChange) {
        onFileChange(newFile, "create");
      }

      // Update local state
      setActiveFile(newFile);
      setNextFileId(nextFileId + 1);

      console.log("✅ New file created:", newFile);
    } catch (error) {
      console.error("❌ Failed to create new file:", error);
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
