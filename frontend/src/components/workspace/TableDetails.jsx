import React, { useState, useEffect, useRef, useCallback } from "react";
import { tableManagementService } from "../../services/tableManagement";
import { authenticationService } from "../../services/authentication";
import internetIdentityService from "../../services/internetIdentity";
import MonacoEditor from "./MonacoEditor";
import "./TableDetails.css";
import caffeineIcon from "/caffeine.jpg";

const TableDetails = ({ table, onLeaveTable }) => {
  const [collaborators, setCollaborators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  // New state for invitations
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]); // Add this back
  const [pendingSent, setPendingSent] = useState([]); // usernames
  const [sendingTo, setSendingTo] = useState(""); // principal currently being invited
  const [activeSection, setActiveSection] = useState("table");

  // Chat auto-scroll refs
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Code editor state
  const [files, setFiles] = useState([
    {
      id: "main-js",
      name: "main.js",
      content: `// Main JavaScript file
console.log('Hello from main.js');

function greet(name) {
  return \`Hello, \${name}!\`;
}

// Export for use in other files
export { greet };`,
      language: "javascript",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "app-jsx",
      name: "App.jsx",
      content: `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>Welcome to Cafe</h1>
        <p>Your collaborative development workspace</p>
      </header>
    </div>
  );
}

export default App;`,
      language: "javascript",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "app-css",
      name: "App.css",
      content: `/* App.css */
.App {
  text-align: center;
  padding: 20px;
}

.App-header {
  background-color: #282c34;
  padding: 20px;
  color: white;
  border-radius: 8px;
}

h1 {
  color: #61dafb;
  margin-bottom: 10px;
}`,
      language: "css",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "package-json",
      name: "package.json",
      content: `{
  "name": "cafe-project",
  "version": "1.0.0",
  "description": "A collaborative development workspace",
  "main": "index.js",
  "scripts": {
    "start": "react-scripts start",
    "build": "react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-scripts": "5.0.1"
  }
}`,
      language: "json",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "readme-md",
      name: "README.md",
      content: `# Cafe Project

A collaborative development workspace built with modern web technologies.

## Features

- Real-time code editing
- Multiple file support
- Chat collaboration
- User management

## Getting Started

1. Clone the repository
2. Install dependencies: \`npm install\`
3. Start development server: \`npm start\`

## Contributing

Feel free to contribute to this project!`,
      language: "markdown",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);
  const [activeFile, setActiveFile] = useState(null);

  // Set initial active file
  useEffect(() => {
    if (files.length > 0 && !activeFile) {
      setActiveFile(files[0]);
    }
  }, [files, activeFile]);

  // Chat interface state
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [activeTab, setActiveTab] = useState("message");
  const [showComingSoon, setShowComingSoon] = useState(false);
  const [showInviteOverlay, setShowInviteOverlay] = useState(false);
  // Chat functionality removed - using mock data for demo
  const [loadingStates, setLoadingStates] = useState({
    deleteTable: false,
    leaveTable: false,
    reloadTable: false,
  });

  // Auto-scroll when messages change
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize services and load data
  useEffect(() => {
    const initializeServices = async () => {
      try {
        setIsLoading(true);
        const identity = internetIdentityService.getIdentity();
        if (!identity) {
          throw new Error("No identity available");
        }

        await tableManagementService.initialize(identity);
        await authenticationService.initialize(identity);

        // Get current user
        const principal = identity.getPrincipal().toText();
        const userResult = await authenticationService.getUserByPrincipal(
          principal
        );
        if (userResult.success && userResult.user) {
          setCurrentUser(userResult.user);
        }

        // Get table collaborators
        console.log("🔍 Table object:", table);
        console.log(
          "🔍 Table creator:",
          table.creator,
          "Type:",
          typeof table.creator
        );
        console.log("🔍 Identity available:", !!identity);

        try {
          const collaboratorsResult =
            await tableManagementService.getTableCollaborators(table.id);
          console.log("🔍 Raw collaborators result:", collaboratorsResult);

          if (collaboratorsResult && collaboratorsResult.length > 0) {
            // Ensure the table creator is included
            let allCollaborators = [...collaboratorsResult];

            // Check if creator is already in the list
            const creatorExists = allCollaborators.some(
              (c) => String(c.principal) === String(table.creator)
            );

            if (!creatorExists && table.creator) {
              // Add creator to the list
              allCollaborators.unshift({
                principal: String(table.creator), // Convert to string if it's a Principal
                username: "Table Creator",
                email: "",
                github: "",
                slack: "",
                tablesCreated: [],
                tablesJoined: [],
                identityProvider: "",
                lastLogin: 0,
                isVerified: false,
                hasCompletedSetup: true,
                isCreator: true,
              });
            }

            setCollaborators(allCollaborators);
            console.log("✅ Loaded collaborators:", allCollaborators);
          } else {
            console.log(
              "ℹ️ No collaborators found for table, adding creator only"
            );
            // If no collaborators, at least show the creator
            if (table.creator) {
              setCollaborators([
                {
                  principal: String(table.creator),
                  username: "Table Creator",
                  email: "",
                  github: "",
                  slack: "",
                  tablesCreated: [],
                  tablesJoined: [],
                  identityProvider: "",
                  lastLogin: 0,
                  isVerified: false,
                  hasCompletedSetup: true,
                  isCreator: true,
                },
              ]);
            } else {
              setCollaborators([]);
            }
          }
        } catch (collaboratorsError) {
          console.error("❌ Failed to load collaborators:", collaboratorsError);
          // Fallback: just show the creator
          if (table.creator) {
            setCollaborators([
              {
                principal: String(table.creator),
                username: "Table Creator",
                email: "",
                github: "",
                slack: "",
                tablesCreated: [],
                tablesJoined: [],
                identityProvider: "",
                lastLogin: 0,
                isVerified: false,
                hasCompletedSetup: true,
                isCreator: true,
              },
            ]);
          } else {
            setCollaborators([]);
          }
        }

        // Initialize chat
        // Chat functionality removed - using mock data for demo
        console.log("ℹ️ Chat functionality is now frontend-only for demo");

        setIsLoading(false);
      } catch (error) {
        console.error("❌ Failed to initialize services:", error);
        setError(error.message);
        setIsLoading(false);
      }
    };

    if (table?.id) {
      initializeServices();
    }
  }, [table?.id]);

  // Reload current section state
  const reloadCurrentSection = useCallback(async () => {
    try {
      setLoadingStates((prev) => ({ ...prev, reloadTable: true }));
      switch (activeSection) {
        case "table":
          // Files are managed locally, no reload needed
          console.log("ℹ️ Files are managed locally, no reload needed");
          break;
        case "collab":
          // Reload chat messages or any collab-specific data
          break;
        case "code":
          // Reload code editor state if needed
          break;
        case "resources":
          // Reload resources if needed
          break;
        case "settings":
          // Settings are managed locally, no reload needed
          break;
        default:
          break;
      }
    } catch (error) {
      console.error("Error reloading section:", error);
    } finally {
      setLoadingStates((prev) => ({ ...prev, reloadTable: false }));
    }
  }, [activeSection]);

  useEffect(() => {
    if (table) {
      // Files are already initialized with sample content, no need to load from storage
      console.log("ℹ️ Table loaded, files are managed locally");
    }
  }, [table]);

  // Reload section when activeSection changes
  useEffect(() => {
    if (table) {
      reloadCurrentSection();
    }
  }, [activeSection, reloadCurrentSection, table]);

  const handleLeaveTable = async () => {
    if (!window.confirm("Are you sure you want to leave this table?")) {
      return;
    }

    try {
      setLoadingStates((prev) => ({ ...prev, leaveTable: true }));
      await tableManagementService.leaveTable(table.id);
      // No need to reload files since they're managed locally
      if (onLeaveTable) {
        onLeaveTable();
      }
    } catch (error) {
      console.error("Error leaving table:", error);
      setError(error.message);
    } finally {
      setLoadingStates((prev) => ({ ...prev, leaveTable: false }));
    }
  };

  const handleDeleteTable = async () => {
    if (
      !window.confirm(
        "Are you sure you want to delete this table? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      setLoadingStates((prev) => ({ ...prev, deleteTable: true }));
      await tableManagementService.deleteTable(table.id);
      // No need to reload files since they're managed locally
      if (onLeaveTable) {
        onLeaveTable();
      }
    } catch (error) {
      console.error("Error deleting table:", error);
      setError(error.message);
    } finally {
      setLoadingStates((prev) => ({ ...prev, deleteTable: false }));
    }
  };

  // Debug logging to check the values
  console.log("Debug isCreator:", {
    currentUser,
    currentUserPrincipal: currentUser?.principal,
    tableCreator: table.creator,
    tableCreatorType: typeof table.creator,
    currentUserPrincipalType: typeof currentUser?.principal,
    isEqual: currentUser?.principal === table.creator,
    isEqualString: String(currentUser?.principal) === String(table.creator),
  });

  const isCreator =
    currentUser &&
    (currentUser.principal === table.creator ||
      String(currentUser.principal) === String(table.creator));

  const handleSendMessage = async () => {
    if (!newMessage.trim()) {
      console.warn("⚠️ Cannot send message: No message content");
      return;
    }

    try {
      console.log("🔧 Sending message locally:", {
        message: newMessage.trim(),
        user: currentUser?.username || currentUser?.principal,
      });

      // Add message to local state
      const newMsg = {
        id: Date.now(),
        author: currentUser?.username || "Demo User",
        content: newMessage.trim(),
        timestamp: new Date().toLocaleTimeString(),
        date: new Date().toLocaleDateString(),
        type: "message",
        isOwnMessage: true,
      };

      setMessages((prev) => [...prev, newMsg]);
      setNewMessage("");

      // Auto-scroll to bottom
      setTimeout(scrollToBottom, 100);

      console.log("✅ Message added locally for demo");
    } catch (error) {
      console.error("❌ Failed to add message locally:", error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleMessageInputChange = (e) => {
    setNewMessage(e.target.value);
  };

  // Mock typing indicator for demo
  const renderTypingIndicator = () => {
    return null; // No typing indicator in demo
  };

  const handleComingSoon = () => {
    setShowComingSoon(true);
    setTimeout(() => setShowComingSoon(false), 3000);
  };

  const handleInviteMembers = () => {
    console.log("Opening invite members modal");
    handleComingSoon();
  };

  const handleAddHandbook = () => {
    console.log("Adding project handbook");
    handleComingSoon();
  };

  const handleWelcomeMessage = () => {
    console.log("Setting welcome message");
    handleComingSoon();
  };

  const handleChannelMenu = () => {
    console.log("Opening channel menu");
    handleComingSoon();
  };

  const handleAddChannel = () => {
    console.log("Adding new channel");
    handleComingSoon();
  };

  const loadAvailableUsers = async () => {
    try {
      const identity = internetIdentityService.getIdentity();
      if (!identity) {
        console.warn("No identity available for loading users");
        return;
      }

      await tableManagementService.initialize(identity);
      await authenticationService.initialize(identity);

      // Get all users from authentication service
      const allUsers = await authenticationService.getAllUsers();

      // Get current table collaborators
      const collaboratorsResult =
        await tableManagementService.getTableCollaborators(table.id);

      if (collaboratorsResult && collaboratorsResult.length > 0) {
        // Filter out users who are already collaborators
        const collaboratorPrincipals = collaboratorsResult.map(
          (c) => c.principal
        );
        const availableUsers = allUsers.filter(
          (user) => !collaboratorPrincipals.includes(user.principal)
        );
        setAvailableUsers(availableUsers);
        console.log("✅ Available users loaded:", availableUsers);
      } else {
        // If no collaborators, all users are available
        setAvailableUsers(allUsers);
        console.log("✅ All users available (no collaborators):", allUsers);
      }
    } catch (error) {
      console.error("❌ Failed to load available users:", error);
      setError("Failed to load users for invitation");
    }
  };

  const loadPendingSentInvitations = async () => {
    try {
      const identity = internetIdentityService.getIdentity();
      if (!identity) {
        console.warn("No identity available for loading pending invitations");
        return;
      }

      await tableManagementService.initialize(identity);
      const sentRequests = await tableManagementService.getPendingSentRequests(
        table.id
      );

      // The backend returns usernames directly, so we can use them as-is
      setPendingSent(sentRequests);
      console.log("✅ Pending sent invitations loaded:", sentRequests);
    } catch (error) {
      console.error("❌ Failed to load pending sent invitations:", error);
    }
  };

  const filteredInvitees = inviteSearch.trim()
    ? availableUsers
        .filter(
          (u) =>
            (u.username || "")
              .toLowerCase()
              .includes(inviteSearch.toLowerCase()) ||
            (u.email || "")
              .toLowerCase()
              .includes(inviteSearch.toLowerCase()) ||
            (u.github || "")
              .toLowerCase()
              .includes(inviteSearch.toLowerCase()) ||
            (u.principal || "")
              .toString()
              .toLowerCase()
              .includes(inviteSearch.toLowerCase())
        )
        // Exclude existing collaborators and duplicates
        .filter((u) => !collaborators.find((c) => c.principal === u.principal))
    : [];

  const handleSendInvite = async (user) => {
    try {
      setInviteLoading(true);
      setSendingTo(user.principal);
      await tableManagementService.requestJoinTable(user.principal, table.id);

      // Update pending list by username if available
      const username = user.username || user.principal?.toString?.() || "User";
      setPendingSent((prev) =>
        prev.includes(username) ? prev : [...prev, username]
      );
      setInviteSearch("");

      // Reload available users to exclude the invited user
      await loadAvailableUsers();

      // Reload pending sent invitations to get the latest state
      await loadPendingSentInvitations();

      console.log("✅ Invitation sent successfully to:", username);
    } catch (e) {
      console.error("❌ Failed to send invitation:", e);
      setError(e?.message || "Failed to send invitation");
    } finally {
      setInviteLoading(false);
      setSendingTo("");
    }
  };

  // Collaborative editor handlers
  const handleFileContentChange = (fileId, content, newFile) => {
    if (newFile && newFile.name) {
      // Add new file and set active
      setFiles((prev) => {
        const deactivated = prev.map((f) => ({ ...f, isActive: false }));
        return [...deactivated, { ...newFile, isActive: true }];
      });
      return;
    }

    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, content } : f))
    );

    // Files are managed locally for demo - no need to persist to storage
    console.log("✅ File content updated locally:", {
      fileId,
      contentLength: content.length,
    });
  };

  // Check for typing users periodically - Mock implementation for demo
  useEffect(() => {
    // No need to check typing users in demo
  }, []);

  // Frontend file creation system
  const handleCreateNewFile = (fileName) => {
    if (!fileName) return;

    // Generate unique file ID
    const fileId = `file_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Determine file type and initial content based on extension
    const fileExtension = fileName.split(".").pop()?.toLowerCase();
    let initialContent = "";
    let language = "javascript";

    switch (fileExtension) {
      case "js":
        initialContent = `// ${fileName}\nconsole.log('Hello from ${fileName}');`;
        language = "javascript";
        break;
      case "jsx":
        initialContent = `import React from 'react';\n\nfunction ${
          fileName.split(".")[0]
        }() {\n  return (\n    <div>\n      <h1>${
          fileName.split(".")[0]
        }</h1>\n    </div>\n  );\n}\n\nexport default ${
          fileName.split(".")[0]
        };`;
        language = "javascript";
        break;
      case "ts":
        initialContent = `// ${fileName}\nconst message: string = 'Hello from ${fileName}';\nconsole.log(message);`;
        language = "typescript";
        break;
      case "tsx":
        initialContent = `import React from 'react';\n\ninterface ${
          fileName.split(".")[0]
        }Props {\n  // Add your props here\n}\n\nfunction ${
          fileName.split(".")[0]
        }({}: ${
          fileName.split(".")[0]
        }Props) {\n  return (\n    <div>\n      <h1>${
          fileName.split(".")[0]
        }</h1>\n    </div>\n  );\n}\n\nexport default ${
          fileName.split(".")[0]
        };`;
        language = "typescript";
        break;
      case "css":
        initialContent = `/* ${fileName} */\n.${fileName
          .split(".")[0]
          .toLowerCase()} {\n  /* Add your styles here */\n}`;
        language = "css";
        break;
      case "scss":
        initialContent = `// ${fileName}\n.${fileName
          .split(".")[0]
          .toLowerCase()} {\n  // Add your SCSS styles here\n}`;
        language = "scss";
        break;
      case "html":
        initialContent = `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${
          fileName.split(".")[0]
        }</title>\n</head>\n<body>\n  <h1>${
          fileName.split(".")[0]
        }</h1>\n  <script src="script.js"></script>\n</body>\n</html>`;
        language = "html";
        break;
      case "py":
        initialContent = `# ${fileName}\nprint("Hello from ${fileName}")`;
        language = "python";
        break;
      case "java":
        initialContent = `public class ${
          fileName.split(".")[0]
        } {\n    public static void main(String[] args) {\n        System.out.println("Hello from ${fileName}");\n    }\n}`;
        language = "java";
        break;
      case "cpp":
        initialContent = `#include <iostream>\n\nint main() {\n    std::cout << "Hello from ${fileName}" << std::endl;\n    return 0;\n}`;
        language = "cpp";
        break;
      case "rs":
        initialContent = `fn main() {\n    println!("Hello from ${fileName}");\n}`;
        language = "rust";
        break;
      case "go":
        initialContent = `package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello from ${fileName}")\n}`;
        language = "go";
        break;
      case "php":
        initialContent = `<?php\n// ${fileName}\necho "Hello from ${fileName}";\n?>`;
        language = "php";
        break;
      case "rb":
        initialContent = `# ${fileName}\nputs "Hello from ${fileName}"`;
        language = "ruby";
        break;
      case "sql":
        initialContent = `-- ${fileName}\n-- Add your SQL queries here\nSELECT * FROM table_name;`;
        language = "sql";
        break;
      case "json":
        initialContent = `{\n  "name": "${
          fileName.split(".")[0]
        }",\n  "description": "A new file",\n  "version": "1.0.0"\n}`;
        language = "json";
        break;
      case "md":
        initialContent = `# ${
          fileName.split(".")[0]
        }\n\nThis is a new markdown file.\n\n## Features\n\n- Add your content here\n- Use markdown syntax\n- Create beautiful documentation`;
        language = "markdown";
        break;
      case "xml":
        initialContent = `<?xml version="1.0" encoding="UTF-8"?>\n<root>\n  <title>${
          fileName.split(".")[0]
        }</title>\n  <content>Add your XML content here</content>\n</root>`;
        language = "xml";
        break;
      case "yaml":
      case "yml":
        initialContent = `# ${fileName}\nname: ${
          fileName.split(".")[0]
        }\ndescription: A new YAML file\nversion: 1.0.0`;
        language = "yaml";
        break;
      case "toml":
        initialContent = `# ${fileName}\nname = "${
          fileName.split(".")[0]
        }"\ndescription = "A new TOML file"\nversion = "1.0.0"`;
        language = "toml";
        break;
      default:
        initialContent = `// ${fileName}\n// This is a new file\n// Add your content here`;
        language = "plaintext";
    }

    const newFile = {
      id: fileId,
      name: fileName,
      content: initialContent,
      language: language,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add to files array
    setFiles((prev) => [...prev, newFile]);

    // Set as active file
    setActiveFile(newFile);

    console.log("✅ New file created:", {
      fileName,
      fileId,
      language,
      contentLength: initialContent.length,
    });
  };

  // Handle file selection
  const handleFileSelect = (fileId) => {
    const selectedFile = files.find((f) => f.id === fileId);
    if (selectedFile) {
      setActiveFile(selectedFile);
      console.log("✅ File selected:", selectedFile.name);
    }
  };

  // Button functionality functions

  if (isLoading) {
    return (
      <div className="table-details">
        <div className="loading">Loading table details...</div>
      </div>
    );
  }

  return (
    <div className="table-details">
      {/* Navigation - Always visible */}
      <div className="pa-bottom-nav">
        <div className="pa-nav-pills">
          <button
            className={`pa-nav-pill ${
              activeSection === "table" ? "pa-active" : ""
            }`}
            onClick={() => setActiveSection("table")}
          >
            <div className="pa-pill-icon">
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M1 8.5H5C5.13261 8.5 5.25975 8.55272 5.35352 8.64648C5.44728 8.74025 5.5 8.86739 5.5 9V17C5.5 17.1326 5.44728 17.2597 5.35352 17.3535C5.25975 17.4473 5.13261 17.5 5 17.5H3L2.7627 17.4883C2.21174 17.4358 1.69116 17.202 1.28516 16.8193C0.822809 16.3834 0.542856 15.7874 0.503906 15.1533L0.5 14.9854V9C0.5 8.86739 0.552716 8.74025 0.646484 8.64648C0.740253 8.55272 0.867392 8.5 1 8.5ZM9 8.5H17C17.1326 8.5 17.2597 8.55272 17.3535 8.64648C17.4473 8.74025 17.5 8.86739 17.5 9V15C17.5 15.6375 17.2566 16.2509 16.8193 16.7148C16.3834 17.1772 15.7874 17.4562 15.1533 17.4951L14.9854 17.5H9C8.86739 17.5 8.74025 17.4473 8.64648 17.3535C8.55272 17.2597 8.5 17.1326 8.5 17V9C8.5 8.86739 8.55272 8.74025 8.64648 8.64648C8.74025 8.55272 8.86739 8.5 9 8.5ZM5 0.5C5.13261 0.5 5.25975 0.552716 5.35352 0.646484C5.44728 0.740253 5.5 0.867392 5.5 1V5C5.5 5.13261 5.44728 5.25975 5.35352 5.35352C5.25975 5.44728 5.13261 5.5 5 5.5H1C0.867392 5.5 0.740253 5.44728 0.646484 5.35352C0.552716 5.25975 0.5 5.13261 0.5 5V3L0.511719 2.7627C0.56421 2.21174 0.798013 1.69116 1.18066 1.28516C1.61639 0.823045 2.21196 0.543081 2.8457 0.503906L3.01465 0.5H5ZM9 0.5H15C15.6375 0.499964 16.2509 0.743444 16.7148 1.18066C17.1769 1.61638 17.4559 2.21198 17.4951 2.8457L17.5 3.01465V5C17.5 5.13261 17.4473 5.25975 17.3535 5.35352C17.2597 5.44728 17.1326 5.5 17 5.5H9C8.86739 5.5 8.74025 5.44728 8.64648 5.35352C8.55272 5.25975 8.5 5.13261 8.5 5V1C8.5 0.867392 8.55272 0.740253 8.64648 0.646484C8.74025 0.552716 8.86739 0.5 9 0.5Z"
                  stroke="#C4C4C4"
                />
              </svg>
            </div>
            <span>Table</span>
          </button>
          <button
            className={`pa-nav-pill ${
              activeSection === "resources" ? "pa-active" : ""
            }`}
            onClick={() => setActiveSection("resources")}
          >
            <div className="pa-pill-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M15.5 10.25L20 12.5L11 17L2 12.5L6.5 10.25M15.5 15.25L20 17.5L11 22L2 17.5L6.5 15.25M11 3L20 7.5L11 12L2 7.5L11 3Z"
                  stroke="#C4C4C4"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
            <span>Resources</span>
          </button>
          <button
            className={`pa-nav-pill ${
              activeSection === "code" ? "pa-active" : ""
            }`}
            onClick={() => setActiveSection("code")}
          >
            <div className="pa-pill-icon">
              <svg
                width="26"
                height="19"
                viewBox="0 0 26 19"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M15.2012 1L10.0602 18.1812"
                  stroke="#c4c4c4"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                ></path>
                <path
                  d="M24.8301 9.75244C24.83 9.94753 24.7628 10.1354 24.6416 10.2847L24.5859 10.3462L18.4668 16.5103C18.3102 16.6611 18.1018 16.7445 17.8857 16.7427C17.6682 16.7408 17.459 16.653 17.3047 16.4976C17.1504 16.3421 17.0626 16.1312 17.0605 15.9106C17.0589 15.7174 17.1234 15.5301 17.2412 15.3804L17.2949 15.3188L22.6465 9.92822L22.8213 9.75244L22.6465 9.57568L17.292 4.18213C17.136 4.02491 17.048 3.81144 17.0479 3.58838C17.0479 3.36515 17.1359 3.15097 17.292 2.99365C17.448 2.83658 17.6591 2.74864 17.8789 2.74854C18.0989 2.74854 18.3107 2.83644 18.4668 2.99365L24.5859 9.15771C24.7421 9.31503 24.8301 9.52921 24.8301 9.75244Z"
                  fill="#c4c4c4"
                  stroke="white"
                  strokeWidth="0.5"
                ></path>
                <path
                  d="M0.25 9.73853C0.250075 9.54344 0.317248 9.35552 0.438477 9.2063L0.494141 9.14478L6.61328 2.98071C6.76986 2.82984 6.97832 2.7465 7.19434 2.74829C7.41183 2.75019 7.62104 2.83793 7.77539 2.99341C7.92966 3.14884 8.01751 3.35978 8.01953 3.58032C8.0212 3.77354 7.9567 3.9609 7.83887 4.1106L7.78516 4.17212L2.43359 9.56274L2.25879 9.73853L2.43359 9.91528L7.78809 15.3088C7.94409 15.4661 8.03211 15.6795 8.03223 15.9026C8.03223 16.1258 7.94421 16.34 7.78809 16.4973C7.63207 16.6544 7.42095 16.7423 7.20117 16.7424C6.98122 16.7424 6.76939 16.6545 6.61328 16.4973L0.494141 10.3333C0.338013 10.1759 0.25 9.96176 0.25 9.73853Z"
                  fill="#c4c4c4"
                  stroke="white"
                  strokeWidth="0.5"
                ></path>
              </svg>
            </div>
            <span>Code</span>
          </button>
          <button
            className={`pa-nav-pill ${
              activeSection === "collab" ? "pa-active" : ""
            }`}
            onClick={() => setActiveSection("collab")}
          >
            <div className="pa-pill-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M15.8335 1.66675C16.4966 1.66675 17.1324 1.93014 17.6013 2.39898C18.0701 2.86782 18.3335 3.50371 18.3335 4.16675C18.3335 4.82979 18.0701 5.46568 17.6013 5.93452C17.1324 6.40336 16.4966 6.66675 15.8335 6.66675C15.3869 6.66582 14.9486 6.54526 14.5644 6.31758L12.151 8.73092C12.379 9.1147 12.4993 9.55285 12.4993 9.99925C12.4993 10.4456 12.379 10.8838 12.151 11.2676L14.5644 13.6817C14.9487 13.4544 15.3869 13.3341 15.8335 13.3334C16.3848 13.3329 16.9208 13.5146 17.3582 13.8503C17.7955 14.186 18.1096 14.6568 18.2515 15.1895C18.3935 15.7222 18.3555 16.287 18.1432 16.7958C17.931 17.3046 17.5566 17.729 17.0781 18.0029C16.5997 18.2769 16.0441 18.385 15.4979 18.3105C14.9517 18.2359 14.4454 17.9829 14.0578 17.5908C13.6703 17.1987 13.4232 16.6895 13.3551 16.1424C13.2869 15.5954 13.4015 15.0411 13.681 14.5659L11.2669 12.1517C10.8832 12.3796 10.4452 12.4998 9.99893 12.4998C9.5527 12.4998 9.11471 12.3796 8.73102 12.1517L6.31685 14.5634C6.53685 14.9359 6.66602 15.3684 6.66602 15.8326C6.66602 16.327 6.51939 16.8104 6.24469 17.2215C5.96999 17.6326 5.57954 17.9531 5.12273 18.1423C4.66591 18.3315 4.16324 18.381 3.67829 18.2845C3.19334 18.1881 2.74788 17.95 2.39825 17.6004C2.04862 17.2507 1.81052 16.8053 1.71405 16.3203C1.61759 15.8354 1.6671 15.3327 1.85632 14.8759C2.04554 14.4191 2.36597 14.0286 2.77709 13.7539C3.18821 13.4792 3.67156 13.3326 4.16602 13.3326C4.62935 13.3326 5.06102 13.4609 5.43268 13.6801L7.84685 11.2651C7.61949 10.8817 7.49952 10.4442 7.49952 9.99841C7.49952 9.55267 7.61949 9.11515 7.84685 8.73175L5.43435 6.31842C5.05049 6.54551 4.61286 6.66578 4.16685 6.66675C3.6724 6.66675 3.18905 6.52013 2.77792 6.24542C2.3668 5.97072 2.04637 5.58027 1.85715 5.12346C1.66793 4.66664 1.61842 4.16398 1.71489 3.67902C1.81135 3.19407 2.04945 2.74861 2.39908 2.39898C2.74871 2.04935 3.19417 1.81125 3.67912 1.71479C4.16408 1.61832 4.66674 1.66783 5.12356 1.85705C5.58037 2.04627 5.97082 2.3667 6.24552 2.77782C6.52023 3.18895 6.66685 3.6723 6.66685 4.16675C6.66563 4.61283 6.54507 5.05047 6.31768 5.43425L8.73102 7.84842C9.11463 7.62046 9.55258 7.50007 9.99882 7.49993C10.4451 7.49978 10.8831 7.61987 11.2669 7.84758L13.681 5.43425C13.4542 5.0503 13.3342 4.61268 13.3335 4.16675C13.3335 3.50371 13.5969 2.86782 14.0658 2.39898C14.5346 1.93014 15.1705 1.66675 15.8335 1.66675ZM4.16685 14.5834C3.83533 14.5834 3.51739 14.7151 3.28297 14.9495C3.04855 15.184 2.91685 15.5019 2.91685 15.8334C2.91685 16.1649 3.04855 16.4829 3.28297 16.7173C3.51739 16.9517 3.83533 17.0834 4.16685 17.0834C4.49837 17.0834 4.81631 16.9517 5.05073 16.7173C5.28515 16.4829 5.41685 16.1649 5.41685 15.8334C5.41685 15.5019 5.28515 15.184 5.05073 14.9495C4.81631 14.7151 4.49837 14.5834 4.16685 14.5834ZM15.8335 14.5834C15.502 14.5834 15.1841 14.7151 14.9496 14.9495C14.7152 15.184 14.5835 15.5019 14.5835 15.8334C14.5835 16.1649 14.7152 16.4829 14.9496 16.7173C15.1841 16.9517 15.502 17.0834 15.8335 17.0834C16.165 17.0834 16.483 16.9517 16.7174 16.7173C16.9518 16.4829 17.0835 16.1649 17.0835 15.8334C17.0835 15.5019 16.9518 15.184 16.7174 14.9495C16.483 14.7151 16.165 14.5834 15.8335 14.5834ZM10.0002 8.75008C9.66866 8.75008 9.35072 8.88178 9.1163 9.1162C8.88188 9.35062 8.75018 9.66856 8.75018 10.0001C8.75018 10.3316 8.88188 10.6495 9.1163 10.884C9.35072 11.1184 9.66866 11.2501 10.0002 11.2501C10.3317 11.2501 10.6496 11.1184 10.8841 10.884C11.1185 10.6495 11.2502 10.3316 11.2502 10.0001C11.2502 9.66856 11.1185 9.35062 10.8841 9.1162C10.6496 8.88178 10.3317 8.75008 10.0002 8.75008ZM4.16685 2.91675C3.83533 2.91675 3.51739 3.04845 3.28297 3.28287C3.04855 3.51729 2.91685 3.83523 2.91685 4.16675C2.91685 4.49827 3.04855 4.81621 3.28297 5.05063C3.51739 5.28505 3.83533 5.41675 4.16685 5.41675C4.49837 5.41675 4.81631 5.28505 5.05073 5.05063C5.28515 4.81621 5.41685 4.49827 5.41685 4.16675C5.41685 3.83523 5.28515 3.51729 5.05073 3.28287C4.81631 3.04845 4.49837 2.91675 4.16685 2.91675ZM15.8335 2.91675C15.502 2.91675 15.1841 3.04845 14.9496 3.28287C14.7152 3.51729 14.5835 3.83523 14.5835 4.16675C14.5835 4.49827 14.7152 4.81621 14.9496 5.05063C15.1841 5.28505 15.502 5.41675 15.8335 5.41675C16.165 5.41675 16.483 5.28505 16.7174 5.05063C16.9518 4.81621 17.0835 4.49827 17.0835 4.16675C17.0835 3.83523 16.9518 3.51729 16.7174 3.28287C16.483 3.04845 16.165 2.91675 15.8335 2.91675Z"
                  fill="#C4C4C4"
                />
              </svg>
            </div>
            <span>Collab</span>
          </button>
          <button
            className={`pa-nav-pill ${
              activeSection === "settings" ? "pa-active" : ""
            }`}
            onClick={() => setActiveSection("settings")}
          >
            <div className="pa-pill-icon">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M2 12.8799L2 11.1199C2 10.0799 2.85 9.21994 3.9 9.21994C5.71 9.21994 6.45 7.93994 5.54 6.36994C5.02 5.46994 5.33 4.29994 6.24 3.77994L7.97 2.78994C8.76 2.31994 9.78 2.59994 10.25 3.38994L10.36 3.57994C11.26 5.14994 12.74 5.14994 13.65 3.57994L13.76 3.38994C14.23 2.59994 15.25 2.31994 16.04 2.78994L17.77 3.77994C18.68 4.29994 18.99 5.46994 18.47 6.36994C17.56 7.93994 18.3 9.21994 20.11 9.21994C21.15 9.21994 22.01 10.0699 22.01 11.1199V12.8799C22.01 13.9199 21.16 14.7799 20.11 14.7799C18.3 14.7799 17.56 16.0599 18.47 17.6299C18.99 18.5399 18.68 19.6999 17.77 20.2199L16.04 21.2099C15.25 21.6799 14.23 21.3999 13.76 20.6099L13.65 20.4199C12.75 18.8499 11.27 18.8499 10.36 20.4199L10.25 20.6099C9.78 21.3999 8.76 21.6799 7.97 21.2099L6.24 20.2199C5.33 19.6999 5.02 18.5299 5.54 17.6299C6.45 16.0599 5.71 14.7799 3.9 14.7799C2.85 14.7799 2 13.9199 2 12.8799Z"
                  fill="white"
                  stroke="#C4C4C4"
                  strokeWidth="1.5"
                  strokeMiterlimit="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
                  stroke="#C4C4C4"
                  strokeWidth="1.5"
                  strokeMiterlimit="10"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <span>Settings</span>
          </button>
        </div>
        <div className="pa-cafe-icon">
          <img src={caffeineIcon} alt="caffeine icon" />
        </div>
      </div>

      {/* Profile & Account Container - Only show in table tab */}
      {activeSection === "table" && (
        <div className="pa-container">
          <div className="pa-header-row">
            <h2 className="pa-title">Profile & Account</h2>
          </div>
          <div className="pa-grid">
            <div className="pa-left">
              <div className="pa-picture-card">
                <div className="pa-picture">
                  {table?.title?.charAt(0)?.toUpperCase() || "T"}
                </div>
                <div className="pa-picture-edit" title="Change picture">
                  ✎
                </div>
              </div>
              <div className="pa-name-row">
                <div className="pa-name-label">Name:</div>
                <div className="pa-name-value">
                  {table?.title || "Untitled"}
                </div>
              </div>
              <div className="pa-id-row">
                <div className="pa-id-label">Unique ID:</div>
                <div className="pa-id-value">{String(table?.id)}</div>
              </div>
            </div>
            <div className="pa-right">
              <div className="pa-description">
                <div className="pa-section-title">Description</div>
                <div className="pa-description-body">
                  {table?.description ||
                    "No description provided for this table."}
                </div>
              </div>
              <div className="pa-connected">
                <div className="pa-section-title">Connected Accounts</div>
                <div className="pa-connected-item">
                  <div className="pa-connected-label">Github Integration:</div>
                  <button className="pa-connected-status pa-disabled" disabled>
                    Not connected
                  </button>
                </div>
                <div className="pa-connected-item">
                  <div className="pa-connected-label">Other Integration:</div>
                  <button className="pa-connected-status pa-disabled" disabled>
                    Not connected
                  </button>
                </div>
              </div>
              <div className="pa-ai">
                <div className="pa-section-title">AI</div>
                <div className="pa-ai-item">Caffeine ai</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table Header and Description - Only show in table tab */}
      {activeSection === "table" && (
        <>
          <div className="table-header">
            <h2>{table.title}</h2>
            <div className="table-actions">
              {isCreator && (
                <button
                  onClick={async () => {
                    setShowInviteOverlay(true);
                    await loadAvailableUsers();
                    await loadPendingSentInvitations();
                  }}
                  className="invite-btn"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="m22 2-7 7" />
                    <path d="m15 2 7 7-7 7" />
                  </svg>
                  Invite
                </button>
              )}
              {isCreator ? (
                <button
                  onClick={handleDeleteTable}
                  className="delete-btn"
                  disabled={loadingStates.deleteTable}
                >
                  {loadingStates.deleteTable ? (
                    <>
                      <svg
                        className="loading-spinner"
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path
                          d="M8 1a7 7 0 0 0-7 7h2a5 5 0 1 1 5 5v2a7 7 0 0 0 0-14z"
                          fill="currentColor"
                        />
                      </svg>
                      Deleting...
                    </>
                  ) : (
                    "Delete Table"
                  )}
                </button>
              ) : (
                <button
                  onClick={handleLeaveTable}
                  className="leave-btn"
                  disabled={loadingStates.leaveTable}
                >
                  {loadingStates.leaveTable ? (
                    <>
                      <svg
                        className="loading-spinner"
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path
                          d="M8 1a7 7 0 0 0-7 7h2a5 5 0 1 1 5 5v2a7 7 0 0 0 0-14z"
                          fill="currentColor"
                        />
                      </svg>
                      Leaving...
                    </>
                  ) : (
                    "Leave Table"
                  )}
                </button>
              )}
            </div>
          </div>
          {console.log(error)}
          {/* {error && <div className="error-message">{error}</div>} */}
        </>
      )}

      {/* Content Sections */}
      <div className="pa-content-sections">
        {activeSection === "table" && (
          <div className="pa-section-content">
            <div className="section-header">
              <h3>Table Overview</h3>
              <button
                onClick={reloadCurrentSection}
                className="reload-btn"
                title="Reload table data"
                disabled={loadingStates.reloadTable}
              >
                {loadingStates.reloadTable ? (
                  <svg
                    className="loading-spinner"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M3 21v-5h5" />
                  </svg>
                ) : (
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                    <path d="M21 3v5h-5" />
                    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                    <path d="M3 21v-5h5" />
                  </svg>
                )}
              </button>
            </div>
            <div className="table-info">
              <div className="info-item">
                <span className="info-label">Table ID:</span>
                <span className="info-value">{table.id}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Created by:</span>
                <span className="info-value">
                  {(() => {
                    const creator = collaborators.find(
                      (c) => String(c.principal) === String(table.creator)
                    );
                    return creator?.username || "Unknown";
                  })()}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Collaborators:</span>
                <span className="info-value">{collaborators.length}</span>
              </div>
            </div>

            <div className="collaborators-section">
              <h3>Collaborators</h3>
              <div className="collaborators-list">
                {collaborators.map((collaborator) => (
                  <div
                    key={collaborator.principal}
                    className="collaborator-item"
                  >
                    <div className="collaborator-avatar">
                      {collaborator.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="collaborator-info">
                      <div className="collaborator-name">
                        {collaborator.username}
                      </div>
                      <div className="collaborator-email">
                        {collaborator.email}
                      </div>
                      {(String(collaborator.principal) ===
                        String(table.creator) ||
                        collaborator.isCreator) && (
                        <div className="creator-badge">Creator</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeSection === "resources" && (
          <div className="pa-section-content">
            <h3>Resources</h3>
            <div className="resources-grid">
              <div className="resource-card">
                <div className="resource-icon">📁</div>
                <h4>Project Files</h4>
                <p>Manage your project files and assets</p>
              </div>
              <div className="resource-card">
                <div className="resource-icon">🔗</div>
                <h4>External Links</h4>
                <p>Store important links and references</p>
              </div>
              <div className="resource-card">
                <div className="resource-icon">📊</div>
                <h4>Data Sources</h4>
                <p>Connect to databases and APIs</p>
              </div>
            </div>
          </div>
        )}

        {activeSection === "code" && (
          <div className="pa-section-content code-editor-section">
            <MonacoEditor
              files={files}
              activeFile={activeFile}
              onFileChange={handleFileContentChange}
              onCreateFile={handleCreateNewFile}
              onFileSelect={handleFileSelect}
              currentUser={currentUser}
            />
          </div>
        )}

        {activeSection === "collab" && (
          <div className="pa-section-content">
            {/* Coming Soon Notification */}
            {showComingSoon && (
              <div className="coming-soon-notification">
                <div className="notification-content">
                  <span>🚀 Coming Soon!</span>
                  <p>This feature is under development</p>
                </div>
              </div>
            )}

            <div className="chat-interface">
              {/* Channel Header */}
              <div className="chat-header">
                <div className="channel-info">
                  <h2 className="channel-title">#Front-end Devs</h2>
                  <div className="channel-tabs">
                    <button
                      className={`tab-button ${
                        activeTab === "message" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("message")}
                    >
                      Message
                    </button>
                    <button
                      className={`tab-button ${
                        activeTab === "notes" ? "active" : ""
                      }`}
                      onClick={() => setActiveTab("notes")}
                    >
                      Notes
                    </button>
                  </div>
                </div>
                <div className="channel-actions">
                  <button className="action-button" onClick={handleAddChannel}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M8 1V15M1 8H15"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                  <div className="user-count">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M8 8C10.21 8 12 6.21 12 4S10.21 0 8 0 4 1.79 4 4s1.79 4 4 4zM0 14c0-2.67 5.33-4 8-4s8 1.33 8 4v2H0v-2z"
                        fill="currentColor"
                      />
                    </svg>
                    <span>3</span>
                  </div>
                  <button className="menu-button" onClick={handleChannelMenu}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="4" r="1" fill="currentColor" />
                      <circle cx="8" cy="8" r="1" fill="currentColor" />
                      <circle cx="8" cy="12" r="1" fill="currentColor" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Welcome Section */}
              <div className="welcome-section">
                <div className="welcome-content">
                  <div className="welcome-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        fill="currentColor"
                      />
                    </svg>
                  </div>
                  <div className="welcome-text">
                    <h3>Everyone's all here in #Front-end Devs</h3>
                    <p>
                      Share announcements and updates about the project and
                      every other important information here...
                    </p>
                  </div>
                </div>
                <div className="welcome-actions">
                  <button
                    className="welcome-action-btn"
                    onClick={handleInviteMembers}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M8 8C10.21 8 12 6.21 12 4S10.21 0 8 0 4 1.79 4 4s1.79 4 4 4zM0 14c0-2.67 5.33-4 8-4s8 1.33 8 4v2H0v-2z"
                        fill="currentColor"
                      />
                    </svg>
                    Invite team members
                  </button>
                  <button
                    className="welcome-action-btn"
                    onClick={handleAddHandbook}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M14 2H2v12h12V2zM6 4h4v2H6V4zm0 4h4v2H6V8z"
                        fill="currentColor"
                      />
                    </svg>
                    Add Project Handbook
                  </button>
                  <button
                    className="welcome-action-btn"
                    onClick={handleWelcomeMessage}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path
                        d="M8 2C4.69 2 2 4.69 2 8s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm-1 9V7h2v4H7zm0 2h2v2H7v-2z"
                        fill="currentColor"
                      />
                    </svg>
                    Welcome Message
                  </button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="chat-messages" ref={messagesContainerRef}>
                {messages.length === 0 ? (
                  <div className="no-messages">
                    <div className="no-messages-icon">
                      <svg
                        width="48"
                        height="48"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M8 12h8M8 16h5M12 8h.01M21 12c0 4.418-4.03 8-9 8a9.863 0 01-4.255-.98L3 20l1.98-4.745A9.863 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                    <h3>No messages yet</h3>
                    <p>Start the conversation by sending a message!</p>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <React.Fragment key={message.id}>
                      {(index === 0 ||
                        messages[index - 1].date !== message.date) && (
                        <div className="message-separator">
                          <span>{message.date}</span>
                        </div>
                      )}

                      <div
                        className={`message ${
                          message.isOwnMessage ? "own-message" : ""
                        }`}
                      >
                        <div className="message-avatar">
                          <div className="avatar-initial">
                            {message.author.charAt(0)}
                          </div>
                        </div>
                        <div className="message-content">
                          <div className="message-header">
                            <span className="message-author">
                              {message.isOwnMessage ? "You" : message.author}
                            </span>
                            <span className="message-time">
                              {message.timestamp}
                            </span>
                          </div>
                          <div className="message-text">{message.content}</div>
                        </div>
                      </div>
                    </React.Fragment>
                  ))
                )}
                {/* Typing indicator */}
                {renderTypingIndicator()}
                {/* Scroll target for auto-scrolling */}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <div className="message-input-container">
                <div className="input-wrapper">
                  <textarea
                    className="message-input"
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={handleMessageInputChange}
                    onKeyPress={handleKeyPress}
                    rows="1"
                  />
                  <button
                    className="action-btn primary send-btn"
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    title="Send message (Enter)"
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 2L11 13" />
                      <path d="M22 2L15 22L11 13L2 9L22 2Z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === "settings" && (
          <div className="pa-section-content">
            <h3>Settings</h3>

            {/* Debug info - remove this after fixing */}
            <div
              style={{
                background: "#f0f0f0",
                padding: "10px",
                margin: "10px 0",
                borderRadius: "4px",
                fontSize: "12px",
              }}
            >
              <strong>Debug Info:</strong>
              <br />
              Current User Principal:{" "}
              {currentUser?.principal?.toString?.() || "undefined"}
              <br />
              Table Creator: {table.creator?.toString?.() || "undefined"}
              <br />
              Is Creator: {isCreator ? "YES" : "NO"}
              <br />
              Current User: {JSON.stringify(currentUser, null, 2)}
            </div>
            <div className="settings-grid">
              <div className="setting-card">
                <h4>Table Settings</h4>
                <div className="setting-item">
                  <label>Table Name</label>
                  <input type="text" value={table.title} readOnly />
                </div>
                <div className="setting-item">
                  <label>Description</label>
                  <textarea value={table.description} readOnly />
                </div>
              </div>
              <div className="setting-card">
                <h4>Permissions</h4>
                <div className="setting-item">
                  <label>Public Access</label>
                  <input type="checkbox" />
                </div>
                <div className="setting-item">
                  <label>Allow Invites</label>
                  <input type="checkbox" defaultChecked />
                </div>
              </div>
              {isCreator && (
                <div className="setting-card danger-zone">
                  <h4>Danger Zone</h4>
                  <div className="setting-item">
                    <label>Delete Table</label>
                    <p className="danger-description">
                      This action cannot be undone. This will permanently delete
                      the table and remove all collaborators.
                    </p>
                    <button
                      onClick={handleDeleteTable}
                      className="delete-table-btn"
                    >
                      Delete Table
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Invite Overlay */}
      {showInviteOverlay && (
        <div className="invite-overlay">
          <div className="invite-overlay-content">
            <div className="invite-overlay-header">
              <h3>Invite Collaborators</h3>
              <button
                onClick={() => setShowInviteOverlay(false)}
                className="invite-overlay-close"
              >
                ×
              </button>
            </div>

            <div className="invite-input-row">
              <input
                type="text"
                value={inviteSearch}
                onChange={(e) => setInviteSearch(e.target.value)}
                placeholder="Search by username, email, GitHub, or Principal ID"
                className="invite-input"
                autoFocus
              />
            </div>

            {inviteSearch.trim() !== "" && (
              <div className="invite-results">
                {filteredInvitees.length === 0 ? (
                  <div className="invite-empty">No users found.</div>
                ) : (
                  filteredInvitees.slice(0, 8).map((u) => (
                    <div key={u.principal} className="invite-result-item">
                      <div className="invite-result-info">
                        <div className="invite-result-name">{u.username}</div>
                        <div className="invite-result-email">{u.email}</div>
                      </div>
                      <button
                        className="invite-send-btn"
                        disabled={inviteLoading || sendingTo === u.principal}
                        onClick={() => handleSendInvite(u)}
                      >
                        {sendingTo === u.principal ? "Sending..." : "Invite"}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            <div className="pending-section">
              <h4>Pending invites</h4>
              {pendingSent.length === 0 ? (
                <div className="invite-empty">No pending invites.</div>
              ) : (
                <ul className="pending-list">
                  {pendingSent.map((name, idx) => (
                    <li key={`${name}-${idx}`} className="pending-item">
                      <span className="pending-name">{name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TableDetails;
