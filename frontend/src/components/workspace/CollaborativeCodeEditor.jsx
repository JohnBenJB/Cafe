import React, { useState, useEffect, useRef, useCallback } from "react";
import { collaborativeEditorService } from "../../services/collaborativeEditor";
import "./CollaborativeCodeEditor.css";

const CollaborativeCodeEditor = ({
  files,
  onFileChange,
  tableId,
  currentUser,
  onCollaboratorUpdate,
}) => {
  const [activeFile, setActiveFile] = useState(files[0] || null);
  const [editorContent, setEditorContent] = useState("");
  const [isCollaborating, setIsCollaborating] = useState(false);
  const [collaborators, setCollaborators] = useState([]);
  const [cursorPositions, setCursorPositions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const editorRef = useRef(null);
  // const cursorRefs = useRef(new Map());
  const lastChangeRef = useRef(null);

  // Initialize collaborative editing
  useEffect(() => {
    if (tableId && currentUser) {
      initializeCollaboration();
    }

    return () => {
      collaborativeEditorService.cleanup();
    };
  }, [tableId, currentUser]);

  // Set up collaboration callbacks
  useEffect(() => {
    collaborativeEditorService.setFileContentUpdateCallback(
      handleRemoteFileChange
    );
    collaborativeEditorService.setCursorMoveCallback(handleRemoteCursorMove);
    collaborativeEditorService.setUserJoinCallback(handleUserJoin);
    collaborativeEditorService.setUserLeaveCallback(handleUserLeave);
  }, []);

  // Update editor content when active file changes
  useEffect(() => {
    if (activeFile) {
      setEditorContent(activeFile.content);
    }
  }, [activeFile]);

  const initializeCollaboration = async () => {
    try {
      setIsLoading(true);
      setError("");

      // Get user identity from internet identity service
      const identity = await getCurrentUserIdentity();
      if (!identity) {
        throw new Error("User identity not available");
      }

      // Initialize collaborative editor service
      await collaborativeEditorService.initialize(identity, tableId);
      setIsCollaborating(true);

      // Load initial file content from storage
      if (activeFile) {
        await loadFileFromStorage(activeFile.id);
      }
    } catch (error) {
      console.error("Failed to initialize collaboration:", error);
      setError("Failed to initialize collaborative editing");
      setIsCollaborating(false);
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentUserIdentity = async () => {
    // This would get the identity from the internet identity service
    // For now, we'll return a mock identity
    return {
      getPrincipal: () => ({
        toText: () => currentUser?.principal || "mock-principal",
      }),
    };
  };

  const loadFileFromStorage = async (fileId) => {
    try {
      const content = await collaborativeEditorService.loadFileFromStorage(
        fileId
      );
      if (content) {
        setEditorContent(content);
        // Update the file in the parent component
        onFileChange(fileId, content);
      }
    } catch (error) {
      console.error("Failed to load file from storage:", error);
    }
  };

  const handleFileSelect = (file) => {
    setActiveFile(file);
    setEditorContent(file.content);
  };

  const handleEditorChange = useCallback(
    (newContent) => {
      setEditorContent(newContent);

      // Debounce the change to avoid overwhelming the network
      if (lastChangeRef.current) {
        clearTimeout(lastChangeRef.current);
      }

      lastChangeRef.current = setTimeout(() => {
        if (activeFile && isCollaborating) {
          // Send change to other collaborators
          collaborativeEditorService.sendFileChange(activeFile.id, newContent);

          // Update local file state
          onFileChange(activeFile.id, newContent);
        }
      }, 300);
    },
    [activeFile, isCollaborating, onFileChange]
  );

  const handleRemoteFileChange = (fileId, content, user) => {
    if (fileId === activeFile?.id) {
      setEditorContent(content);
      // Update the file in the parent component
      onFileChange(fileId, content);
    }
    console.log("Remote file change:", { fileId, content, user });
  };

  const handleRemoteCursorMove = (update) => {
    setCursorPositions((prev) => {
      const newPositions = prev.filter((p) => p.user !== update.user);
      newPositions.push(update);
      return newPositions;
    });
  };

  const handleUserJoin = (update) => {
    setCollaborators((prev) => {
      const newCollaborators = prev.filter((c) => c.user !== update.user);
      newCollaborators.push(update);
      return newCollaborators;
    });

    if (onCollaboratorUpdate) {
      onCollaboratorUpdate(update);
    }
  };

  const handleUserLeave = (update) => {
    setCollaborators((prev) => prev.filter((c) => c.user !== update.user));

    if (onCollaboratorUpdate) {
      onCollaboratorUpdate(update);
    }
  };

  const handleCursorMove = (event) => {
    if (!isCollaborating || !activeFile) return;

    const position = {
      line: event.target.value
        .substring(0, event.target.selectionStart)
        .split("\n").length,
      ch:
        event.target.selectionStart -
        event.target.value.lastIndexOf("\n", event.target.selectionStart - 1),
    };

    collaborativeEditorService.sendCursorMove(activeFile.id, position);
  };

  const handleKeyDown = (event) => {
    // Handle special key combinations
    if (event.ctrlKey || event.metaKey) {
      switch (event.key) {
        case "s":
          event.preventDefault();
          handleSave();
          break;
        case "n":
          event.preventDefault();
          handleNewFile();
          break;
        default:
          break;
      }
    }
  };

  const handleSave = async () => {
    if (!activeFile || !isCollaborating) return;

    try {
      await collaborativeEditorService.sendFileChange(
        activeFile.id,
        editorContent,
        "save"
      );
      console.log("File saved successfully");
    } catch (error) {
      console.error("Failed to save file:", error);
      setError("Failed to save file");
    }
  };

  const handleNewFile = () => {
    const newFile = {
      id: Date.now(),
      name: `new-file-${Date.now()}.js`,
      content: "// New file\n",
      language: "javascript",
      isActive: false,
    };

    // This would be handled by the parent component
    // For now, we'll just log it
    console.log("New file requested:", newFile);
  };

  const renderCollaboratorCursors = () => {
    return cursorPositions.map((cursor, index) => {
      if (cursor.fileId !== activeFile?.id) return null;

      const cursorStyle = {
        position: "absolute",
        left: `${cursor.position.ch * 8}px`, // Approximate character width
        top: `${(cursor.position.line - 1) * 20}px`, // Approximate line height
        width: "2px",
        height: "20px",
        backgroundColor: getCollaboratorColor(cursor.user),
        zIndex: 1000,
        pointerEvents: "none",
      };

      return (
        <div key={`${cursor.user}-${index}`} style={cursorStyle}>
          <div className="cursor-label">{cursor.username || cursor.user}</div>
        </div>
      );
    });
  };

  const getCollaboratorColor = (userId) => {
    // Generate consistent colors for different users
    const colors = ["#ff6b6b", "#4ecdc4", "#45b7d1", "#96ceb4", "#feca57"];
    const index = userId.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const renderCollaborators = () => {
    return (
      <div className="collaborators-panel">
        <h4>Active Collaborators</h4>
        <div className="collaborators-list">
          {collaborators.map((collaborator, index) => (
            <div key={index} className="collaborator-item">
              <div
                className="collaborator-avatar"
                style={{
                  backgroundColor: getCollaboratorColor(collaborator.user),
                }}
              >
                {collaborator.username?.charAt(0) || "U"}
              </div>
              <span className="collaborator-name">
                {collaborator.username || collaborator.user}
              </span>
              <div className="collaborator-status active">●</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="collaborative-editor loading">
        <div className="loading-spinner">
          Initializing collaborative editing...
        </div>
      </div>
    );
  }

  return (
    <div className="collaborative-editor">
      <div className="editor-header">
        <div className="file-tabs">
          {files.map((file) => (
            <button
              key={file.id}
              className={`file-tab ${
                file.id === activeFile?.id ? "active" : ""
              }`}
              onClick={() => handleFileSelect(file)}
            >
              {file.name}
              {file.id === activeFile?.id && (
                <span className="file-status">
                  {isCollaborating ? "●" : "○"}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="editor-actions">
          <button
            className="btn-secondary"
            onClick={handleNewFile}
            title="New File (Ctrl+N)"
          >
            New File
          </button>
          <button
            className="btn-primary"
            onClick={handleSave}
            title="Save (Ctrl+S)"
          >
            Save
          </button>
        </div>
      </div>

      <div className="editor-container">
        <div className="code-editor-wrapper">
          <textarea
            ref={editorRef}
            className="code-editor"
            value={editorContent}
            onChange={(e) => handleEditorChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onSelect={handleCursorMove}
            placeholder="Start coding collaboratively..."
            spellCheck={false}
          />
          {renderCollaboratorCursors()}
        </div>

        <div className="editor-sidebar">
          {renderCollaborators()}

          <div className="collaboration-status">
            <div
              className={`status-indicator ${
                isCollaborating ? "connected" : "disconnected"
              }`}
            >
              {isCollaborating ? "●" : "○"}
            </div>
            <span className="status-text">
              {isCollaborating ? "Collaborating" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError("")}>×</button>
        </div>
      )}
    </div>
  );
};

export default CollaborativeCodeEditor;
