import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
// import { backendIntegrationService } from "../services/backendIntegration";
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
    image: null,
    members: [],
    githubRepo: "",
  });
  const [memberSearch, setMemberSearch] = useState("");

  const [recentTables] = useState([
    {
      id: 1,
      title: "Seeker",
      description:
        "Seeker is a next-gen Web3 search engine that helps developers discover and integrate blockchain solutions.",
      lastUpdated: "4 days ago",
    },
    {
      id: 2,
      title: "Compass",
      description:
        "Compass is a navigation tool for decentralized applications and blockchain networks.",
      lastUpdated: "1 week ago",
    },
    {
      id: 3,
      title: "Kongswap",
      description:
        "Kongswap is a decentralized exchange platform for token trading and liquidity provision.",
      lastUpdated: "2 weeks ago",
    },
    {
      id: 4,
      title: "Dappstore",
      description:
        "Dappstore is a curated marketplace for decentralized applications and blockchain tools.",
      lastUpdated: "3 weeks ago",
    },
    {
      id: 5,
      title: "Café",
      description:
        "Café is a collaborative workspace platform for teams to build and manage projects together.",
      lastUpdated: "1 month ago",
    },
    {
      id: 6,
      title: "Blockchain Hub",
      description:
        "Blockchain Hub is a comprehensive platform for blockchain education and development resources.",
      lastUpdated: "1 month ago",
    },
  ]);

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

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/auth");
      return;
    }

    // Get the actual user profile data
    const getActualUserProfile = () => {
      if (user) {
        // Check if user has real profile data (not placeholder)
        if (user.username && user.username !== "Returning User") {
          setUserProfile(user);
        } else {
          // Try to get profile from localStorage if available
          try {
            const storedProfile = localStorage.getItem("cafe_user_profile");
            if (storedProfile) {
              const parsedProfile = JSON.parse(storedProfile);
              setUserProfile(parsedProfile);
            } else {
              setUserProfile(user);
            }
          } catch {
            console.log("No stored profile found, using auth user");
            setUserProfile(user);
          }
        }
      }
    };

    getActualUserProfile();
  }, [isAuthenticated, navigate, user]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleCreateTable = () => {
    setShowCreateModal(true);
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setFormData({
      name: "",
      description: "",
      image: null,
      members: [],
      githubRepo: "",
    });
    setMemberSearch("");
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    console.log("Creating table with data:", formData);
    // TODO: Implement table creation logic
    handleCloseModal();
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({ ...prev, image: file }));
    }
  };

  const handleAddMember = () => {
    if (memberSearch.trim()) {
      setFormData((prev) => ({
        ...prev,
        members: [...prev.members, memberSearch.trim()],
      }));
      setMemberSearch("");
    }
  };

  const handleRemoveMember = (index) => {
    setFormData((prev) => ({
      ...prev,
      members: prev.members.filter((_, i) => i !== index),
    }));
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
                {displayUser?.username?.charAt(0)?.toUpperCase() || "U"}
              </div>
              <div className={styles["user-info"]}>
                <div className={styles["username"]}>
                  {displayUser?.username || "User"}
                </div>
                <div className={styles["user-email"]}>
                  {displayUser?.email || "user@example.com"}
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
              <section className={styles["pull-up-section"]}>
                <h2 className={styles["section-title"]}>Pull up a Table</h2>
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

              <section className={styles["recent-tables-section"]}>
                <h2 className={styles["section-title"]}>Recent Tables</h2>
                <div className={styles["tables-grid"]}>
                  {recentTables.map((table) => (
                    <div key={table.id} className={styles["table-card"]}>
                      <div className={styles["table-content"]}>
                        <p className={styles["table-description"]}>
                          {table.description}
                        </p>
                      </div>
                      <div className={styles["table-footer"]}>
                        <span className={styles["table-title"]}>
                          {table.title}
                        </span>
                        <button className={styles["table-options"]}>
                          <span>⋯</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className={styles["last-updated"]}>4 days ago</div>
              </section>
            </main>

            <aside className={styles["notifications-panel"]}>
              <div className={styles["notifications-header"]}>
                <div className={styles["notifications-icon"]}>
                  <span>🔔</span>
                  <span className={styles["notification-badge"]}>0</span>
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

            <form className={styles["modal-form"]} onSubmit={handleFormSubmit}>
              {/* Image Upload */}
              <div className={styles["form-group"]}>
                <label className={styles["form-label"]}>Table Image</label>
                <div className={styles["image-upload"]}>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className={styles["file-input"]}
                    id="table-image"
                  />
                  <label
                    htmlFor="table-image"
                    className={styles["upload-label"]}
                  >
                    {formData.image ? (
                      <img
                        src={URL.createObjectURL(formData.image)}
                        alt="Preview"
                        className={styles["image-preview"]}
                      />
                    ) : (
                      <div className={styles["upload-placeholder"]}>
                        <svg
                          width="32"
                          height="32"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <path
                            d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19ZM8.5 13.5L11 16.51L14.5 12L19 18H5L8.5 13.5Z"
                            fill="currentColor"
                          />
                        </svg>
                        <span>Click to upload image</span>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Name */}
              <div className={styles["form-group"]}>
                <label className={styles["form-label"]}>Table Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className={styles["form-input"]}
                  placeholder="Enter table name"
                  required
                />
              </div>

              {/* Description */}
              <div className={styles["form-group"]}>
                <label className={styles["form-label"]}>Description</label>
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
                />
              </div>

              {/* Invite Members */}
              <div className={styles["form-group"]}>
                <label className={styles["form-label"]}>Invite Members</label>
                <div className={styles["member-search"]}>
                  <input
                    type="text"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    className={styles["form-input"]}
                    placeholder="Search by GitHub username or Principal ID"
                  />
                  <button
                    type="button"
                    onClick={handleAddMember}
                    className={styles["add-member-btn"]}
                  >
                    Add
                  </button>
                </div>
                {formData.members.length > 0 && (
                  <div className={styles["members-list"]}>
                    {formData.members.map((member, index) => (
                      <div key={index} className={styles["member-tag"]}>
                        <span>{member}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(index)}
                          className={styles["remove-member"]}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* GitHub Import */}
              <div className={styles["form-group"]}>
                <label className={styles["form-label"]}>
                  Import from GitHub (Optional)
                </label>
                <div className={styles["github-import"]}>
                  <input
                    type="text"
                    value={formData.githubRepo}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        githubRepo: e.target.value,
                      }))
                    }
                    className={styles["form-input"]}
                    placeholder="owner/repository"
                  />
                  <button
                    type="button"
                    onClick={handleImportFromGithub}
                    className={styles["github-btn"]}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M12 2L2 7L12 12L22 7L12 2Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M2 17L12 22L22 17"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M2 12L12 17L22 12"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Import
                  </button>
                </div>
              </div>

              {/* Form Actions */}
              <div className={styles["form-actions"]}>
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className={styles["cancel-btn"]}
                >
                  Cancel
                </button>
                <button type="submit" className={styles["create-btn"]}>
                  Create Table
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
