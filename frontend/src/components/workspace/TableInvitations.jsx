import React, { useState, useEffect } from "react";
import { tableManagementService } from "../../services/tableManagement";
import { authenticationService } from "../../services/authentication";
import internetIdentityService from "../../services/internetIdentity";
import "./TableInvitations.css";

const TableInvitations = ({ onInvitationUpdate }) => {
  const [pendingReceived, setPendingReceived] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [pendingSent, setPendingSent] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadInvitations();
  }, []);

  const loadInvitations = async () => {
    try {
      setIsLoading(true);
      const identity = internetIdentityService.getIdentity();
      if (!identity) {
        throw new Error("No identity available");
      }

      await tableManagementService.initialize(identity);
      await authenticationService.initialize(identity);

      // Load pending received requests
      const receivedRequests =
        await tableManagementService.getPendingReceivedRequests();

      // Load all tables to get table details for received requests
      const allTables = await tableManagementService.getAllTables();

      const receivedWithDetails = receivedRequests.map((tableId) => {
        const table = allTables.find((t) => t.id === tableId);
        return {
          tableId,
          table: table || {
            title: `Table ${tableId}`,
            description: "Table not found",
          },
        };
      });

      setPendingReceived(receivedWithDetails);
      setPendingSent([]); // For now, we'll load sent requests when needed
    } catch (error) {
      console.error("Error loading invitations:", error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptInvitation = async (tableId) => {
    try {
      await tableManagementService.acceptJoinTable(tableId);
      await loadInvitations();
      if (onInvitationUpdate) {
        onInvitationUpdate();
      }
    } catch (error) {
      console.error("Error accepting invitation:", error);
      setError(error.message);
    }
  };

  const handleRejectInvitation = async (tableId) => {
    try {
      await tableManagementService.rejectJoinTable(tableId);
      await loadInvitations();
    } catch (error) {
      console.error("Error rejecting invitation:", error);
      setError(error.message);
    }
  };

  if (isLoading) {
    return (
      <div className="table-invitations">
        <div className="invitations-header">
          <h3>Table Invitations</h3>
        </div>
        <div className="loading">Loading invitations...</div>
      </div>
    );
  }

  return (
    <div className="table-invitations">
      <div className="invitations-header">
        <h3>Table Invitations</h3>
        <button
          onClick={loadInvitations}
          className="refresh-btn"
          title="Refresh invitations"
        >
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
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}

      {pendingReceived.length === 0 ? (
        <div className="no-invitations">
          <p>No pending invitations</p>
        </div>
      ) : (
        <div className="invitations-list">
          {pendingReceived.map(({ tableId, table }) => (
            <div key={tableId} className="invitation-item">
              <div className="invitation-content">
                <h4>{table.title}</h4>
                <p>{table.description}</p>
                <small>Table ID: {tableId}</small>
              </div>
              <div className="invitation-actions">
                <button
                  onClick={() => handleAcceptInvitation(tableId)}
                  className="accept-btn"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleRejectInvitation(tableId)}
                  className="reject-btn"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TableInvitations;
