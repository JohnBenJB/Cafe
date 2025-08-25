import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { tableManagementService } from "../services/tableManagement";
import { authenticationService } from "../services/authentication";
import internetIdentityService from "../services/internetIdentity";
import TableInvitations from "../components/workspace/TableInvitations";
import TableDetails from "../components/workspace/TableDetails";
import styles from "./Dashboard.module.css";
import cafeLogo from "/cafe.png";

const Dashboard = () => {
  const { user, isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();
  const [userProfile, setUserProfile] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    members: [],
  });
  const [memberSearch, setMemberSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [recentTables, setRecentTables] = useState([]);
  const [isLoadingTables, setIsLoadingTables] = useState(true);
  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [selectedTable, setSelectedTable] = useState(null);
  const [showInvitations, setShowInvitations] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const [tableCreationCount, setTableCreationCount] = useState(0);
  // eslint-disable-next-line no-unused-vars
  const [currentSubmissionId, setCurrentSubmissionId] = useState(null);
  const [modalSubmissionInProgress, setModalSubmissionInProgress] =
    useState(false);

  const [notifications] = useState([
    { id: 1, user: "Pythonlady", message: "sent you a message", avatar: "👩‍💻" },
    {
      id: 2,
      user: "DevMaster",
      message: "invited you to join a table",
      avatar: "👨‍💻",
    },
    {
      id: 3,
      user: "CodeNinja",
      message: "shared a table with you",
      avatar: "🥷",
    },
  ]);

  // Load all users for member search
  const loadAllUsers = useCallback(async () => {
    if (!isAuthenticated || !user) return;

    try {
      const identity = internetIdentityService.getIdentity();
      if (!identity) {
        console.error("No identity available");
        return;
      }

      await authenticationService.initialize(identity);

      // Ensure current user is registered first
      const principal = identity.getPrincipal().toText();
      let currentProfile =
        internetIdentityService.getCurrentUser() || user || {};
      if (
        !currentProfile?.username ||
        currentProfile.username === "User" ||
        !currentProfile?.email ||
        currentProfile.email === "user@example.com"
      ) {
        try {
          await internetIdentityService.loadUserProfile();
        } catch (e) {
          console.warn("Unable to refresh profile from canister:", e);
        }
        currentProfile = internetIdentityService.getCurrentUser() || user || {};
      }
      const username = currentProfile?.username ?? "";
      const email = currentProfile?.email ?? "";

      await authenticationService.ensureUserRegistered(
        principal,
        username,
        email
      );

      // Now load all users
      const users = await authenticationService.getAllUsers();
      setAllUsers(users);
    } catch (error) {
      console.error("Error loading users:", error);
    }
  }, [isAuthenticated, user]);

  // Load user tables from the backend
  const loadUserTables = useCallback(
    async (forceReload = false) => {
      console.log("loadUserTables called", {
        isAuthenticated,
        user,
        isLoadingTables,
        recentTablesLength: recentTables.length,
        hasAttemptedLoad,
        forceReload,
      });

      if (!isAuthenticated || !user) {
        console.log("Not authenticated or no user, skipping table load");
        setIsLoadingTables(false);
        return;
      }

      if (isLoadingTables && !forceReload) {
        console.log("Already loading tables, skipping (no force)");
        return;
      }

      // Prevent multiple simultaneous calls unless forcing reload
      if (!forceReload && recentTables.length > 0 && hasAttemptedLoad) {
        console.log(
          "Tables already loaded and attempt tracked, skipping (no force)"
        );
        return;
      }

      let timeoutId;
      try {
        setIsLoadingTables(true);
        console.log("Starting to load tables...");

        // Add a timeout to prevent infinite loading
        timeoutId = setTimeout(() => {
          console.log("Table loading timeout, setting loading to false");
          setIsLoadingTables(false);
        }, 10000); // 10 second timeout

        let identity = internetIdentityService.getIdentity();
        if (!identity) {
          console.warn(
            "No identity available yet; initializing Internet Identity..."
          );
          try {
            await internetIdentityService.initialize();
            identity = internetIdentityService.getIdentity();
          } catch (e) {
            console.error("Failed to initialize Internet Identity:", e);
          }
        }
        if (!identity) {
          console.error("No identity available after initialization");
          setIsLoadingTables(false);
          return;
        }

        console.log("Identity available, initializing services...");
        console.log("Identity principal:", identity.getPrincipal().toText());

        // Initialize both services with identity
        await tableManagementService.initialize(identity);
        await authenticationService.initialize(identity);

        console.log("Services initialized, ensuring user registration...");

        // Ensure current user is registered first
        const principal = identity.getPrincipal().toText();
        let currentProfile =
          internetIdentityService.getCurrentUser() || user || {};
        if (
          !currentProfile?.username ||
          currentProfile.username === "User" ||
          !currentProfile?.email ||
          currentProfile.email === "user@example.com"
        ) {
          try {
            await internetIdentityService.loadUserProfile();
          } catch (e) {
            console.warn("Unable to refresh profile from canister:", e);
          }
          currentProfile =
            internetIdentityService.getCurrentUser() || user || {};
        }
        const username = currentProfile?.username ?? "";
        const email = currentProfile?.email ?? "";

        console.log("Registering user:", { principal, username, email });

        const registrationResult =
          await authenticationService.ensureUserRegistered(
            principal,
            username,
            email
          );

        console.log("User registration result:", registrationResult);
        try {
          const res = await authenticationService.getUserByPrincipal(principal);
          if (res?.success && res.user) {
            setUserProfile(res.user);
          }
        } catch {
          console.error("Error fetching user profile:", error);
        }
        console.log("User registration completed, now fetching tables...");

        // Get user tables
        console.log("Calling getUserTables...");
        const userTables = await tableManagementService.getUserTables();
        console.log("User tables received:", userTables);

        // Merge created and joined, then de-duplicate by id and add timestamp
        const merged = [...userTables.created, ...userTables.joined];
        const dedupMap = new Map();
        for (const t of merged) {
          const key = t?.id?.toString ? t.id.toString() : String(t.id);
          // Prefer the first occurrence; ensure timestamp and lastUpdated exist
          if (!dedupMap.has(key)) {
            dedupMap.set(key, {
              ...t,
              timestamp: Date.now() - Math.random() * 14 * 24 * 60 * 60 * 1000,
              lastUpdated: "Recently",
            });
          }
        }
        const deduped = Array.from(dedupMap.values());
        console.log("Deduped tables:", deduped);

        // Sort by most recent first
        const sortedTables = deduped.sort((a, b) => b.timestamp - a.timestamp);

        setRecentTables(sortedTables);
        console.log(
          "Tables loaded successfully:",
          sortedTables.length,
          "tables"
        );
      } catch (error) {
        console.error("Error loading tables:", error);
        console.error("Error details:", {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });

        // Fallback to mock data if backend fails
        console.log("Falling back to mock data...");
        setRecentTables([
          {
            id: 1,
            title: "Seeker",
            description:
              "Seeker is a next-gen Web3 search engine that helps developers discover and integrate blockchain solutions.",
            lastUpdated: "4 days ago",
            timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000,
          },
          {
            id: 2,
            title: "Compass",
            description:
              "Compass is a navigation tool for decentralized applications and blockchain networks.",
            lastUpdated: "1 week ago",
            timestamp: Date.now() - 7 * 24 * 60 * 60 * 1000,
          },
          {
            id: 3,
            title: "Kongswap",
            description:
              "Kongswap is a decentralized exchange platform for token trading and liquidity provision.",
            lastUpdated: "2 weeks ago",
            timestamp: Date.now() - 14 * 24 * 60 * 60 * 1000,
          },
          {
            id: 4,
            title: "Dappstore",
            description:
              "Dappstore is a curated marketplace for decentralized applications and blockchain tools.",
            lastUpdated: "3 weeks ago",
            timestamp: Date.now() - 21 * 24 * 60 * 60 * 1000,
          },
          {
            id: 5,
            title: "Café",
            description:
              "Café is a collaborative workspace platform for teams to build and manage projects together.",
            lastUpdated: "1 month ago",
            timestamp: Date.now() - 30 * 24 * 60 * 60 * 1000,
          },
          {
            id: 6,
            title: "Blockchain Hub",
            description:
              "Blockchain Hub is a comprehensive platform for blockchain education and development resources.",
            lastUpdated: "1 month ago",
            timestamp: Date.now() - 32 * 24 * 60 * 60 * 1000,
          },
        ]);
      } finally {
        console.log("Setting isLoadingTables to false");
        clearTimeout(timeoutId);
        setIsLoadingTables(false);
      }
    },
    [isAuthenticated, user, isLoadingTables]
  );

  useEffect(() => {
    console.log("Dashboard useEffect triggered", { isAuthenticated, user });

    if (!isAuthenticated) {
      console.log("Not authenticated, navigating to auth");
      navigate("/auth");
      return;
    }

    // Get the actual user profile data
    const getActualUserProfile = async () => {
      try {
        let identity = internetIdentityService.getIdentity();
        if (!identity) {
          try {
            await internetIdentityService.initialize();
            identity = internetIdentityService.getIdentity();
          } catch {
            // ignore
          }
        }
        if (!identity) {
          setUserProfile(user || null);
          return;
        }
        await authenticationService.initialize(identity);
        const principal = identity.getPrincipal().toText();
        const res = await authenticationService.getUserByPrincipal(principal);
        if (res?.success && res.user) {
          setUserProfile(res.user);
          return;
        }
      } catch (e) {
        console.warn("Unable to load profile from canister:", e);
      }
      const fallback = internetIdentityService.getCurrentUser() || user || null;
      if (fallback) setUserProfile(fallback);
    };

    getActualUserProfile();

    // Always force reload tables when landing on dashboard after auth
    if (!isLoadingTables) {
      setHasAttemptedLoad(true);
      loadUserTables(true); // Force reload to get latest state
    }

    // Always reload users as well
    loadAllUsers();
  }, [isAuthenticated, navigate, user]);

  // Safety: force a reload shortly after mount when authenticated
  useEffect(() => {
    if (!isAuthenticated) return;
    const t = setTimeout(() => {
      console.log("Post-mount force reload tables");
      loadUserTables(true);
    }, 250);
    return () => clearTimeout(t);
  }, [isAuthenticated]);

  // Refresh tables when user returns to the dashboard tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && isAuthenticated && !isLoadingTables) {
        console.log("Dashboard tab became visible, refreshing tables");
        loadUserTables(true); // Force reload to get latest state
      }
    };

    const handleFocus = () => {
      if (isAuthenticated && !isLoadingTables) {
        console.log("Dashboard window focused, refreshing tables");
        loadUserTables(true); // Force reload to get latest state
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [isAuthenticated, isLoadingTables, loadUserTables]);

  // Reset loading state when user changes
  useEffect(() => {
    if (user && user.principal !== userProfile?.principal) {
      setHasAttemptedLoad(false);
      setRecentTables([]);
      setIsLoadingTables(false);
    }
  }, [user, userProfile]);

  // Filter users based on search input
  useEffect(() => {
    if (memberSearch.trim() === "") {
      setFilteredUsers([]);
      setShowUserDropdown(false);
      return;
    }

    const filtered = allUsers
      .filter((u) => {
        if (!u) return false;
        const searchLower = memberSearch.toLowerCase();
        const username = (u.username || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        const github = (u.github || "").toLowerCase();
        const principalText = (u.principal || "").toString().toLowerCase();
        return (
          username.includes(searchLower) ||
          email.includes(searchLower) ||
          (github && github.includes(searchLower)) ||
          principalText.includes(searchLower)
        );
      })
      .filter(
        (u) => (u?.principal || "").toString() !== userProfile?.principal
      );

    setFilteredUsers(filtered);
    setShowUserDropdown(filtered.length > 0);
  }, [memberSearch, allUsers, userProfile]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleCreateTable = () => {
    // Prevent opening modal if already open
    if (showCreateModal) {
      console.log("Modal already open, ignoring create table request");
      return;
    }
    console.log("Opening create table modal");
    setShowCreateModal(true);
    setModalSubmissionInProgress(false); // Reset submission state for new modal
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setFormData({
      name: "",
      description: "",
      members: [],
    });
    setMemberSearch("");
    setError("");
    setShowUserDropdown(false);
    setModalSubmissionInProgress(false); // Reset submission state
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling

    // Prevent duplicate submissions
    if (isSubmitting || modalSubmissionInProgress) {
      console.log(
        "Form submission already in progress or modal submission in progress, ignoring duplicate submit"
      );
      return;
    }

    // Set modal submission flag to prevent multiple submissions
    setModalSubmissionInProgress(true);

    // Generate unique submission ID to prevent race conditions
    const submissionId = Date.now() + Math.random();
    setCurrentSubmissionId(submissionId);
    console.log("Starting submission with ID:", submissionId);

    // Disable the form to prevent multiple submissions
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Creating...";
    }

    setIsSubmitting(true);
    setError("");

    try {
      console.log("Starting table creation process...");

      // Increment creation counter for rging
      setTableCreationCount((prev) => prev + 1);
      console.log("Table creation attempt #", tableCreationCount + 1);

      const identity = internetIdentityService.getIdentity();
      if (!identity) {
        throw new Error("No identity available");
      }

      console.log("Identity obtained, initializing services...");

      // Initialize services with identity
      await tableManagementService.initialize(identity);
      await authenticationService.initialize(identity);

      console.log("Services initialized, ensuring user registration...");

      // Ensure current user is registered first
      const principal = identity.getPrincipal().toText();
      let currentProfile =
        internetIdentityService.getCurrentUser() || user || {};
      if (
        !currentProfile?.username ||
        currentProfile.username === "User" ||
        !currentProfile?.email ||
        currentProfile.email === "user@example.com"
      ) {
        try {
          await internetIdentityService.loadUserProfile();
        } catch (e) {
          console.warn("Unable to refresh profile from canister:", e);
        }
        currentProfile = internetIdentityService.getCurrentUser() || user || {};
      }
      const username = currentProfile?.username ?? "";
      const email = currentProfile?.email ?? "";

      await authenticationService.ensureUserRegistered(
        principal,
        username,
        email
      );

      try {
        const res = await authenticationService.getUserByPrincipal(principal);
        if (res?.success && res.user) {
          setUserProfile(res.user);
        }
      } catch (error) {
        console.error("Error fetching user profile:", error);
      }

      console.log("User registration ensured, creating table...");

      // Create the table using the backend service
      const newTable = await tableManagementService.createTable(
        formData.name,
        formData.description
      );

      console.log("Table created successfully:", newTable);

      // Handle member invitations after table creation
      if (formData.members.length > 0) {
        console.log("Processing member invitations...");
        for (const member of formData.members) {
          try {
            await tableManagementService.requestJoinTable(
              member.principal,
              newTable.id
            );
            console.log(`Invited ${member.username} to table ${newTable.id}`);
          } catch (inviteError) {
            console.error(`Failed to invite ${member.username}:`, inviteError);
          }
        }
      }

      console.log("Reloading user tables...");

      // Close modal immediately for better UX (unconditional after success)
      handleCloseModal();

      // Refresh tables in background
      setHasAttemptedLoad(false);
      setRecentTables((prev) => prev); // keep current list while refreshing
      // Debounced reload
      setTimeout(() => {
        loadUserTables();
      }, 100);

      console.log("Table creation process completed successfully");
    } catch (err) {
      console.error("Table creation failed:", err);
      setError(err.message || "Failed to create table");
    } finally {
      // Re-enable the submit button
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = "Create Table";
      }
      setIsSubmitting(false);
    }
  };

  const handleAddMember = (selectedUser) => {
    // Check if user is already added
    const isAlreadyAdded = formData.members.some(
      (member) =>
        member.principal.toString() === selectedUser.principal.toString()
    );

    if (!isAlreadyAdded) {
      setFormData((prev) => ({
        ...prev,
        members: [...prev.members, selectedUser],
      }));
    }

    setMemberSearch("");
    setShowUserDropdown(false);
  };

  const handleRemoveMember = (index) => {
    setFormData((prev) => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== index),
    }));
  };

  const handleTableClick = (table) => {
    setSelectedTable(table);
    setShowInvitations(false);
  };

  const handleInvitationUpdate = () => {
    // Refresh tables when invitations are updated
    loadUserTables(true);
  };

  const handleLeaveTable = () => {
    setSelectedTable(null);
    loadUserTables();
  };

  const handleBackToTables = () => {
    setSelectedTable(null);
    setShowInvitations(false);
    // Force reload tables when returning to main view to ensure latest state
    loadUserTables(true);
  };

  const handleImportFromGithub = () => {
    // TODO: Implement GitHub import
    console.log("Import from GitHub");
  };

  if (!isAuthenticated) {
    return null;
  }

  // Use userProfile if available, otherwise fall back to user
  const displayUser = userProfile || user;
  // Principal-based fallback for display when profile hasn't loaded
  const identityPrincipal = (() => {
    try {
      const id = internetIdentityService.getIdentity();
      return id ? id.getPrincipal().toText() : "";
    } catch {
      return "";
    }
  })();
  const principalShort = identityPrincipal
    ? `${identityPrincipal.slice(0, 5)}...${identityPrincipal.slice(-5)}`
    : "";

  return (
    <div className={styles["dashboard-page"]}>
      <div className={styles["dashboard-content"]}>
        {/* Left Sidebar - Logo, Pinned, Profile */}
        <aside
          className={`${styles["dashboard-sidebar"]} ${styles["left-sidebar"]}`}
        >
          <div className={styles["sidebar-logo"]}>
            <div className={styles["cafe-logo"]}>
              <div className={styles["logo-icon"]}>
                <img
                  className={styles["logo-icon-image"]}
                  src={cafeLogo}
                  alt="Café Logo"
                />
              </div>
              <span className={styles["logo-text"]}>Café</span>
            </div>
          </div>

          <div className={styles["sidebar-divider"]}></div>

          <div className={styles["pinned-section"]}>
            <div className={styles["pinned-header"]}>
              <span className={styles["pinned-icon"]}>📌</span>
              <span>Pinned</span>
            </div>
            <ul className={styles["pinned-list"]}>
              <li>Kongswap</li>
              <li>Compass</li>
              <li>Dappstore</li>
              <li>Café</li>
            </ul>
          </div>

          <div className={styles["user-profile"]}>
            <div>
              <div className={styles["user-avatar"]}>
                {displayUser?.username?.charAt(0)?.toUpperCase() ||
                  principalShort?.charAt(0)?.toUpperCase() ||
                  ""}
              </div>
              <div className={styles["user-info"]}>
                <div className={styles["username"]}>
                  {displayUser?.username || principalShort}
                </div>
                <div className={styles["user-email"]}>
                  {displayUser?.email || ""}
                </div>
              </div>
            </div>
            <button
              className={styles["signout-button"]}
              onClick={handleSignOut}
            >
              <span>Sign Out</span>
            </button>
          </div>
        </aside>

        {/* Center Column */}
        <div className={styles["dashboard-center"]}>
          {/* Content Header (local) */}
          <div className={styles["content-header"]}>
            <button className={styles["home-button"]}>
              <div className="home-icon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M9.91406 2.61938C11.0683 1.68929 12.918 1.69418 14.0879 2.63013L21.0156 8.16821V8.16919C21.422 8.49681 21.7718 9.01121 21.9951 9.59888C22.2184 10.1865 22.299 10.8046 22.2158 11.3206L20.8867 19.2766C20.6273 20.8069 19.1448 22.0598 17.5996 22.0598H6.39941C4.82322 22.0596 3.37295 20.8356 3.11328 19.2776L1.7832 11.3176V11.3167L1.75781 11.1194C1.71748 10.6486 1.80199 10.1122 1.99707 9.59888C2.21992 9.01252 2.57088 8.49887 2.98145 8.17114L2.98242 8.17017L9.91211 2.62036L9.91406 2.61938ZM11.9902 2.4397C11.3676 2.4397 10.7217 2.62677 10.2285 3.0188L10.2275 3.01978L3.29688 8.56958L3.2959 8.57056C2.92298 8.87151 2.63899 9.32598 2.46387 9.78442C2.31076 10.1853 2.22195 10.6391 2.25488 11.0627L2.27637 11.2424L3.60645 19.2024L3.60742 19.2043C3.82841 20.4934 5.0852 21.5596 6.39941 21.5598H17.5996C18.9151 21.5598 20.172 20.4924 20.3926 19.1936V19.1926L21.7227 11.2327C21.8017 10.7585 21.7071 10.2278 21.5312 9.76978C21.3555 9.31201 21.0723 8.85753 20.7031 8.56079L20.7021 8.55981L13.7725 3.01978L13.7666 3.01489L13.5723 2.87915C13.1052 2.58331 12.5441 2.43976 11.9902 2.4397Z"
                    fill="#E1760C"
                    stroke="white"
                  />
                  <path
                    d="M12 10.25C13.5139 10.25 14.75 11.4861 14.75 13C14.75 14.5139 13.5139 15.75 12 15.75C10.4861 15.75 9.25 14.5139 9.25 13C9.25 11.4861 10.4861 10.25 12 10.25ZM12 10.75C10.7639 10.75 9.75 11.7639 9.75 13C9.75 14.2361 10.7639 15.25 12 15.25C13.2361 15.25 14.25 14.2361 14.25 13C14.25 11.7639 13.2361 10.75 12 10.75Z"
                    fill="#E1760C"
                    stroke="white"
                  />
                </svg>
              </div>
              <span>Home</span>
            </button>
            <div className={styles["search-container"]}>
              <div className={styles["search-icon"]}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M11 19C15.4183 19 19 15.4183 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11C3 15.4183 6.58172 19 11 19Z"
                    stroke="#86868b"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M21 21L16.65 16.65"
                    stroke="#86868b"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search anything here"
                className={styles["search-input"]}
              />
            </div>
          </div>

          {/* Content Body: Workspace + Notifications */}
          <div className={styles["content-body"]}>
            <main className={styles["workspace"]}>
              {/* Navigation Header */}
              <div className={styles["workspace-header"]}>
                <div className={styles["workspace-nav"]}>
                  <button
                    className={`${styles["nav-button"]} ${
                      !selectedTable && !showInvitations ? styles["active"] : ""
                    }`}
                    onClick={handleBackToTables}
                  >
                    Tables
                  </button>
                  <button
                    className={`${styles["nav-button"]} ${
                      showInvitations ? styles["active"] : ""
                    }`}
                    onClick={() => {
                      setShowInvitations(true);
                      setSelectedTable(null);
                    }}
                  >
                    Invitations
                  </button>
                </div>
                {/* Removed duplicate create table button to prevent multiple table creation */}
              </div>

              {/* Main Content Area */}
              <div className={styles["workspace-content"]}>
                {showInvitations ? (
                  <TableInvitations
                    onInvitationUpdate={handleInvitationUpdate}
                  />
                ) : selectedTable ? (
                  <TableDetails
                    table={selectedTable}
                    onTableUpdate={handleInvitationUpdate}
                    onLeaveTable={handleLeaveTable}
                  />
                ) : (
                  <>
                    {/* Welcome Section */}
                    <section className={styles["pull-up-section"]}>
                      <h2 className={styles["section-title"]}>
                        Pull up a Table
                      </h2>
                      <div className={styles["action-cards"]}>
                        <button
                          className={`${styles["action-card"]} ${styles["create-card"]}`}
                          onClick={handleCreateTable}
                        >
                          <div className={styles["card-icon"]}>
                            <svg
                              width="42"
                              height="42"
                              viewBox="0 0 42 42"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M37.4062 21C37.4062 21.5221 37.1988 22.0229 36.8296 22.3921C36.4604 22.7613 35.9596 22.9688 35.4375 22.9688H22.9688V35.4375C22.9688 35.9596 22.7613 36.4604 22.3921 36.8296C22.0229 37.1988 21.5221 37.4062 21 37.4062C20.4779 37.4062 19.9771 37.1988 19.6079 36.8296C19.2387 36.4604 19.0312 35.9596 19.0312 35.4375V22.9688H6.5625C6.04036 22.9688 5.5396 22.7613 5.17038 22.3921C4.80117 22.0229 4.59375 21.5221 4.59375 21C4.59375 20.4779 4.80117 19.9771 5.17038 19.6079C5.5396 19.2387 6.04036 19.0312 6.5625 19.0312H19.0312V6.5625C19.0312 6.04036 19.2387 5.5396 19.6079 5.17038C19.9771 4.80117 20.4779 4.59375 21 4.59375C21.5221 4.59375 22.0229 4.80117 22.3921 5.17038C22.7613 5.5396 22.9688 6.04036 22.9688 6.5625V19.0312H35.4375C35.9596 19.0312 36.4604 19.2387 36.8296 19.6079C37.1988 19.9771 37.4062 20.4779 37.4062 21Z"
                                fill="black"
                              />
                            </svg>
                          </div>
                          <span className={styles["card-text"]}>
                            Create New Table
                          </span>
                        </button>

                        <button
                          className={`${styles["action-card"]} ${styles["import-card"]}`}
                          onClick={handleImportFromGithub}
                        >
                          <div className={styles["card-icon"]}>
                            <svg
                              width="43"
                              height="46"
                              viewBox="0 0 43 46"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <path
                                d="M29.0834 44V37.9811C29.1647 36.981 29.0251 35.9757 28.6739 35.032C28.3228 34.0882 27.7681 33.2276 27.0467 32.5074C33.85 31.7734 41 29.2777 41 17.8271C40.9994 14.899 39.8358 12.0833 37.75 9.9626C38.7377 7.40089 38.6679 4.56936 37.555 2.05619C37.555 2.05619 34.9984 1.32217 29.0834 5.16003C24.1171 3.85932 18.883 3.85932 13.9168 5.16003C8.00181 1.32217 5.44515 2.05619 5.44515 2.05619C4.33231 4.56936 4.26247 7.40089 5.25015 9.9626C3.14877 12.099 1.98397 14.9402 2.00017 17.89C2.00017 29.2567 9.15013 31.7524 15.9534 32.5703C15.2406 33.2833 14.6909 34.1336 14.3399 35.0658C13.989 35.998 13.8449 36.9913 13.9168 37.9811V44"
                                stroke="#263238"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                          <span className={styles["card-text"]}>
                            Import from Github
                          </span>
                        </button>
                      </div>
                    </section>

                    {/* Tables Section */}
                    <section className={styles["recent-tables-section"]}>
                      <div className={styles["section-header"]}>
                        <h2 className={styles["section-title"]}>Your Tables</h2>
                        <button
                          onClick={() => loadUserTables(true)}
                          disabled={isLoadingTables}
                          className={styles["refresh-btn"]}
                          title="Refresh tables to get latest state"
                        >
                          {isLoadingTables ? (
                            <svg
                              className={styles["loading-spinner"]}
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
                      <div className={styles["tables-grid"]}>
                        {isLoadingTables ? (
                          <div style={{ padding: "20px", textAlign: "center" }}>
                            <p>Loading tables...</p>
                            <small>
                              Please wait while we fetch your tables
                            </small>
                          </div>
                        ) : recentTables.length === 0 ? (
                          <div style={{ padding: "20px", textAlign: "center" }}>
                            <p>No tables found. Create a new one!</p>
                            <small>
                              Get started by creating your first collaborative
                              workspace
                            </small>
                          </div>
                        ) : (
                          recentTables.map((table) => (
                            <div
                              key={table.id}
                              className={styles["table-card"]}
                              onClick={() => handleTableClick(table)}
                            >
                              <div className={styles["table-content"]}>
                                <p className={styles["table-description"]}>
                                  {table.description}
                                </p>
                              </div>
                              <div className={styles["table-footer"]}>
                                <span className={styles["table-title"]}>
                                  {table.title}
                                </span>
                                <div className={styles["table-meta"]}>
                                  <span
                                    className={styles["table-collaborators"]}
                                  >
                                    {table.tableCollaborators?.length || 0}{" "}
                                    collaborators
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </section>
                  </>
                )}
              </div>
            </main>

            <aside className={styles["notifications-panel"]}>
              <div className={styles["notifications-header"]}>
                <div className={styles["notifications-icon"]}>
                  <span>🔔</span>
                  <span className={styles["notification-badge"]}>
                    {notifications.length}
                  </span>
                </div>
                <span>Notifications</span>
              </div>

              <div className={styles["notifications-list"]}>
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={styles["notification-item"]}
                  >
                    <div className={styles["notification-avatar"]}>
                      {notification.avatar}
                    </div>
                    <div className={styles["notification-content"]}>
                      <span className={styles["notification-user"]}>
                        {notification.user}
                      </span>
                      <span className={styles["notification-message"]}>
                        {" "}
                        {notification.message}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* Create Table Modal */}
      {showCreateModal && (
        <div className={styles["modal-overlay"]} onClick={handleCloseModal}>
          <div className={styles["modal"]} onClick={(e) => e.stopPropagation()}>
            <div className={styles["modal-header"]}>
              <h2 className={styles["modal-title"]}>Create New Table</h2>
              <button
                className={styles["modal-close"]}
                onClick={handleCloseModal}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18M6 6L18 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>

            <form
              className={styles["modal-form"]}
              onSubmit={(e) => {
                console.log(
                  "Form onSubmit event triggered",
                  new Date().toISOString()
                );
                handleFormSubmit(e);
              }}
            >
              {/* Name */}
              <div className={styles["form-group"]}>
                <label className={styles["form-label"]}>Table Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className={styles["form-input"]}
                  placeholder="Enter table name"
                  required
                  disabled={isSubmitting}
                />
              </div>

              {/* Description */}
              <div className={styles["form-group"]}>
                <label className={styles["form-label"]}>Description *</label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                  className={styles["form-textarea"]}
                  placeholder="Describe your table"
                  rows="3"
                  required
                  disabled={isSubmitting}
                />
              </div>

              {/* Invite Members */}
              <div className={styles["form-group"]}>
                <label className={styles["form-label"]}>
                  Invite Members (Optional)
                </label>
                <div className={styles["member-search"]}>
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className={styles["form-input"]}
                    placeholder="Search by username, email, GitHub, or Principal ID"
                    disabled={isSubmitting}
                  />
                  {showUserDropdown && (
                    <div className={styles["user-dropdown"]}>
                      {filteredUsers.map((user) => (
                        <div
                          key={user.principal}
                          className={styles["user-option"]}
                          onClick={() => handleAddMember(user)}
                        >
                          <span className={styles["user-option-name"]}>
                            {user.username}
                          </span>
                          <span className={styles["user-option-email"]}>
                            {user.email}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {formData.members.length > 0 && (
                  <div className={styles["members-list"]}>
                    {formData.members.map((member, index) => (
                      <div
                        key={member.principal}
                        className={styles["member-tag"]}
                      >
                        <span>{member.username}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(index)}
                          className={styles["remove-member"]}
                          disabled={isSubmitting}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className={styles["form-help"]}>
                  Members will be invited after the table is created.
                </div>
              </div>

              {/* Error Display */}
              {error && <div className={styles["error-message"]}>{error}</div>}

              {/* Form Actions */}
              <div className={styles["form-actions"]}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className={styles["cancel-btn"]}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles["create-btn"]}
                  disabled={
                    isSubmitting ||
                    !formData.name.trim() ||
                    !formData.description.trim()
                  }
                >
                  {isSubmitting ? "Creating..." : "Create Table"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
