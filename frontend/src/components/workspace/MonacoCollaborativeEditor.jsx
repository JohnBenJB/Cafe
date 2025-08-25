import React, { useState, useRef, useCallback, useEffect } from "react";
import Editor from "@monaco-editor/react";
import "./MonacoCollaborativeEditor.css";

const MonacoEditor = ({ files, onFileChange }) => {
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

  const handleCreateNewFile = () => {
    const newFile = {
      id: nextFileId,
      name: `new-file-${nextFileId}.js`,
      content: getDefaultContentForLanguage(selectedLanguage),
      language: selectedLanguage,
      isActive: false,
    };

    // Update the parent component with the new file
    if (onFileChange) {
      // Notify parent about the new file (we'll use a special format)
      // The parent can handle adding it to the files array
      onFileChange(`new-${nextFileId}`, newFile.content, newFile);

      // Set the new file as active
      setActiveFile(newFile);
      setEditorContent(newFile.content);

      // Increment the next file ID
      setNextFileId(nextFileId + 1);
    }
  };

  const getDefaultContentForLanguage = (language) => {
    const defaultContent = {
      javascript: `// New JavaScript file
console.log("Hello, World!");

function greet(name) {
  return \`Hello, \${name}!\`;
}

// Export for module usage
export default greet;`,
      typescript: `// New TypeScript file
interface User {
  name: string;
  age: number;
}

function greetUser(user: User): string {
  return \`Hello, \${user.name}! You are \${user.age} years old.\`;
}

export default greetUser;`,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New HTML File</title>
</head>
<body>
    <h1>Welcome to your new HTML file!</h1>
    <p>Start building your web page here.</p>
    
    <script src="script.js"></script>
</body>
</html>`,
      css: `/* New CSS file */
body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: #f5f5f5;
}

h1 {
    color: #333;
    text-align: center;
}

p {
    color: #666;
    line-height: 1.6;
}`,
      scss: `// New SCSS file
$primary-color: #007bff;
$secondary-color: #6c757d;

body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 20px;
    background-color: lighten($secondary-color, 45%);
}

h1 {
    color: $primary-color;
    text-align: center;
    
    &:hover {
        color: darken($primary-color, 10%);
    }
}`,
      json: `{
  "name": "new-file",
  "version": "1.0.0",
  "description": "A new JSON file",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "test": "echo \\"Error: no test specified\\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC"
}`,
      markdown: `# New Markdown File

Welcome to your new markdown file!

## Features

- **Bold text** and *italic text*
- [Links](https://example.com)
- \`Inline code\`

## Code Blocks

\`\`\`javascript
function hello() {
    console.log("Hello, World!");
}
\`\`\`

## Lists

1. First item
2. Second item
3. Third item

- Unordered item
- Another item`,
      python: `# New Python file
def main():
    print("Hello, World!")
    
    # Example function
    result = calculate_sum(5, 3)
    print(f"5 + 3 = {result}")

def calculate_sum(a, b):
    """Calculate the sum of two numbers."""
    return a + b

if __name__ == "__main__":
    main()`,
      java: `// New Java file
public class NewFile {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
        
        // Example method call
        int result = calculateSum(5, 3);
        System.out.println("5 + 3 = " + result);
    }
    
    public static int calculateSum(int a, int b) {
        return a + b;
    }
}`,
      cpp: `// New C++ file
#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    
    // Example function call
    int result = calculateSum(5, 3);
    cout << "5 + 3 = " << result << endl;
    
    return 0;
}

int calculateSum(int a, int b) {
    return a + b;
}`,
      c: `// New C file
#include <stdio.h>

int main() {
    printf("Hello, World!\\n");
    
    // Example function call
    int result = calculateSum(5, 3);
    printf("5 + 3 = %d\\n", result);
    
    return 0;
}

int calculateSum(int a, int b) {
    return a + b;
}`,
      rust: `// New Rust file
fn main() {
    println!("Hello, World!");
    
    // Example function call
    let result = calculate_sum(5, 3);
    println!("5 + 3 = {}", result);
}

fn calculate_sum(a: i32, b: i32) -> i32 {
    a + b
}`,
      go: `// New Go file
package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
    
    // Example function call
    result := calculateSum(5, 3)
    fmt.Printf("5 + 3 = %d\\n", result)
}

func calculateSum(a, b int) int {
    return a + b
}`,
      php: `<?php
// New PHP file
echo "Hello, World!\\n";

// Example function call
$result = calculateSum(5, 3);
echo "5 + 3 = " . $result . "\\n";

function calculateSum($a, $b) {
    return $a + $b;
}
?>`,
      sql: `-- New SQL file
-- Create a new table
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample data
INSERT INTO users (name, email) VALUES 
    ('John Doe', 'john@example.com'),
    ('Jane Smith', 'jane@example.com');

-- Query data
SELECT * FROM users;`,
      xml: `<?xml version="1.0" encoding="UTF-8"?>
<root>
    <title>New XML File</title>
    <description>This is a new XML file</description>
    <items>
        <item id="1">First item</item>
        <item id="2">Second item</item>
        <item id="3">Third item</item>
    </items>
</root>`,
      yaml: `# New YAML file
name: new-file
version: 1.0.0
description: A new YAML configuration file

# Configuration options
settings:
  debug: false
  timeout: 30
  retries: 3

# Database configuration
database:
  host: localhost
  port: 5432
  name: myapp
  user: admin

# Features
features:
  - authentication
  - logging
  - caching`,
      plaintext: `New Plain Text File

This is a new plain text file. You can use it for:

- Notes
- Documentation
- Configuration
- Any text-based content

Feel free to edit this content as needed.`,
    };

    return defaultContent[language] || defaultContent.javascript;
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
