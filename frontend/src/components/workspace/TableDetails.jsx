import React, { useState, useEffect } from "react";
import { tableManagementService } from "../../services/tableManagement";
import { authenticationService } from "../../services/authentication";
import internetIdentityService from "../../services/internetIdentity";
import "./TableDetails.css";

const TableDetails = ({ table, onLeaveTable }) => {
  const [collaborators, setCollaborators] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  // New state for invitations
  const [allUsers, setAllUsers] = useState([]);
  const [inviteSearch, setInviteSearch] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [pendingSent, setPendingSent] = useState([]); // usernames
  const [sendingTo, setSendingTo] = useState(""); // principal currently being invited

  useEffect(() => {
    if (table) {
      loadTableDetails();
    }
  }, [table]);

  const loadTableDetails = async () => {
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
      const collaboratorsResult =
        await tableManagementService.getTableCollaborators(table.id);
      setCollaborators(collaboratorsResult);

      // Load all users for invite search (only once per table load)
      const users = await authenticationService.getAllUsers();
      setAllUsers(users);

      // Load pending sent invites for this table (as usernames)
      const pending = await tableManagementService.getPendingSentRequests(
        table.id
      );
      setPendingSent(pending);
    } catch (error) {
      console.error("Error loading table details:", error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLeaveTable = async () => {
    if (!window.confirm("Are you sure you want to leave this table?")) {
      return;
    }

    try {
      await tableManagementService.leaveTable(table.id);
      if (onLeaveTable) {
        onLeaveTable();
      }
    } catch (error) {
      console.error("Error leaving table:", error);
      setError(error.message);
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
      await tableManagementService.deleteTable(table.id);
      if (onLeaveTable) {
        onLeaveTable();
      }
    } catch (error) {
      console.error("Error deleting table:", error);
      setError(error.message);
    }
  };

  const isCreator = currentUser && table.creator === currentUser.principal;

  const filteredInvitees = inviteSearch.trim()
    ? allUsers
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
    } catch (e) {
      setError(e?.message || "Failed to send invitation");
    } finally {
      setInviteLoading(false);
      setSendingTo("");
    }
  };

  if (isLoading) {
    return (
      <div className="table-details">
        <div className="loading">Loading table details...</div>
      </div>
    );
  }

  return (
    <div className="table-details">
      {/* Redesigned layout: Profile & Account style */}
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
              <div className="pa-name-value">{table?.title || "Untitled"}</div>
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
        <div className="pa-bottom-spacer"></div>
        <nav
          className="pa-bottom-bar"
          role="tablist"
          aria-label="Table sections"
        >
          <button className="pa-pill pa-active" role="tab" aria-selected="true">
            Table
          </button>
          <button className="pa-pill" role="tab" aria-selected="false">
            Resources
          </button>
          <button className="pa-pill" role="tab" aria-selected="false">
            Code
          </button>
          <button className="pa-pill" role="tab" aria-selected="false">
            Collab
          </button>
          <button className="pa-pill" role="tab" aria-selected="false">
            Settings
          </button>
        </nav>
      </div>

      <div className="table-header">
        <h2>{table.title}</h2>
        <div className="table-actions">
          {isCreator ? (
            <button onClick={handleDeleteTable} className="delete-btn">
              Delete Table
            </button>
          ) : (
            <button onClick={handleLeaveTable} className="leave-btn">
              Leave Table
            </button>
          )}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="table-description">
        <p>{table.description}</p>
      </div>

      <div className="table-info">
        <div className="info-item">
          <span className="info-label">Table ID:</span>
          <span className="info-value">{table.id}</span>
        </div>
        <div className="info-item">
          <span className="info-label">Created by:</span>
          <span className="info-value">
            {collaborators.find((c) => c.principal === table.creator)
              ?.username || "Unknown"}
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
            <div key={collaborator.principal} className="collaborator-item">
              <div className="collaborator-avatar">
                {collaborator.username.charAt(0).toUpperCase()}
              </div>
              <div className="collaborator-info">
                <div className="collaborator-name">{collaborator.username}</div>
                <div className="collaborator-email">{collaborator.email}</div>
                {collaborator.principal === table.creator && (
                  <div className="creator-badge">Creator</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {isCreator && (
        <div className="invite-section">
          <h3>Invite collaborators</h3>

          <div className="invite-input-row">
            <input
              type="text"
              value={inviteSearch}
              onChange={(e) => setInviteSearch(e.target.value)}
              placeholder="Search by username, email, GitHub, or Principal ID"
              className="invite-input"
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
      )}
    </div>
  );
};

export default TableDetails;
