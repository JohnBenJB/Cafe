import Time "mo:base/Time";
import Principal "mo:base/Principal";
import Nat "mo:base/Nat";
import Nat32 "mo:base/Nat32";
import Text "mo:base/Text";
import Blob "mo:base/Blob";
import Bool "mo:base/Bool";
import Option "mo:base/Option";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import HashMap "mo:base/HashMap";
import Iter "mo:base/Iter";
import Error "mo:base/Error";
import Debug "mo:base/Debug";
import Result "mo:base/Result";

module {
  // ===== CORE TYPES =====

  // Unique identifiers
  public type FileId = Nat32;
  public type Version = Nat;
  public type ClientId = Text;
  public type Seq = Nat;
  public type ChunkIndex = Nat;
  public type ClientOpId = Text; // Format: "clientId:clientSeq"
  public type Result<T, E> = Result.Result<T, E>;

  // User roles for access control
  public type Role = {
    #Owner;
    #Editor;
    #Viewer;
  };

  // ===== FILE CONTENT TYPES =====

  // Individual chunk of file content (max ~1MB per chunk)
  public type ContentChunk = {
    index : ChunkIndex;
    data : Blob;
    size : Nat; // Size of this chunk in bytes
  };

  // File metadata
  public type FileMeta = {
    id : FileId;
    tableId : Nat;
    var name : Text;
    var mime : Text;
    var size : Nat;            // Total file size in bytes
    var chunkCount : Nat;      // Number of chunks
    headVersion : Version; // Current version head
    createdAt : Time.Time;
    var updatedAt : Time.Time;
    owner : Principal;
    var isDeleted : Bool;      // Soft delete flag
  };

  // Access control information
  public type Access = {
    owner : Principal;
    var sharedWith : [(Principal, Role)];
    var isPublic : Bool;       // Public read access
  };

  // ===== EDITING OPERATIONS =====

  // Text editing operations (for live collaborative editing)
  public type EditOp = {
    #Insert : { pos : Nat; text : Text };
    #Delete : { pos : Nat; len : Nat };
    #Replace : { pos : Nat; len : Nat; text : Text };
  };

  // Patch containing multiple operations
  public type Patch = {
    base : Version;          // Client's base version
    ops : [EditOp];
    clientId : ClientId;
    clientOpId : ClientOpId; // For idempotency
    timestamp : Time.Time;
  };

  // Committed version with metadata
  public type Commit = {
    version : Version;
    parent : Version;
    patch : Patch;
    author : Principal;
    message : ?Text;
    time : Time.Time;
    size : Nat;             // File size after this commit
    chunkCount : Nat;       // Chunk count after this commit
  };

  // ===== COLLABORATION TYPES =====

  // User cursor/selection information
  public type Cursor = {
    clientId : ClientId;
    pos : Nat;
    selection : ?{ from : Nat; to : Nat };
    color : Text;           // Hex color for UI
    lastSeen : Time.Time;
  };

  // Presence events for user join/leave
  public type PresenceEvent = {
    #Join : { clientId : ClientId; user : Principal };
    #Leave : { clientId : ClientId };
    #Heartbeat : { clientId : ClientId };
  };

  // Event types for real-time updates
  public type Event = {
    seq : Seq;
    fileId : FileId;
    kind : {
      #PatchApplied : Commit;
      #CursorUpdate : Cursor;
      #Presence : PresenceEvent;
      #Snapshot : Version;
      #FileDeleted : { by : Principal };
      #FileRestored : { by : Principal };
    };
    time : Time.Time;
  };

  // Client subscription information
  public type Subscription = {
    clientId : ClientId;
    since : Seq;            // Last seen sequence number
    lastPolled : Time.Time;
    user : Principal;
  };

  // ===== AUTOSAVE TYPES =====

  // Autosave configuration
  public type AutosavePolicy = {
    intervalNanos : Nat;   // Autosave interval (e.g., 30 seconds)
    idleNanos : Nat;       // Minimum idle time before autosave
    enabled : Bool;
    maxVersions : Nat;       // Maximum versions to keep
  };

  // ===== UTILITY TYPES =====

  // Paginated results
  public type Paginated<T> = {
    items : [T];
    next : ?Nat;            // Offset for next page
    total : Nat;            // Total count
  };

  // Error types
  public type Error = {
    #NotFound;
    #AccessDenied;
    #InvalidOperation;
    #Conflict;              // Version conflict
    #DuplicateOperation;    // Duplicate clientOpId
    #FileTooLarge;
    #InvalidChunk;
    #QuotaExceeded;
    #InternalError;
  };

  // // Result types
  // public type Result<T, E> = {
  //   #ok : T;
  //   #err : E;
  // };

  // ===== CONSTANTS =====

  public let MAX_CHUNK_SIZE : Nat = 1_000_000; // 1MB per chunk
  public let MAX_FILE_SIZE : Nat = 100_000_000; // 100MB total
  public let MAX_EVENTS_RETENTION : Nat = 10_000; // Keep last 10k events
  public let CURSOR_TIMEOUT_NANOS : Nat = 60_000_000_000; // 60 seconds
  public let DEFAULT_AUTOSAVE_INTERVAL : Nat = 30_000_000_000; // 30 seconds
  public let DEFAULT_AUTOSAVE_IDLE : Nat = 5_000_000_000; // 5 seconds

  // ===== HELPER FUNCTIONS =====

  // Convert Principal to Text for HashMap keys
  //public func principalToText(p : Principal) : Text {
  //  Principal.toText(p);
  //};

  // Convert Text to Principal (with error handling)
  //public shared func textToPrincipal(t : Text) : async Result<Principal, Text> {
  //  try {
  //    #ok(Principal.fromText(t))
  //  } catch (e) {
  //    #err("Invalid principal text")
  //  }
  //};

  // Generate unique client operation ID
  public func makeClientOpId(clientId : ClientId, clientSeq : Nat) : ClientOpId {
    clientId # ":" # Nat.toText(clientSeq);
  };

  // Parse client operation ID
  public func parseClientOpId(opId : ClientOpId) : Result<(ClientId, Nat), Error> {
    let parts = Text.split(opId, #char ':');
    let partsArray = Iter.toArray(parts);
    if (partsArray.size() != 2) {
      return #err(#InvalidOperation);
    };
    switch (Nat.fromText(partsArray[1])) {
      case (?seq) { #ok(partsArray[0], seq) };
      case null { #err(#InvalidOperation) };
    };
  };

  // Check if user has required role
  public func hasRole(user : Principal, required : Role, access : Access) : Bool {
    if (Principal.equal(user, access.owner)) { return true };
    if (required == #Owner) { return false };

    for ((sharedUser, role) in access.sharedWith.vals()) {
      if (Principal.equal(user, sharedUser)) {
        switch (required, role) {
          case (#Viewer, #Viewer) { return true };
          case (#Viewer, #Editor) { return true };
          case (#Viewer, #Owner) { return true };
          case (#Editor, #Editor) { return true };
          case (#Editor, #Owner) { return true };
          case (_, _) { return false };
        };
      };
    };
    false;
  };

  // Check if user can edit
  public func canEdit(user : Principal, access : Access) : Bool {
    hasRole(user, #Editor, access);
  };

  // Check if user can view
  public func canView(user : Principal, access : Access) : Bool {
    hasRole(user, #Viewer, access) or access.isPublic;
  };

  // Check if user is owner
  public func isOwner(user : Principal, access : Access) : Bool {
    hasRole(user, #Owner, access);
  };

  // Calculate total size from chunks
  public func calculateTotalSize(chunks : [ContentChunk]) : Nat {
    var total : Nat = 0;
    for (chunk in chunks.vals()) {
      total += chunk.size;
    };
    total;
  };

  // Validate chunk data
  public func validateChunk(chunk : ContentChunk) : Bool {
    chunk.data.size() <= MAX_CHUNK_SIZE and chunk.size == chunk.data.size();
  };

  // Get current timestamp
  public func now() : Time.Time {
    Time.now();
  };

  // Format error message
  public func errorMessage(error : Error) : Text {
    switch (error) {
      case (#NotFound) { "Resource not found" };
      case (#AccessDenied) { "Access denied" };
      case (#InvalidOperation) { "Invalid operation" };
      case (#Conflict) { "Version conflict" };
      case (#DuplicateOperation) { "Duplicate operation" };
      case (#FileTooLarge) { "File too large" };
      case (#InvalidChunk) { "Invalid chunk data" };
      case (#QuotaExceeded) { "Quota exceeded" };
      case (#InternalError) { "Internal error" };
    };
  };
};


