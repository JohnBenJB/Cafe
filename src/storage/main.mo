import Time "mo:base/Time";
import Principal "mo:base/Principal";
import Nat "mo:base/Nat";
import Nat32 "mo:base/Nat32";
import Nat64 "mo:base/Nat64";
import Text "mo:base/Text";
import Blob "mo:base/Blob";
import Bool "mo:base/Bool";
import Option "mo:base/Option";
import Array "mo:base/Array";
import Buffer "mo:base/Buffer";
import HashMap "mo:base/HashMap";
import Hash "mo:base/Hash";
import Int "mo:base/Int";
import Iter "mo:base/Iter";
import Error "mo:base/Error";
import Debug "mo:base/Debug";
import Files "./files";
import Types "./types";
import Versions "./versions";
import Realtime "./realtime";
import Autosave "./autosave";
import TableManagement "canister:table_management";

  // ===== STORAGE CANISTER MAIN MODULE =====
  // Integrates all storage modules and provides public interface

actor {
  // Import types
  type FileId = Types.FileId;
  type Version = Types.Version;
  type ClientId = Types.ClientId;
  type Seq = Types.Seq;
  type ContentChunk = Types.ContentChunk;
  type FileMeta = Types.FileMeta;
  type Access = Types.Access;
  type Role = Types.Role;
  type Event = Types.Event;
  type Cursor = Types.Cursor;
  type PresenceEvent = Types.PresenceEvent;
  type Subscription = Types.Subscription;
  type Patch = Types.Patch;
  type EditOp = Types.EditOp;
  type Commit = Types.Commit;
  type AutosavePolicy = Types.AutosavePolicy;
  type Error = Types.Error;
  type Result<T, E> = Types.Result<T, E>;
  type Paginated<T> = Types.Paginated<T>;
  type AutosaveState = Autosave.AutosaveState;
  type AutosaveTask = Autosave.AutosaveTask;
  type FileStorage = Files.FileStorage;
  type EventRingBuffer = Realtime.EventRingBuffer;
  type ClientPresence = Realtime.ClientPresence;
  type VersionStorage = Versions.VersionStorage;

  // ===== STABLE STATE =====

  // Schema version for upgrades
  stable var schemaVersion : Nat32 = 1;

  // Global counters
  stable var nextFileId : Nat32 = 0;
  stable var nextVersion : Nat = 0;
  stable var nextSeq : Seq = 0;

  // ===== STABLE TYPE DEFINITIONS =====

  // Stable versions of types that contain HashMaps
  public type StableFileStorage = {
    meta : FileMeta;
    access : Access;
    chunks : [(Nat, ContentChunk)]; // Stable array representation of HashMap
    headVersion : Version;
    isDeleted : Bool;
  };

  public type StableVersionStorage = {
    commit : Commit;
    chunks : [(Nat, ContentChunk)]; // Stable array representation of HashMap
  };

  // ===== IMMUTABLE RETURN TYPES =====

  // Immutable view of FileMeta for shared returns
  public type FileMetaView = {
    id : FileId;
    tableId : Nat;
    name : Text;
    mime : Text;
    size : Nat;
    chunkCount : Nat;
    headVersion : Version;
    createdAt : Time.Time;
    updatedAt : Time.Time;
    owner : Principal;
    isDeleted : Bool;
  };

  // Immutable view of Access for shared returns
  public type AccessView = {
    owner : Principal;
    sharedWith : [(Principal, Role)];
    isPublic : Bool;
  };

  // ===== CONVERSION FUNCTIONS =====

  // Convert FileStorage to StableFileStorage
  func fileStorageToStable(fileStorage : FileStorage) : StableFileStorage {
    {
      meta = fileStorage.meta;
      access = fileStorage.access;
      chunks = Iter.toArray(fileStorage.chunks.entries());
      headVersion = fileStorage.headVersion;
      isDeleted = fileStorage.isDeleted;
    }
  };

  // Immutable view converters
  func toFileMetaView(meta : FileMeta) : FileMetaView {
    {
      id = meta.id;
      tableId = meta.tableId; 
      name = meta.name;
      mime = meta.mime;
      size = meta.size;
      chunkCount = meta.chunkCount;
      headVersion = meta.headVersion;
      createdAt = meta.createdAt;
      updatedAt = meta.updatedAt;
      owner = meta.owner;
      isDeleted = meta.isDeleted;
    }
  };

  func toAccessView(access : Access) : AccessView {
    {
      owner = access.owner;
      sharedWith = access.sharedWith;
      isPublic = access.isPublic;
    }
  };

  // Convert StableFileStorage to FileStorage
  func stableToFileStorage(stableStorage : StableFileStorage) : FileStorage {
    let chunks = HashMap.HashMap<Nat, ContentChunk>(0, Nat.equal, Hash.hash);
    for ((index, chunk) in stableStorage.chunks.vals()) {
      chunks.put(index, chunk);
    };
    {
      var meta = stableStorage.meta;
      var access = stableStorage.access;
      var chunks = chunks;
      var headVersion = stableStorage.headVersion;
      var isDeleted = stableStorage.isDeleted;
    }
  };

  // Convert VersionStorage to StableVersionStorage
  func versionStorageToStable(versionStorage : Versions.VersionStorage) : StableVersionStorage {
    {
      commit = versionStorage.commit;
      chunks = Iter.toArray(versionStorage.chunks.entries());
    }
  };

  // Convert StableVersionStorage to VersionStorage
  func stableToVersionStorage(stableVersion : StableVersionStorage) : Versions.VersionStorage {
    let chunks = HashMap.HashMap<Nat, ContentChunk>(0, Nat.equal, Hash.hash);
    for ((index, chunk) in stableVersion.chunks.vals()) {
      chunks.put(index, chunk);
    };
    {
      commit = stableVersion.commit;
      chunks = chunks;
    }
  };

   // Helper function to check if array contains element
  func arrayContains<T>(arr : [T], elem : T, equal : (T, T) -> Bool) : Bool {
    switch (Array.find<T>(arr, func(x) = equal(x, elem))) {
      case (?_) true;
      case null false;
    }
  };

  // ===== UPGRADE/DOWNGRADE =====

  // Stable arrays for upgrade serialization
  stable var stableFiles : [(FileId, StableFileStorage)] = [];
  stable var stableFilesByTableId : [(Nat, [FileId])] = [];
  stable var stableVersions : [(FileId, [(Version, StableVersionStorage)])] = [];
  stable var stableEvents : [(FileId, [Event])] = [];
  stable var stablePresence : [(FileId, [(ClientId, Realtime.ClientPresence)])] = [];
  stable var stableSubscriptions : [(FileId, [(ClientId, Subscription)])] = [];
  stable var stableAutosavePolicies : [(FileId, Autosave.AutosaveState)] = [];

  // ===== STATE MANAGEMENT =====

  // Autosave policies by file
  var autosavePolicies = HashMap.HashMap<FileId, AutosaveState>(0, Nat32.equal, func(x : Nat32) : Nat32 { x });

  // Pending autosave tasks (priority queue)
  var pendingAutosaves = Buffer.Buffer<AutosaveTask>(0);

  // Global autosave settings
  var globalAutosaveEnabled : Bool = true;
  var maxConcurrentAutosaves : Nat = 5;
  var autosaveIntervalNanos : Nat = Types.DEFAULT_AUTOSAVE_INTERVAL;

  // ===== POLICY MANAGEMENT =====

  // Set autosave policy for a file
  public func setAutosavePolicy(
    fileId : FileId,
    policy : AutosavePolicy
  ) : async Result<(), Error> {

    let state : AutosaveState = {
      policy = policy;
      lastActivity = Types.now();
      lastAutosave = Types.now();
      pendingChanges = false;
      autosaveCount = 0;
    };

    autosavePolicies.put(fileId, state);

    #ok(());
  };

  // Get autosave policy for a file
  public func getAutosavePolicy(fileId : FileId) : async Result<AutosavePolicy, Error> {
    switch (autosavePolicies.get(fileId)) {
      case (?state) { #ok(state.policy) };
      case null { #err(#NotFound) };
    };
  };

  // ===== ACTIVITY TRACKING =====

  // Record activity on a file
  public func recordActivity(fileId : FileId) : async Result<(), Error> {
    switch (autosavePolicies.get(fileId)) {
      case (?state) {
        let updatedState : AutosaveState = {
          policy = state.policy;
          lastActivity = Types.now();
          lastAutosave = state.lastAutosave;
          pendingChanges = true;
          autosaveCount = state.autosaveCount;
        };
        autosavePolicies.put(fileId, updatedState);

        // Add to pending autosaves if not already there
        addToPendingAutosaves(fileId, 1);

        #ok(());
      };
      case null {
        // Create default policy if none exists
        let defaultPolicy = Autosave.getDefaultPolicy();
        ignore setAutosavePolicy(fileId, defaultPolicy);
        ignore recordActivity(fileId);
        #ok(());
      };
    };
  };

  // Mark file as saved (clear pending changes)
func markSaved(fileId : FileId) : Result<(), Error> {
    switch (autosavePolicies.get(fileId)) {
      case (?state) {
        let updatedState : AutosaveState = {
          policy = state.policy;
          lastActivity = state.lastActivity;
          lastAutosave = Types.now();
          pendingChanges = false;
          autosaveCount = state.autosaveCount + 1;
        };
        autosavePolicies.put(fileId, updatedState);

        // Remove from pending autosaves
        removeFromPendingAutosaves(fileId);

        #ok(());
      };
      case null { #err(#NotFound) };
    };
  };

  // Check if file has pending changes
  public func hasPendingChanges(fileId : FileId) : async Result<Bool, Error> {
    switch (autosavePolicies.get(fileId)) {
      case (?state) { #ok(state.pendingChanges) };
      case null { #err(#NotFound) };
    };
  };

  // ===== AUTOSAVE PROCESSING =====

  // Add file to pending autosaves queue
  public func addToPendingAutosaves(fileId : FileId, priority : Nat) : () {
    // Check if already in queue
    for (i in Iter.range(0, pendingAutosaves.size() - 1)) {
      if (pendingAutosaves.get(i).fileId == fileId) {
        return; // Already in queue
      };
    };

    let task : AutosaveTask = {
      fileId = fileId;
      priority = priority;
      lastActivity = Types.now();
    };

    pendingAutosaves.add(task);
  };

  // Remove file from pending autosaves queue
  func removeFromPendingAutosaves(fileId : FileId) : () {
    let newTasks = Buffer.Buffer<AutosaveTask>(0);

    for (task in pendingAutosaves.vals()) {
      if (task.fileId != fileId) {
        newTasks.add(task);
      };
    };

    pendingAutosaves := newTasks;
  };

  // Get files that need autosave
  public func getFilesNeedingAutosave() : async [FileId] {
    let now = Types.now();
    let needingAutosave = Buffer.Buffer<FileId>(0);

    label firstLoop for ((fileId, state) in autosavePolicies.entries()) {
      if (not state.policy.enabled) { continue firstLoop };

      let timeSinceActivity = now - state.lastActivity;
      let timeSinceLastAutosave = now - state.lastAutosave;

      // Check if enough time has passed and file is idle
      if (state.pendingChanges and
          timeSinceLastAutosave >= state.policy.intervalNanos and
          timeSinceActivity >= state.policy.idleNanos) {
        needingAutosave.add(fileId);
      };
    };

    Buffer.toArray(needingAutosave);
  };

  // Process autosave for a file
  // public func processAutosave(
  //   fileId : FileId,
  //   saveFunction : (FileId, Principal) -> Result<Version, Error>,
  //   user : Principal
  // ) : async Result<Version, Error> {

  //   switch (autosavePolicies.get(fileId)) {
  //     case (?state) {
  //       if (not state.policy.enabled) {
  //         return #err(#InvalidOperation);
  //       };

  //       let now = Types.now();
  //       let timeSinceActivity = now - state.lastActivity;
  //       let timeSinceLastAutosave = now - state.lastAutosave;

  //       // Check if autosave is needed
  //       if (not state.pendingChanges) {
  //         return #err(#InvalidOperation); // No changes to save
  //       };

  //       if (timeSinceLastAutosave < state.policy.intervalNanos) {
  //         return #err(#InvalidOperation); // Too soon since last autosave
  //       };

  //       if (timeSinceActivity < state.policy.idleNanos) {
  //         return #err(#InvalidOperation); // File not idle enough
  //       };

  //       // Perform autosave
  //       switch (saveFunction(fileId, user)) {
  //         case (#ok(version)) {
  //           // Mark as saved
  //           markSaved(fileId);
  //           #ok(version);
  //         };
  //         case (#err(error)) { #err(error) };
  //       };
  //     };
  //     case null { #err(#NotFound) };
  //   };
  // };

  // // Process all pending autosaves
  // public func processAllAutosaves(
  //   saveFunction : (FileId, Principal) -> Result<Version, Error>,
  //   user : Principal
  // ) : async Result<{ processed : Nat; errors : [Text] }, Error> {

  //   let filesToProcess = getFilesNeedingAutosave();
  //   let results = Buffer.Buffer<Text>(0);
  //   var processedCount : Nat = 0;

  //   for (fileId in filesToProcess.vals()) {
  //     switch (processAutosave(fileId, saveFunction, user)) {
  //       case (#ok(_)) { processedCount += 1 };
  //       case (#err(error)) {
  //         results.add("File " # Nat32.toText(fileId) # ": " # Types.errorMessage(error));
  //       };
  //     };
  //   };

  //   #ok({
  //     processed = processedCount;
  //     errors = Buffer.toArray(results);
  //   });
  // };

  // ===== CLEANUP AND MAINTENANCE =====

  // Clean up old autosave policies
  public func cleanupOldPolicies(maxAgeNanos : Nat) : async Result<Nat, Error> {
    let now = Types.now();
    let toRemove = Buffer.Buffer<FileId>(0);

    for ((fileId, state) in autosavePolicies.entries()) {
      let timeSinceActivity = now - state.lastActivity;
      if (timeSinceActivity > maxAgeNanos) {
        toRemove.add(fileId);
      };
    };

    var removedCount : Nat = 0;
    for (fileId in toRemove.vals()) {
      autosavePolicies.delete(fileId);
      removeFromPendingAutosaves(fileId);
      removedCount += 1;
    };

    #ok(removedCount);
  };

  // Prune old versions based on autosave policy
  // public func pruneOldVersions(
  //   fileId : FileId,
  //   pruneFunction : (FileId, Nat) -> Result<Nat, Error>
  // ) : async Result<Nat, Error> {

  //   switch (autosavePolicies.get(fileId)) {
  //     case (?state) {
  //       pruneFunction(fileId, state.policy.maxVersions);
  //     };
  //     case null { #err(#NotFound) };
  //   };
  // };

  // ===== GLOBAL SETTINGS =====

  // Set global autosave enabled/disabled
  public func setGlobalAutosaveEnabled(enabled : Bool) : () {
    globalAutosaveEnabled := enabled;
  };

  // Get global autosave enabled status
  public func getGlobalAutosaveEnabled() : async Bool {
    globalAutosaveEnabled;
  };

  // Set global autosave interval
  public func setGlobalAutosaveInterval(intervalNanos : Nat) : () {
    autosaveIntervalNanos := intervalNanos;
  };

  // Get global autosave interval
  public func getGlobalAutosaveInterval() : async Nat {
    autosaveIntervalNanos;
  };

  // Set maximum concurrent autosaves
  public func setMaxConcurrentAutosaves(max : Nat) : () {
    maxConcurrentAutosaves := max;
  };

  // Get maximum concurrent autosaves
  public func getMaxConcurrentAutosaves() : async Nat {
    maxConcurrentAutosaves;
  };

  // ===== STATISTICS =====

  // Get autosave statistics for a file
  public func getAutosaveStats(fileId : FileId) : async Result<{ autosaveCount : Nat; lastAutosave : Time.Time; pendingChanges : Bool }, Error> {
    switch (autosavePolicies.get(fileId)) {
      case (?state) {
        #ok({
          autosaveCount = state.autosaveCount;
          lastAutosave = state.lastAutosave;
          pendingChanges = state.pendingChanges;
        });
      };
      case null { #err(#NotFound) };
    };
  };

  // Get global autosave statistics
  public func getGlobalAutosaveStats() : async { totalFiles : Nat; pendingAutosaves : Nat; enabledFiles : Nat } {
    var totalFiles : Nat = 0;
    var enabledFiles : Nat = 0;

    for ((_, state) in autosavePolicies.entries()) {
      totalFiles += 1;
      if (state.policy.enabled) {
        enabledFiles += 1;
      };
    };

    {
      totalFiles = totalFiles;
      pendingAutosaves = pendingAutosaves.size();
      enabledFiles = enabledFiles;
    };
  };

  // ===== UTILITY FUNCTIONS =====

  // Check if autosave is due for a file
  public func isAutosaveDue(fileId : FileId) : async Result<Bool, Error> {
    switch (autosavePolicies.get(fileId)) {
      case (?state) {
        if (not state.policy.enabled) { return #ok(false) };

        let now = Types.now();
        let timeSinceActivity = now - state.lastActivity;
        let timeSinceLastAutosave = now - state.lastAutosave;

        let due = state.pendingChanges and
                  timeSinceLastAutosave >= state.policy.intervalNanos and
                  timeSinceActivity >= state.policy.idleNanos;

        #ok(due);
      };
      case null { #err(#NotFound) };
    };
  };

  // Get time until next autosave for a file
  public func getTimeUntilAutosave(fileId : FileId) : async Result<Int, Error> {
    switch (autosavePolicies.get(fileId)) {
      case (?state) {
        if (not state.policy.enabled or not state.pendingChanges) {
          return #ok(0);
        };

        let now = Types.now();
        let timeSinceLastAutosave = now - state.lastAutosave;
        let timeSinceActivity = now - state.lastActivity;

        let intervalRemaining = if (timeSinceLastAutosave < state.policy.intervalNanos) {
          state.policy.intervalNanos - timeSinceLastAutosave;
        } else {
          0;
        };

        let idleRemaining = if (timeSinceActivity < state.policy.idleNanos) {
          state.policy.idleNanos - timeSinceActivity;
        } else {
          0;
        };

        let maxRemaining = if (intervalRemaining > idleRemaining) {
          intervalRemaining;
        } else {
          idleRemaining;
        };

        #ok(maxRemaining);
      };
      case null { #err(#NotFound) };
    };
  };

  // Remove autosave policy for a file
  public func removeAutosavePolicy(fileId : FileId) : async Result<(), Error> {
    autosavePolicies.delete(fileId);
    removeFromPendingAutosaves(fileId);
    #ok(());
  };

  // Get all files with autosave policies
  public func getAllAutosaveFiles() : async [FileId] {
    let files = Buffer.Buffer<FileId>(0);
    for ((fileId, _) in autosavePolicies.entries()) {
      files.add(fileId);
    };
    Buffer.toArray(files);
  };

  system func preupgrade() {
    // Serialize file storage using stable conversion
    let filesByIdArr : [(FileId, FileStorage)] = Iter.toArray(filesById.entries());
    let stableFiles : [(FileId, StableFileStorage)]  = Array.map<(FileId, FileStorage), (FileId, StableFileStorage)>(filesByIdArr, func (pair) {let (fileId, fileStorage) = pair; (fileId, fileStorageToStable(fileStorage))});

    // Serialize version storage using stable conversion
    let versionEntries = Buffer.Buffer<(FileId, [(Version, StableVersionStorage)])>(0);
    for ((fileId, fileVersions) in commitsByFile.entries()) {
      let fileVersionsArr : [(Version, VersionStorage)] = Iter.toArray(fileVersions.entries());
      let stableVersions : [(Version, StableVersionStorage)]  = Array.map<(Version, VersionStorage), (Version, StableVersionStorage)>(fileVersionsArr, func (pair) {let (version, versionStorage) = pair; (version, versionStorageToStable(versionStorage))});
      versionEntries.add((fileId, stableVersions));
    };
    stableVersions := Buffer.toArray(versionEntries);

    // Serialize storage for files by tableId
    let filesByTableIdEntries = Buffer.Buffer<(Nat, [FileId])>(0);
    for ((tableId, filesByTable) in filesByTableId.entries()) {
      filesByTableIdEntries.add((tableId, filesByTable));
    };
    stableFilesByTableId := Buffer.toArray(filesByTableIdEntries);

    // Serialize events
    let eventEntries = Buffer.Buffer<(FileId, [Event])>(0);
    for ((fileId, buffer) in eventsByFile.entries()) {
      eventEntries.add((fileId, Buffer.toArray(buffer.events)));
    };
    stableEvents := Buffer.toArray(eventEntries);

    // Serialize presence
    let presenceEntries = Buffer.Buffer<(FileId, [(ClientId, Realtime.ClientPresence)])>(0);
    for ((fileId, filePresence) in presenceByFile.entries()) {
      presenceEntries.add((fileId, Iter.toArray(filePresence.entries())));
    };
    stablePresence := Buffer.toArray(presenceEntries);

    // Serialize subscriptions
    let subscriptionEntries = Buffer.Buffer<(FileId, [(ClientId, Subscription)])>(0);
    for ((fileId, fileSubscriptions) in subscriptionsByFile.entries()) {
      subscriptionEntries.add((fileId, Iter.toArray(fileSubscriptions.entries())));
    };
    stableSubscriptions := Buffer.toArray(subscriptionEntries);

    // Serialize autosave policies
    stableAutosavePolicies := Iter.toArray(autosavePolicies.entries());

    // Update global counters; Might not be necessary since the stable definition for the variable will be used by all the codes from files and versions
    // nextFileId := nextFileId;
    // nextVersion := nextVersion;
    // nextSeq := nextSeq;
  };

   // ===== STATE MANAGEMENT =====

  // Global counters; commented out because the stable definitions for these variables in the actor are going to be used in the functions
  //that initially came from file.mo and version.mo
  // public var nextFileId : Nat32 = 0;
  // public var nextVersion : Nat64 = 0;

  // File storage maps
  var filesById = HashMap.HashMap<FileId, FileStorage>(0, Nat32.equal, func(x : Nat32) : Nat32 { x });
  var filesByTableId = HashMap.HashMap<Nat, [FileId]>(0, Nat.equal, Hash.hash);
  var fileNamesByOwner = HashMap.HashMap<Principal, HashMap.HashMap<Text, FileId>>(0, Principal.equal, Principal.hash);

  // ===== FILE CREATION =====

  // Create a new file with initial content
  func createFile(
    name : Text,
    tableId: Nat,
    mime : Text,
    owner : Principal,
    initialContent : ?Blob
  ) : Result<FileId, Error> {

    // Validate input
    if (Text.size(name) == 0) {
      return #err(#InvalidOperation);
    };

    // Check if owner already has a file with this name
    switch (fileNamesByOwner.get(owner)) {
      case (?existingFiles) {
        if (Option.isSome(existingFiles.get(name))) {
          return #err(#InvalidOperation); // Name already exists
        };
      };
      case null { /* First file for this owner */ };
    };

    // Generate new file ID
    let fileId = nextFileId;
    nextFileId += 1;

    // Create initial version
    let version = nextVersion;
    nextVersion += 1;

    // Initialize chunks if content provided
    let chunks = HashMap.HashMap<Nat, ContentChunk>(0, Nat.equal, Hash.hash);
    var totalSize : Nat = 0;
    var chunkCount : Nat = 0;

    switch (initialContent) {
      case (?content) {
        if (content.size() > Types.MAX_FILE_SIZE) {
          return #err(#FileTooLarge);
        };

        // Split content into chunks
        let chunkSize = Types.MAX_CHUNK_SIZE;
        var offset : Nat = 0;
        var chunkIndex : Nat = 0;

        while (offset < content.size()) {
          let endOffset = Nat.min(offset + chunkSize, content.size());
          let chunkData = Blob.fromArray(Array.subArray(Blob.toArray(content), offset, endOffset - offset));

          let chunk : ContentChunk = {
            index = chunkIndex;
            data = chunkData;
            size = chunkData.size();
          };

          chunks.put(chunkIndex, chunk);
          totalSize += chunk.size;
          chunkCount += 1;
          offset := endOffset;
          chunkIndex += 1;
        };
      };
      case null { /* Empty file */ };
    };

    // Create file metadata
    let now = Types.now();
    let meta : FileMeta = {
      id = fileId;
      tableId = tableId;
      var name = name;
      var mime = mime;
      var size = totalSize;
      var chunkCount = chunkCount;
      headVersion = version;
      createdAt = now;
      var updatedAt = now;
      owner = owner;
      var isDeleted = false;
    };

    // Create access control
    let access : Access = {
      owner = owner;
      var sharedWith = [];
      var isPublic = false;
    };

    // Store file
    let fileStorage : FileStorage = {
      var meta = meta;
      var access = access;
      var chunks = chunks;
      var headVersion = version;
      var isDeleted = false;
    };

    filesById.put(fileId, fileStorage);
    switch (filesByTableId.get(tableId)) {
      case null {
        return #err(#NotFound);
      };
      case (?oldArray) {
        let updatedArray = Array.append(oldArray, [fileId]);
        filesByTableId.put(tableId, updatedArray);
      }
    };
    
    // Update owner's file name index
    switch (fileNamesByOwner.get(owner)) {
      case (?existingFiles) {
        existingFiles.put(name, fileId);
      };
      case null {
        let newFileMap = HashMap.HashMap<Text, FileId>(0, Text.equal, Text.hash);
        newFileMap.put(name, fileId);
        fileNamesByOwner.put(owner, newFileMap);
      };
    };

    #ok(fileId);
  };

  // ===== FILE READING =====

  // Get file metadata
  func getFileMeta(fileId : FileId) : Result<FileMetaView, Error> {
    switch (filesById.get(fileId)) {
      case (?file) {
        if (file.isDeleted) {
          return #err(#NotFound);
        };
        #ok(toFileMetaView(file.meta));
      };
      case null { #err(#NotFound) };
    };
  };

  // Get file access information
  public func getFileAccess(fileId : FileId) : async Result<AccessView, Error> {
    switch (filesById.get(fileId)) {
      case (?file) {
        if (file.isDeleted) {
          return #err(#NotFound);
        };
        #ok(toAccessView(file.access));
      };
      case null { #err(#NotFound) };
    };
  };

    // List files for a user (paginated)
  public shared(msg) func listFiles(
    offset : Nat,
    limit : Nat
  ) : async Result<Paginated<FileMetaView>, Error> {
    let caller = msg.caller;
    let userFiles = Buffer.Buffer<FileMetaView>(0);
    var total : Nat = 0;

    // Iterate through all files
    for ((fileId, file) in filesById.entries()) {
      if (not file.isDeleted) {
        // Check if user has access
        if (Types.canView(caller, file.access)) {
          total += 1;
          if (userFiles.size() < limit and total > offset) {
            userFiles.add(toFileMetaView(file.meta));
          };
        };
      };
    };

    let nextOffset = if (offset + limit < total) { ?(offset + limit) } else { null };

    #ok({
      items = Buffer.toArray(userFiles);
      next = nextOffset;
      total = total;
    });
  };

  // Get a specific chunk of file content
  public shared({ caller })func getChunk(fileId : FileId, chunkIndex : Nat) : async Result<ContentChunk, Error> {
    switch (await hasAccess(fileId, caller)) {
      case (#err(error)) {
        return #err(error);
      };
      case (#ok(isAllowed)) {
        if (isAllowed == false) {
          return #err(#AccessDenied);
        }
      }
    };
    switch (filesById.get(fileId)) {
      case (?file) {
        if (file.isDeleted) {
          return #err(#NotFound);
        };
        switch (file.chunks.get(chunkIndex)) {
          case (?chunk) { #ok(chunk) };
          case null { #err(#NotFound) };
        };
      };
      case null { #err(#NotFound) };
    };
  };

  // Get all chunks for a file
  public func getAllChunks(fileId : FileId) : async Result<[ContentChunk], Error> {
    switch (filesById.get(fileId)) {
      case (?file) {
        if (file.isDeleted) {
          return #err(#NotFound);
        };

        let chunkArray = Iter.toArray(file.chunks.entries());
        let sortedChunks = Array.sort(chunkArray, func(a : (Nat, ContentChunk), b : (Nat, ContentChunk)) : { #less; #equal; #greater } {
          if (a.0 < b.0) { #less } else if (a.0 > b.0) { #greater } else { #equal };
        });
        let chunks = Array.map<(Nat, ContentChunk), ContentChunk>(sortedChunks, func(pair) { pair.1 });
        #ok(chunks);
      };
      case null { #err(#NotFound) };
    };
  };

  // Get complete file content as blob
  public func getFileContent(fileId : FileId) : async Result<Blob, Error> {
    switch (await getAllChunks(fileId)) {
      case (#ok(chunks)) {
        if (chunks.size() == 0) {
          return #ok(Blob.fromArray([]));
        };

        // Calculate total size
        let totalSize = Types.calculateTotalSize(chunks);
        let buffer = Buffer.Buffer<Nat8>(totalSize);

        // Concatenate all chunks
        for (chunk in chunks.vals()) {
          let chunkArray = Blob.toArray(chunk.data);
          for (byte in chunkArray.vals()) {
            buffer.add(byte);
          };
        };

        #ok(Blob.fromArray(Buffer.toArray(buffer)));
      };
      case (#err(error)) { #err(error) };
    };
  };

  // ===== FILE UPDATING =====

  // Update file metadata
  public shared(msg) func updateFileMeta(
    fileId : FileId,
    name : ?Text,
    mime : ?Text,
  ) : async Result<(), Error> {
    let user = msg.caller;
    switch (filesById.get(fileId)) {
      case (?file) {
        if (file.isDeleted) {
          return #err(#NotFound);
        };

        if (not Types.canEdit(user, file.access)) {
          return #err(#AccessDenied);
        };

        // Update name if provided
        switch (name) {
          case (?newName) {
            if (Text.size(newName) == 0) {
              return #err(#InvalidOperation);
            };

            // Check for name conflicts
            switch (fileNamesByOwner.get(file.meta.owner)) {
              case (?existingFiles) {
                switch (existingFiles.get(newName)) {
                  case (?existingFileId) {
                    if (existingFileId != fileId) {
                      return #err(#InvalidOperation); // Name already exists
                    };
                  };
                  case null { /* Name is available */ };
                };
              };
              case null { /* No existing files */ };
            };

            // Remove old name from index
            switch (fileNamesByOwner.get(file.meta.owner)) {
              case (?existingFiles) {
                existingFiles.delete(file.meta.name);
                existingFiles.put(newName, fileId);
              };
              case null { /* Shouldn't happen */ };
            };

            file.meta.name := newName;
          };
          case null { /* Keep existing name */ };
        };

        // Update MIME type if provided
        switch (mime) {
          case (?newMime) { file.meta.mime := newMime };
          case null { /* Keep existing MIME */ };
        };

        file.meta.updatedAt := Types.now();

        #ok(());
      };
      case null { #err(#NotFound) };
    };
  };

  // Replace file content with new chunks
  func replaceFileContent(
    fileId : FileId,
    newChunks : [ContentChunk],
    user : Principal
  ) : Result<Version, Error> {

    switch (filesById.get(fileId)) {
      case (?file) {
        if (file.isDeleted) {
          return #err(#NotFound);
        };

        if (not Types.canEdit(user, file.access)) {
          return #err(#AccessDenied);
        };

        // Validate chunks
        var totalSize : Nat = 0;
        for (chunk in newChunks.vals()) {
          if (not Types.validateChunk(chunk)) {
            return #err(#InvalidChunk);
          };
          totalSize += chunk.size;
        };

        if (totalSize > Types.MAX_FILE_SIZE) {
          return #err(#FileTooLarge);
        };

        // Create new version
        let newVersion = nextVersion;
        nextVersion += 1;

        // Replace chunks
        let newChunkMap = HashMap.HashMap<Nat, ContentChunk>(0, Nat.equal, Hash.hash);
        for (chunk in newChunks.vals()) {
          newChunkMap.put(chunk.index, chunk);
        };

        file.chunks := newChunkMap;
        file.headVersion := newVersion;
        file.meta.size := totalSize;
        file.meta.chunkCount := newChunks.size();
        file.meta.updatedAt := Types.now();

        #ok(newVersion);
      };
      case null { #err(#NotFound) };
    };
  };

  // Update a specific chunk
  func updateChunk(
    fileId : FileId,
    chunkIndex : Nat,
    data : Blob,
    user : Principal
  ) : Result<Version, Error> {

    switch (filesById.get(fileId)) {
      case (?file) {
        if (file.isDeleted) {
          return #err(#NotFound);
        };

        if (not Types.canEdit(user, file.access)) {
          return #err(#AccessDenied);
        };

        // Validate chunk
        if (data.size() > Types.MAX_CHUNK_SIZE) {
          return #err(#InvalidChunk);
        };

        let chunk : ContentChunk = {
          index = chunkIndex;
          data = data;
          size = data.size();
        };

        // Calculate new total size
        let oldChunk = file.chunks.get(chunkIndex);
        var sizeDiff : Nat = 0;
        var newTotalSize : Nat = 0;
        switch (oldChunk) {
          case (?old) {
            if (chunk.size > old.size) {
              sizeDiff := chunk.size - old.size;
              newTotalSize := file.meta.size + sizeDiff;
            } else {
              sizeDiff := old.size - chunk.size;
              newTotalSize := file.meta.size - sizeDiff;
            }
          };
          case null {
            sizeDiff := chunk.size;
            newTotalSize := file.meta.size + sizeDiff;
          };

        };

        if (newTotalSize > Types.MAX_FILE_SIZE) {
          return #err(#FileTooLarge);
        };

        // Create new version
        let newVersion = nextVersion;
        nextVersion += 1;

        // Update chunk
        file.chunks.put(chunkIndex, chunk);
        file.headVersion := newVersion;
        file.meta.size := newTotalSize;
        file.meta.updatedAt := Types.now();

        #ok(newVersion);
      };
      case null { #err(#NotFound) };
    };
  };

  // ===== FILE DELETION =====

  // Soft delete a file
  func deleteFile(fileId : FileId, user : Principal) : Result<(), Error> {
    switch (filesById.get(fileId)) {
      case (?file) {
        if (file.isDeleted) {
          return #err(#NotFound);
        };

        if (not Types.isOwner(user, file.access)) {
          return #err(#AccessDenied);
        };

        file.isDeleted := true;
        file.meta.isDeleted := true;
        file.meta.updatedAt := Types.now();

        // Remove from owner's file name index
        switch (fileNamesByOwner.get(file.meta.owner)) {
          case (?existingFiles) {
            existingFiles.delete(file.meta.name);
          };
          case null { /* Shouldn't happen */ };
        };

        #ok(());
      };
      case null { #err(#NotFound) };
    };
  };

  // Restore a deleted file
  func restoreFile(fileId : FileId, user : Principal) : Result<(), Error> {
    switch (filesById.get(fileId)) {
      case (?file) {
        if (not file.isDeleted) {
          return #err(#InvalidOperation);
        };

        if (not Types.isOwner(user, file.access)) {
          return #err(#AccessDenied);
        };

        file.isDeleted := false;
        file.meta.isDeleted := false;
        file.meta.updatedAt := Types.now();

        // Add back to owner's file name index
        switch (fileNamesByOwner.get(file.meta.owner)) {
          case (?existingFiles) {
            existingFiles.put(file.meta.name, fileId);
          };
          case null {
            let newFileMap = HashMap.HashMap<Text, FileId>(0, Text.equal, Text.hash);
            newFileMap.put(file.meta.name, fileId);
            fileNamesByOwner.put(file.meta.owner, newFileMap);
          };
        };

        #ok(());
      };
      case null { #err(#NotFound) };
    };
  };

  // ===== ACCESS CONTROL =====

  // Share file with another user
  public shared(msg) func shareFile(
    fileId : FileId,
    targetUser : Principal,
    role : Role,
  ) : async Result<(), Error> {
    let user = msg.caller;
    switch (filesById.get(fileId)) {
      case (?file) {
        if (file.isDeleted) {
          return #err(#NotFound);
        };

        if (not Types.isOwner(user, file.access)) {
          return #err(#AccessDenied);
        };

        // Check if already shared
        for ((sharedUser, existingRole) in file.access.sharedWith.vals()) {
          if (Principal.equal(sharedUser, targetUser)) {
            // Update existing role
            let updatedShared = Array.map<(Principal, Role), (Principal, Role)>(
              file.access.sharedWith,
              func(pair : (Principal, Role)) : (Principal, Role) {
                if (Principal.equal(pair.0, targetUser)) {
                  (targetUser, role);
                } else {
                  pair;
                };
              }
            );
            file.access.sharedWith := updatedShared;
            return #ok(());
          };
        };

        // Add new share
        let newShared = Array.append(file.access.sharedWith, [(targetUser, role)]);
        file.access.sharedWith := newShared;

        #ok(());
      };
      case null { #err(#NotFound) };
    };
  };

  // Revoke access for a user
  public shared(msg) func revokeAccess(
    fileId : FileId,
    targetUser : Principal,
  ) : async Result<(), Error> {
    let user = msg.caller;
    switch (filesById.get(fileId)) {
      case (?file) {
        if (file.isDeleted) {
          return #err(#NotFound);
        };

        if (not Types.isOwner(user, file.access)) {
          return #err(#AccessDenied);
        };

        // Remove user from shared list
        let filteredShared = Array.filter<(Principal, Role)>(
          file.access.sharedWith,
          func(pair : (Principal, Role)) : Bool {
            not Principal.equal(pair.0, targetUser);
          }
        );
        file.access.sharedWith := filteredShared;

        #ok(());
      };
      case null { #err(#NotFound) };
    };
  };

  // Set public access
  public shared(msg) func setPublicAccess(
    fileId : FileId,
    isPublic : Bool,
  ) : async Result<(), Error> {
    let user = msg.caller;
    switch (filesById.get(fileId)) {
      case (?file) {
        if (file.isDeleted) {
          return #err(#NotFound);
        };

        if (not Types.isOwner(user, file.access)) {
          return #err(#AccessDenied);
        };

        file.access.isPublic := isPublic;

        #ok(());
      };
      case null { #err(#NotFound) };
    };
  };

  // ===== UTILITY FUNCTIONS =====

  // Check if file exists and user has access
  public func hasAccess(fileId : FileId, user : Principal) : async Result<Bool, Error> {
    switch (filesById.get(fileId)) {
      case (?file) {
        if (file.isDeleted) { 
          return #err(#NotFound) 
        } else {
          let assocTableId = file.meta.tableId;
          let usersWithAccess = TableManagement.get_table_collaborators(assocTableId);
          let usersWithAccessPrincipals : [Principal] = [];
          for (user in usersWithAccess.vals()) {
            ignore Array.append(usersWithAccessPrincipals, [user.principal]);
          };
          if (not arrayContains<Principal>(usersWithAccessPrincipals, user, Principal.equal)) {
              return #ok(false);
          } else {
            return #ok(true);
          };
        };
      };
      case null { #err(#NotFound) };
    };
  };

  // Get file count for a user
  public func getUserFileCount(user : Principal) : async Nat {
    var count : Nat = 0;
    for ((_, file) in filesById.entries()) {
      if (not file.isDeleted and Types.canView(user, file.access)) {
        count += 1;
      };
    };
    count;
  };

  // Get total storage used by a user
  public func getUserStorageUsed(user : Principal) : async Nat {
    var total : Nat = 0;
    for ((_, file) in filesById.entries()) {
      if (not file.isDeleted and Types.isOwner(user, file.access)) {
        total += file.meta.size;
      };
    };
    total;
  };

  // Clean up deleted files (permanent deletion)
  func cleanupDeletedFiles() : Nat {
    var deletedCount : Nat = 0;
    let toDelete = Buffer.Buffer<FileId>(0);

    for ((fileId, file) in filesById.entries()) {
      if (file.isDeleted) {
        toDelete.add(fileId);
      };
    };

    for (fileId in toDelete.vals()) {
      filesById.delete(fileId);
      deletedCount += 1;
    };

    deletedCount;
  };

   // ===== STATE MANAGEMENT =====

  // Global sequence counter; commented out because the stable declaration for this variable in the actor already suffices.
  // public var nextSeq : Seq = 0;

  // Event storage
  var eventsByFile = HashMap.HashMap<FileId, EventRingBuffer>(0, Nat32.equal,
  func(fileId : FileId) : Hash.Hash { Hash.hash(Nat32.toNat(fileId)) });

  // Client subscriptions
  var subscriptionsByFile = HashMap.HashMap<FileId, HashMap.HashMap<ClientId,
  Subscription>>(0, Nat32.equal, func(fileId : Nat32) : Hash.Hash
  {Hash.hash(Nat32.toNat(fileId))});

  // Client presence and cursors
  var presenceByFile = HashMap.HashMap<FileId, HashMap.HashMap<ClientId,
  ClientPresence>>(0, Nat32.equal, func(fileId : Nat32) : Hash.Hash
  {Hash.hash(Nat32.toNat(fileId))});

  // Deduplication of client operations
  var dedupeOpIdsByFile = HashMap.HashMap<FileId, HashMap.HashMap<Text,
  Time.Time>>(0, Nat32.equal, func(fileId : Nat32) : Hash.Hash
  {Hash.hash(Nat32.toNat(fileId))});

  // ===== EVENT MANAGEMENT =====

  // Create a new event ring buffer
  func createEventBuffer(fileId : FileId) : EventRingBuffer {
    {
      events = Buffer.Buffer<Event>(0);
      maxSize = Types.MAX_EVENTS_RETENTION;
      var startSeq = nextSeq;
    };
  };

  // Add event to ring buffer
  func addEvent(fileId : FileId, event : Event) : () {
    switch (eventsByFile.get(fileId)) {
      case (?buffer) {
        buffer.events.add(event);

        // Maintain bounded size
        if (buffer.events.size() > buffer.maxSize) {
          let removed = buffer.events.remove(0);
          buffer.startSeq := removed.seq + 1;
        };
      };
      case null {
        let newBuffer = createEventBuffer(fileId);
        newBuffer.events.add(event);
        eventsByFile.put(fileId, newBuffer);
      };
    };
  };

  // Get events since a specific sequence number
  public func getEvents(
    fileId : FileId,
    since : Seq,
    maxEvents : Nat
  ) : async Result<{ events : [Event]; nextSince : Seq }, Error> {

    switch (eventsByFile.get(fileId)) {
      case (?buffer) {
        let events = Buffer.Buffer<Event>(0);
        var nextSince = since;

        for (event in buffer.events.vals()) {
          if (event.seq > since and events.size() < maxEvents) {
            events.add(event);
            nextSince := event.seq;
          };
        };

        #ok({
          events = Buffer.toArray(events);
          nextSince = nextSince;
        });
      };
      case null { #err(#NotFound) };
    };
  };

  // ===== PRESENCE MANAGEMENT =====

  // Join a file (start presence)
  func joinFile(
    fileId : FileId,
    clientId : ClientId,
    user : Principal
  ) : Result<Seq, Error> {

    // Create presence entry
    let presence : ClientPresence = {
      clientId = clientId;
      user = user;
      lastSeen = Types.now();
      cursor = null;
    };

    // Store presence
    switch (presenceByFile.get(fileId)) {
      case (?filePresence) {
        filePresence.put(clientId, presence);
      };
      case null {
        let newFilePresence = HashMap.HashMap<ClientId, ClientPresence>(0, Text.equal, Text.hash);
        newFilePresence.put(clientId, presence);
        presenceByFile.put(fileId, newFilePresence);
      };
    };

    // Create join event
    let event : Event = {
      seq = nextSeq;
      fileId = fileId;
      kind = #Presence(#Join({ clientId = clientId; user = user }));
      time = Types.now();
    };
    nextSeq += 1;

    addEvent(fileId, event);

    #ok(event.seq);
  };

  // Leave a file (end presence)
  public shared({ caller }) func leaveFile(
    fileId : FileId,
    clientId : ClientId
  ) : async Result<(), Error> {

    // Remove presence
    switch (presenceByFile.get(fileId)) {
      case (?filePresence) {
        filePresence.delete(clientId);
      };
      case null { /* No presence to remove */ };
    };

    // Create leave event
    let event : Event = {
      seq = nextSeq;
      fileId = fileId;
      kind = #Presence(#Leave({ clientId = clientId }));
      time = Types.now();
    };
    nextSeq += 1;

    addEvent(fileId, event);

    #ok(());
  };

  // Update client heartbeat and cursor
  func updatePresence(
    fileId : FileId,
    clientId : ClientId,
    cursor : ?Cursor
  ) : Result<(), Error> {

    switch (presenceByFile.get(fileId)) {
      case (?filePresence) {
        switch (filePresence.get(clientId)) {
          case (?presence) {
            // Update presence
            let updatedPresence : ClientPresence = {
              clientId = clientId;
              user = presence.user;
              lastSeen = Types.now();
              cursor = cursor;
            };
            filePresence.put(clientId, updatedPresence);

            // Create cursor update event if cursor provided
            switch (cursor) {
              case (?cursorData) {
                let event : Event = {
                  seq = nextSeq;
                  fileId = fileId;
                  kind = #CursorUpdate(cursorData);
                  time = Types.now();
                };
                nextSeq += 1;
                addEvent(fileId, event);
              };
              case null { /* No cursor update */ };
            };
          };
          case null { return #err(#NotFound) };
        };
      };
      case null { return #err(#NotFound) };
    };

    #ok(());
  };

  // Get all active clients for a file
  public func getActiveClients(fileId : FileId) : async Result<[ClientPresence], Error> {
    switch (presenceByFile.get(fileId)) {
      case (?filePresence) {
        let clients = Buffer.Buffer<ClientPresence>(0);
        let now = Types.now();

        for ((clientId, presence) in filePresence.entries()) {
          // Check if client is still active (within timeout)
          if ((now - presence.lastSeen) < Types.CURSOR_TIMEOUT_NANOS) {
            clients.add(presence);
          };
        };

        #ok(Buffer.toArray(clients));
      };
      case null { #ok([]) };
    };
  };

  // Clean up stale clients
  func cleanupStaleClients(fileId : FileId) : Result<Nat, Error> {
    switch (presenceByFile.get(fileId)) {
      case (?filePresence) {
        let now = Types.now();
        let toRemove = Buffer.Buffer<ClientId>(0);

        for ((clientId, presence) in filePresence.entries()) {
          if ((now - presence.lastSeen) >= Types.CURSOR_TIMEOUT_NANOS) {
            toRemove.add(clientId);
          };
        };

        var removedCount : Nat = 0;
        for (clientId in toRemove.vals()) {
          filePresence.delete(clientId);
          removedCount += 1;

          // Create leave event for stale client
          let event : Event = {
            seq = nextSeq;
            fileId = fileId;
            kind = #Presence(#Leave({ clientId = clientId }));
            time = Types.now();
          };
          nextSeq += 1;
          addEvent(fileId, event);
        };

        #ok(removedCount);
      };
      case null { #ok(0) };
    };
  };

  // ===== SUBSCRIPTION MANAGEMENT =====

  // Subscribe to file events
  public func subscribe(
    fileId : FileId,
    clientId : ClientId,
    user : Principal
  ) : async Result<Subscription, Error> {

    let subscription : Subscription = {
      clientId = clientId;
      since = nextSeq;
      lastPolled = Types.now();
      user = user;
    };

    // Store subscription
    switch (subscriptionsByFile.get(fileId)) {
      case (?fileSubscriptions) {
        fileSubscriptions.put(clientId, subscription);
      };
      case null {
        let newFileSubscriptions = HashMap.HashMap<ClientId, Subscription>(0, Text.equal, Text.hash);
        newFileSubscriptions.put(clientId, subscription);
        subscriptionsByFile.put(fileId, newFileSubscriptions);
      };
    };

    #ok(subscription);
  };

  // Unsubscribe from file events
  public func unsubscribe(fileId : FileId, clientId : ClientId) : async Result<(), Error> {
    switch (subscriptionsByFile.get(fileId)) {
      case (?fileSubscriptions) {
        fileSubscriptions.delete(clientId);
        #ok(());
      };
      case null { #ok(()) };
    };
  };

  // Update subscription last polled time
  public func updateSubscriptionPolled(
    fileId : FileId,
    clientId : ClientId,
    since : Seq
  ) : async Result<(), Error> {

    switch (subscriptionsByFile.get(fileId)) {
      case (?fileSubscriptions) {
        switch (fileSubscriptions.get(clientId)) {
          case (?subscription) {
            let updatedSubscription : Subscription = {
              clientId = clientId;
              since = since;
              lastPolled = Types.now();
              user = subscription.user;
            };
            fileSubscriptions.put(clientId, updatedSubscription);
            #ok(());
          };
          case null { #err(#NotFound) };
        };
      };
      case null { #err(#NotFound) };
    };
  };

  // Get all subscriptions for a file
  func getSubscriptions(fileId : FileId) : Result<[Subscription], Error> {
    switch (subscriptionsByFile.get(fileId)) {
      case (?fileSubscriptions) {
        let subscriptions = Buffer.Buffer<Subscription>(0);
        for ((_, subscription) in fileSubscriptions.entries()) {
          subscriptions.add(subscription);
        };
        #ok(Buffer.toArray(subscriptions));
      };
      case null { #ok([]) };
    };
  };

  // ===== PATCH PROCESSING =====

  // Check if operation is duplicate
  func isDuplicateOperation(
    fileId : FileId,
    clientOpId : Text
  ) : Bool {

    switch (dedupeOpIdsByFile.get(fileId)) {
      case (?fileOpIds) {
        Option.isSome(fileOpIds.get(clientOpId));
      };
      case null { false };
    };
  };

  // Record operation as processed
  func recordOperation(
    fileId : FileId,
    clientOpId : Text
  ) : () {

    switch (dedupeOpIdsByFile.get(fileId)) {
      case (?fileOpIds) {
        fileOpIds.put(clientOpId, Types.now());
      };
      case null {
        let newFileOpIds = HashMap.HashMap<Text, Time.Time>(0, Text.equal, Text.hash);
        newFileOpIds.put(clientOpId, Types.now());
        dedupeOpIdsByFile.put(fileId, newFileOpIds);
      };
    };
  };

  // Clean up old operation IDs
  public func cleanupOldOperations(fileId : FileId, maxAgeNanos : Nat) : async Result<Nat, Error> {
    switch (dedupeOpIdsByFile.get(fileId)) {
      case (?fileOpIds) {
        let now = Types.now();
        let toRemove = Buffer.Buffer<Text>(0);

        for ((opId, timestamp) in fileOpIds.entries()) {
          if ((now - timestamp) > maxAgeNanos) {
            toRemove.add(opId);
          };
        };

        var removedCount : Nat = 0;
        for (opId in toRemove.vals()) {
          fileOpIds.delete(opId);
          removedCount += 1;
        };

        #ok(removedCount);
      };
      case null { #ok(0) };
    };
  };

  // ===== LIVE EDITING SUPPORT =====

  // Apply a patch and create events
  func applyPatch(
    fileId : FileId,
    patch : Patch,
    commit : Types.Commit
  ) : Result<Seq, Error> {

    // Check for duplicate operation
    if (isDuplicateOperation(fileId, patch.clientOpId)) {
      return #err(#DuplicateOperation);
    };

    // Record operation
    recordOperation(fileId, patch.clientOpId);

    // Create patch applied event
    let event : Event = {
      seq = nextSeq;
      fileId = fileId;
      kind = #PatchApplied(commit);
      time = Types.now();
    };
    nextSeq += 1;

    addEvent(fileId, event);

    #ok(event.seq);
  };

  // Create snapshot event
  func createSnapshotEvent(
    fileId : FileId,
    version : Version
  ) : Result<Seq, Error> {

    let event : Event = {
      seq = nextSeq;
      fileId = fileId;
      kind = #Snapshot(version);
      time = Types.now();
    };
    nextSeq += 1;

    addEvent(fileId, event);

    #ok(event.seq);
  };

  // Create file deleted event
  func createFileDeletedEvent(
    fileId : FileId,
    by : Principal
  ) : Result<Seq, Error> {

    let event : Event = {
      seq = nextSeq;
      fileId = fileId;
      kind = #FileDeleted({ by = by });
      time = Types.now();
    };
    nextSeq += 1;

    addEvent(fileId, event);

    #ok(event.seq);
  };

  // Create file restored event
  func createFileRestoredEvent(
    fileId : FileId,
    by : Principal
  ) : Result<Seq, Error> {

    let event : Event = {
      seq = nextSeq;
      fileId = fileId;
      kind = #FileRestored({ by = by });
      time = Types.now();
    };
    nextSeq += 1;

    addEvent(fileId, event);

    #ok(event.seq);
  };

  // ===== UTILITY FUNCTIONS =====

  // Get current sequence number
  func getCurrentSeq() : Seq {
    nextSeq;
  };

  // Get event count for a file
  func getEventCount(fileId : FileId) : Nat {
    switch (eventsByFile.get(fileId)) {
      case (?buffer) { buffer.events.size() };
      case null { 0 };
    };
  };

  // Get active client count for a file
  func getActiveClientCount(fileId : FileId) : Nat {
    switch (presenceByFile.get(fileId)) {
      case (?filePresence) { filePresence.size() };
      case null { 0 };
    };
  };

  // Get subscription count for a file
  func getSubscriptionCount(fileId : FileId) : Nat {
    switch (subscriptionsByFile.get(fileId)) {
      case (?fileSubscriptions) { fileSubscriptions.size() };
      case null { 0 };
    };
  };

  // Check if client is active
  public func isClientActive(fileId : FileId, clientId : ClientId) : async Bool {
    switch (presenceByFile.get(fileId)) {
      case (?filePresence) {
        switch (filePresence.get(clientId)) {
          case (?presence) {
            let now = Types.now();
            (now - presence.lastSeen) < Types.CURSOR_TIMEOUT_NANOS;
          };
          case null { false };
        };
      };
      case null { false };
    };
  };

  // Get client cursor
  public func getClientCursor(fileId : FileId, clientId : ClientId) : async Result<Cursor, Error> {
    switch (presenceByFile.get(fileId)) {
      case (?filePresence) {
        switch (filePresence.get(clientId)) {
          case (?presence) {
            switch (presence.cursor) {
              case (?cursor) { #ok(cursor) };
              case null { #err(#NotFound) };
            };
          };
          case null { #err(#NotFound) };
        };
      };
      case null { #err(#NotFound) };
    };
  };

  // Get all cursors for a file
  public func getAllCursors(fileId : FileId) : async Result<[Cursor], Error> {
    switch (presenceByFile.get(fileId)) {
      case (?filePresence) {
        let cursors = Buffer.Buffer<Cursor>(0);
        let now = Types.now();

        for ((_, presence) in filePresence.entries()) {
          // Only include active clients with cursors
          if ((now - presence.lastSeen) < Types.CURSOR_TIMEOUT_NANOS) {
            switch (presence.cursor) {
              case (?cursor) { cursors.add(cursor) };
              case null { /* No cursor */ };
            };
          };
        };

        #ok(Buffer.toArray(cursors));
      };
      case null { #ok([]) };
    };
  };

  // Clean up all data for a file
  public func cleanupFileData(fileId : FileId) : async Result<{ events : Nat; presence : Nat; subscriptions : Nat; operations : Nat }, Error> {
    let eventCount = getEventCount(fileId);
    let presenceCount = getActiveClientCount(fileId);
    let subscriptionCount = getSubscriptionCount(fileId);

    let operationCount = switch (dedupeOpIdsByFile.get(fileId)) {
      case (?fileOpIds) { fileOpIds.size() };
      case null { 0 };
    };

    eventsByFile.delete(fileId);
    presenceByFile.delete(fileId);
    subscriptionsByFile.delete(fileId);
    dedupeOpIdsByFile.delete(fileId);

    #ok({
      events = eventCount;
      presence = presenceCount;
      subscriptions = subscriptionCount;
      operations = operationCount;
    });
  };

  // ===== STATE MANAGEMENT =====

  // Global version counter; commented out because stable var definition at the top of actor suffices
  // public var nextVersion : Nat = 0;

  // Version storage maps
  var commitsByFile = HashMap.HashMap<FileId, HashMap.HashMap<Version, VersionStorage>>(0, Nat32.equal, func(x : Nat32) : Nat32 { x });
  var headsByFile = HashMap.HashMap<FileId, Version>(0, Nat32.equal, func(x : Nat32) : Nat32 { x });

  // Create initial version for a new file
  func createInitialVersion(
    fileId : FileId,
    chunks : [ContentChunk],
    owner : Principal
  ) : Result<Version, Error> {

    let version = nextVersion;
    nextVersion += 1;

    // Create initial commit
    let commit : Commit = {
      version = version;
      parent = 0; // No parent for initial version
      patch = {
        base = 0;
        ops = [];
        clientId = "";
        clientOpId = "";
        timestamp = Types.now();
      };
      author = owner;
      message = ?"Initial version";
      time = Types.now();
      size = Types.calculateTotalSize(chunks);
      chunkCount = chunks.size();
    };

    // Store chunks
    let chunkMap = HashMap.HashMap<Nat, ContentChunk>(0, Nat.equal, Hash.hash);
    for (chunk in chunks.vals()) {
      chunkMap.put(chunk.index, chunk);
    };

    let versionStorage : VersionStorage = {
      commit = commit;
      chunks = chunkMap;
    };

    // Store version
    switch (commitsByFile.get(fileId)) {
      case (?fileVersions) {
        fileVersions.put(version, versionStorage);
      };
      case null {
        let newFileVersions = HashMap.HashMap<Version, VersionStorage>(0, Nat.equal, Hash.hash);
        newFileVersions.put(version, versionStorage);
        commitsByFile.put(fileId, newFileVersions);
      };
    };

    // Set as head
    headsByFile.put(fileId, version);

    #ok(version);
  };

  // Create a new commit from a patch
  func createCommit(
    fileId : FileId,
    patch : Patch,
    author : Principal,
    message : ?Text,
    newChunks : [ContentChunk]
  ) : Result<Version, Error> {

    // Get current head
    let currentHead = switch (headsByFile.get(fileId)) {
      case (?head) { head };
      case null { return #err(#NotFound) };
    };

    // Validate patch base version
    if (patch.base != currentHead) {
      return #err(#Conflict);
    };

    // Create new version
    let newVersion = nextVersion;
    nextVersion += 1;

    // Create commit
    let commit : Commit = {
      version = newVersion;
      parent = currentHead;
      patch = patch;
      author = author;
      message = message;
      time = Types.now();
      size = Types.calculateTotalSize(newChunks);
      chunkCount = newChunks.size();
    };

    // Store chunks
    let chunkMap = HashMap.HashMap<Nat, ContentChunk>(0, Nat.equal, Hash.hash);
    for (chunk in newChunks.vals()) {
      chunkMap.put(chunk.index, chunk);
    };

    let versionStorage : VersionStorage = {
      commit = commit;
      chunks = chunkMap;
    };

    // Store version
    switch (commitsByFile.get(fileId)) {
      case (?fileVersions) {
        fileVersions.put(newVersion, versionStorage);
      };
      case null {
        let newFileVersions = HashMap.HashMap<Version, VersionStorage>(0, Nat.equal, Hash.hash);
        newFileVersions.put(newVersion, versionStorage);
        commitsByFile.put(fileId, newFileVersions);
      };
    };

    // Update head
    headsByFile.put(fileId, newVersion);

    #ok(newVersion);
  };

  // Create a snapshot (manual save point)
  func createSnapshot(
    fileId : FileId,
    author : Principal,
    message : ?Text,
    chunks : [ContentChunk]
  ) : Result<Version, Error> {

    // Get current head
    let currentHead = switch (headsByFile.get(fileId)) {
      case (?head) { head };
      case null { return #err(#NotFound) };
    };

    // Create new version
    let newVersion = nextVersion;
    nextVersion += 1;

    // Create snapshot commit
    let commit : Commit = {
      version = newVersion;
      parent = currentHead;
      patch = {
        base = currentHead;
        ops = [];
        clientId = "";
        clientOpId = "";
        timestamp = Types.now();
      };
      author = author;
      message = message;
      time = Types.now();
      size = Types.calculateTotalSize(chunks);
      chunkCount = chunks.size();
    };

    // Store chunks
    let chunkMap = HashMap.HashMap<Nat, ContentChunk>(0, Nat.equal, Hash.hash);
    for (chunk in chunks.vals()) {
      chunkMap.put(chunk.index, chunk);
    };

    let versionStorage : VersionStorage = {
      commit = commit;
      chunks = chunkMap;
    };

    // Store version
    switch (commitsByFile.get(fileId)) {
      case (?fileVersions) {
        fileVersions.put(newVersion, versionStorage);
      };
      case null {
        let newFileVersions = HashMap.HashMap<Version, VersionStorage>(0, Nat.equal, Hash.hash);
        newFileVersions.put(newVersion, versionStorage);
        commitsByFile.put(fileId, newFileVersions);
      };
    };

    // Update head
    headsByFile.put(fileId, newVersion);

    #ok(newVersion);
  };

  // ===== VERSION READING =====

  // Get commit information for a specific version
  func getCommit(fileId : FileId, version : Version) : Result<Commit, Error> {
    switch (commitsByFile.get(fileId)) {
      case (?fileVersions) {
        switch (fileVersions.get(version)) {
          case (?versionStorage) { #ok(versionStorage.commit) };
          case null { #err(#NotFound) };
        };
      };
      case null { #err(#NotFound) };
    };
  };

  // Get chunks for a specific version
  func getVersionChunks(fileId : FileId, version : Version) : Result<[ContentChunk], Error> {
    switch (commitsByFile.get(fileId)) {
      case (?fileVersions) {
        switch (fileVersions.get(version)) {
          case (?versionStorage) {
            let chunkArray = Iter.toArray(versionStorage.chunks.entries());
            let sortedChunks = Array.sort(chunkArray, func(a : (Nat, ContentChunk), b : (Nat, ContentChunk)) : { #less; #equal; #greater } {
              if (a.0 < b.0) { #less } else if (a.0 > b.0) { #greater } else { #equal };
            });

            let chunks = Array.map<(Nat, ContentChunk), ContentChunk>(sortedChunks, func(pair) { pair.1 });
            #ok(chunks);
          };
          case null { #err(#NotFound) };
        };
      };
      case null { #err(#NotFound) };
    };
  };

  // Get a specific chunk from a version
  func getVersionChunk(fileId : FileId, version : Version, chunkIndex : Nat) : Result<ContentChunk, Error> {
    switch (commitsByFile.get(fileId)) {
      case (?fileVersions) {
        switch (fileVersions.get(version)) {
          case (?versionStorage) {
            switch (versionStorage.chunks.get(chunkIndex)) {
              case (?chunk) { #ok(chunk) };
              case null { #err(#NotFound) };
            };
          };
          case null { #err(#NotFound) };
        };
      };
      case null { #err(#NotFound) };
    };
  };

  // Get current head version for a file
  func getHeadVersion(fileId : FileId) : Result<Version, Error> {
    switch (headsByFile.get(fileId)) {
      case (?head) { #ok(head) };
      case null { #err(#NotFound) };
    };
  };

  // List versions for a file (paginated)
  public func listVersions(
    fileId : FileId,
    offset : Nat,
    limit : Nat
  ) : async Result<Paginated<Commit>, Error> {

    switch (commitsByFile.get(fileId)) {
      case (?fileVersions) {
        let commits = Buffer.Buffer<Commit>(0);
        var total : Nat = 0;

        // Convert to array and sort by version (newest first)
        let versionArray = Iter.toArray(fileVersions.entries());
        let sortedVersions = Array.sort(versionArray, func(a : (Version, VersionStorage), b : (Version, VersionStorage)) : { #less; #equal; #greater } {
          if (a.0 > b.0) { #less } else if (a.0 < b.0) { #greater } else { #equal };
        });

        for ((version, versionStorage) in sortedVersions.vals()) {
          total += 1;
          if (commits.size() < limit and total > offset) {
            commits.add(versionStorage.commit);
          };
        };

        let nextOffset = if (offset + limit < total) { ?(offset + limit) } else { null };

        #ok({
          items = Buffer.toArray(commits);
          next = nextOffset;
          total = total;
        });
      };
      case null { #err(#NotFound) };
    };
  };

  // Get version history (linear chain)
  public func getVersionHistory(fileId : FileId, fromVersion : Version) : async Result<[Commit], Error> {
    switch (commitsByFile.get(fileId)) {
      case (?fileVersions) {
        let history = Buffer.Buffer<Commit>(0);
        var currentVersion = fromVersion;

        label secondloop while (currentVersion > 0) {
          switch (fileVersions.get(currentVersion)) {
            case (?versionStorage) {
              history.add(versionStorage.commit);
              currentVersion := versionStorage.commit.parent;
            };
            case null { break secondloop };
          };
        };

        #ok(Buffer.toArray(history));
      };
      case null { #err(#NotFound) };
    };
  };

  // ===== VERSION COMPARISON =====

  // Get differences between two versions (for text files)
  public func getVersionDiff(
    fileId : FileId,
    fromVersion : Version,
    toVersion : Version
  ) : async Result<[EditOp], Error> {

    // Get commits for both versions
    let fromCommit = switch (getCommit(fileId, fromVersion)) {
      case (#ok(commit)) { commit };
      case (#err(error)) { return #err(error) };
    };

    let toCommit = switch (getCommit(fileId, toVersion)) {
      case (#ok(commit)) { commit };
      case (#err(error)) { return #err(error) };
    };

    // For now, return the patch operations from the target version
    // In a more sophisticated implementation, you would compute the actual diff
    #ok(toCommit.patch.ops);
  };

  // Check if one version is ancestor of another
  public func isAncestor(
    fileId : FileId,
    ancestor : Version,
    descendant : Version
  ) : async Result<Bool, Error> {

    if (ancestor == descendant) { return #ok(true) };

    switch (commitsByFile.get(fileId)) {
      case (?fileVersions) {
        var currentVersion = descendant;

        label thirdloop while (currentVersion > 0) {
          switch (fileVersions.get(currentVersion)) {
            case (?versionStorage) {
              if (versionStorage.commit.parent == ancestor) {
                return #ok(true);
              };
              currentVersion := versionStorage.commit.parent;
            };
            case null { break thirdloop};
          };
        };

        #ok(false);
      };
      case null { #err(#NotFound) };
    };
  };

  // ===== VERSION ROLLBACK =====

  // Rollback to a specific version
  func rollbackToVersion(
    fileId : FileId,
    targetVersion : Version,
    author : Principal,
    chunks : [ContentChunk]
  ) : Result<Version, Error> {

    // Verify target version exists
    switch (getCommit(fileId, targetVersion)) {
      case (#ok(_)) { /* Version exists */ };
      case (#err(error)) { return #err(error) };
    };

    // Get current head
    let currentHead = switch (headsByFile.get(fileId)) {
      case (?head) { head };
      case null { return #err(#NotFound) };
    };

    // Create rollback commit
    let newVersion = nextVersion;
    nextVersion += 1;

    let commit : Commit = {
      version = newVersion;
      parent = currentHead;
      patch = {
        base = currentHead;
        ops = []; // Rollback doesn't have specific operations
        clientId = "";
        clientOpId = "";
        timestamp = Types.now();
      };
      author = author;
      message = ?("Rollback to version " # Nat.toText(targetVersion));
      time = Types.now();
      size = Types.calculateTotalSize(chunks);
      chunkCount = chunks.size();
    };

    // Store chunks
    let chunkMap = HashMap.HashMap<Nat, ContentChunk>(0, Nat.equal, Hash.hash);
    for (chunk in chunks.vals()) {
      chunkMap.put(chunk.index, chunk);
    };

    let versionStorage : VersionStorage = {
      commit = commit;
      chunks = chunkMap;
    };

    // Store version
    switch (commitsByFile.get(fileId)) {
      case (?fileVersions) {
        fileVersions.put(newVersion, versionStorage);
      };
      case null {
        let newFileVersions = HashMap.HashMap<Version, VersionStorage>(0, Nat.equal, func(x : Nat) : Nat32{Nat32.fromNat(x)});
        newFileVersions.put(newVersion, versionStorage);
        commitsByFile.put(fileId, newFileVersions);
      };
    };

    // Update head
    headsByFile.put(fileId, newVersion);

    #ok(newVersion);
  };

  // ===== VERSION CLEANUP =====

  // Prune old versions (keep only recent ones)
  func pruneVersions(
    fileId : FileId,
    keepCount : Nat
  ) : Result<Nat, Error> {

    switch (commitsByFile.get(fileId)) {
      case (?fileVersions) {
        let versionArray = Iter.toArray(fileVersions.entries());
        let sortedVersions = Array.sort(versionArray, func(a : (Version, VersionStorage), b : (Version, VersionStorage)) : { #less; #equal; #greater } {
          if (a.0 > b.0) { #less } else if (a.0 < b.0) { #greater } else { #equal };
        });

        var deletedCount : Nat = 0;
        let headVersion = switch (headsByFile.get(fileId)) {
          case (?head) { head };
          case null { return #err(#NotFound) };
        };

        // Keep the head version and the specified number of recent versions
        for ((version, _) in sortedVersions.vals()) {
          if (version != headVersion and deletedCount < sortedVersions.size() - keepCount) {
            fileVersions.delete(version);
            deletedCount += 1;
          };
        };

        #ok(deletedCount);
      };
      case null { #err(#NotFound) };
    };
  };

  // Delete all versions for a file
  public func deleteAllVersions(fileId : FileId) : async Result<Nat, Error> {
    switch (commitsByFile.get(fileId)) {
      case (?fileVersions) {
        let count = fileVersions.size();
        commitsByFile.delete(fileId);
        headsByFile.delete(fileId);
        #ok(count);
      };
      case null { #ok(0) };
    };
  };

  // ===== UTILITY FUNCTIONS =====

  // Get version count for a file
  public func getVersionCount(fileId : FileId) : async Nat {
    switch (commitsByFile.get(fileId)) {
      case (?fileVersions) { fileVersions.size() };
      case null { 0 };
    };
  };

  // Get total storage used by versions
  public func getVersionStorageUsed(fileId : FileId) : async Nat {
    switch (commitsByFile.get(fileId)) {
      case (?fileVersions) {
        var total : Nat = 0;
        for ((_, versionStorage) in fileVersions.entries()) {
          total += versionStorage.commit.size;
        };
        total;
      };
      case null { 0 };
    };
  };

  // Check if version exists
  public func versionExists(fileId : FileId, version : Version) : async Bool {
    switch (commitsByFile.get(fileId)) {
      case (?fileVersions) { Option.isSome(fileVersions.get(version)) };
      case null { false };
    };
  };

  // Get latest commit message
  public func getLatestCommitMessage(fileId : FileId) : async Result<Text, Error> {
    switch (getHeadVersion(fileId)) {
      case (#ok(head)) {
        switch (getCommit(fileId, head)) {
          case (#ok(commit)) {
            switch (commit.message) {
              case (?message) { #ok(message) };
              case null { #ok("") };
            };
          };
          case (#err(error)) { #err(error) };
        };
      };
      case (#err(error)) { #err(error) };
    };
  };

  // Get commit author
  public func getCommitAuthor(fileId : FileId, version : Version) : async Result<Principal, Error> {
    switch (getCommit(fileId, version)) {
      case (#ok(commit)) { #ok(commit.author) };
      case (#err(error)) { #err(error) };
    };
  };

  // Get commit timestamp
  public func getCommitTime(fileId : FileId, version : Version) : async Result<Time.Time, Error> {
    switch (getCommit(fileId, version)) {
      case (#ok(commit)) { #ok(commit.time) };
      case (#err(error)) { #err(error) };
    };
  };

  system func postupgrade() {
    // Restore file storage using stable conversion
    for ((fileId, stableFileStorage) in stableFiles.vals()) {
      let fileStorage = stableToFileStorage(stableFileStorage);
      filesById.put(fileId, fileStorage);
    };

    // Restore version storage using stable conversion
    for ((fileId, versionEntries) in stableVersions.vals()) {
      let fileVersions = HashMap.HashMap<Version, Versions.VersionStorage>(0, Nat.equal, Hash.hash);
      for ((version, stableVersionStorage) in versionEntries.vals()) {
        let versionStorage = stableToVersionStorage(stableVersionStorage);
        fileVersions.put(version, versionStorage);
      };
      commitsByFile.put(fileId, fileVersions);
    };

    // Restore events
    for ((fileId, events) in stableEvents.vals()) {
      let buffer = createEventBuffer(fileId);
      for (event in events.vals()) {
        buffer.events.add(event);
      };
      eventsByFile.put(fileId, buffer);
    };

    // Restore presence
    for ((fileId, presenceEntries) in stablePresence.vals()) {
      let filePresence = HashMap.HashMap<ClientId, Realtime.ClientPresence>(0, Text.equal, Text.hash);
      for ((clientId, presence) in presenceEntries.vals()) {
        filePresence.put(clientId, presence);
      };
      presenceByFile.put(fileId, filePresence);
    };

    // Restore subscriptions
    for ((fileId, subscriptionEntries) in stableSubscriptions.vals()) {
      let fileSubscriptions = HashMap.HashMap<ClientId, Subscription>(0, Text.equal, Text.hash);
      for ((clientId, subscription) in subscriptionEntries.vals()) {
        fileSubscriptions.put(clientId, subscription);
      };
      subscriptionsByFile.put(fileId, fileSubscriptions);
    };

    // Restore autosave policies
    for ((fileId, state) in stableAutosavePolicies.vals()) {
      autosavePolicies.put(fileId, state);
    };

    // Restore global counters; commented out because the variables are already stable and don't need to recieve the state of
    //the variables from the different modules since all the functions have been moved to the main file from those modules.
    // nextFileId := nextFileId;
    // nextVersion := nextVersion;
    // nextSeq := nextSeq;

    // Clear stable arrays
    stableFiles := [];
    stableVersions := [];
    stableFilesByTableId := [];
    stableEvents := [];
    stablePresence := [];
    stableSubscriptions := [];
    stableAutosavePolicies := [];
  };

  // ===== FILE MANAGEMENT =====

  // Create a new file
  public shared ({ caller }) func create_file(
    name : Text,
    tableId : Nat,
    mime : Text,
    initialContent : ?Blob
  ) : async Result<FileId, Error> {

    // Create file
    switch (createFile(name, tableId, mime, caller, initialContent)) {
      case (#ok(fileId)) {
        // Get chunks for versioning
        switch (await getAllChunks(fileId)) {
          case (#ok(chunks)) {
            // Create initial version
            switch (createInitialVersion(fileId, chunks, caller)) {
              case (#ok(version)) {
                // Set up autosave policy
                let defaultPolicy = Autosave.getDefaultPolicy();
                ignore setAutosavePolicy(fileId, defaultPolicy);

                #ok(fileId);
              };
              case (#err(error)) { #err(error) };
            };
          };
          case (#err(error)) { #err(error) };
        };
      };
      case (#err(error)) { #err(error) };
    };
  };

  // Delete a file
  public shared ({ caller }) func delete_file(fileId : FileId) : async Result<(), Error> {
    switch (deleteFile(fileId, caller)) {
      case (#ok(_)) {
        // Create delete event
        ignore createFileDeletedEvent(fileId, caller);
        #ok(());
      };
      case (#err(error)) { #err(error) };
    };
  };

  // Restore a deleted file
  public shared ({ caller }) func restore_file(fileId : FileId) : async Result<(), Error> {
    switch (restoreFile(fileId, caller)) {
      case (#ok(_)) {
        // Create restore event
        ignore createFileRestoredEvent(fileId, caller);
        #ok(());
      };
      case (#err(error)) { #err(error) };
    };
  };

  // ===== CONTENT MANAGEMENT =====


  // Update a specific chunk
  public shared ({ caller }) func update_chunk(
    fileId : FileId,
    chunkIndex : Nat,
    data : Blob
  ) : async Result<Version, Error> {
    switch (updateChunk(fileId, chunkIndex, data, caller)) {
      case (#ok(version)) {
        // Record activity for autosave
        ignore await recordActivity(fileId);
        #ok(version);
      };
      case (#err(error)) { #err(error) };
    };
  };

  // Replace file content
  public shared ({ caller }) func replace_file_content(
    fileId : FileId,
    newChunks : [ContentChunk]
  ) : async Result<Version, Error> {
    switch (replaceFileContent(fileId, newChunks, caller)) {
      case (#ok(version)) {
        // Record activity for autosave
        ignore await recordActivity(fileId);
        #ok(version);
      };
      case (#err(error)) { #err(error) };
    };
  };

  // ===== ACCESS CONTROL =====

  // ===== VERSIONING =====

  // Get commit information
  public func get_commit(
    fileId : FileId,
    version : Version
  ) : async Result<Commit, Error> {
    getCommit(fileId, version);
  };

  // Get chunks for a specific version
  public func get_version_chunks(
    fileId : FileId,
    version : Version
  ) : async Result<[ContentChunk], Error> {
    getVersionChunks(fileId, version);
  };

  // Get current head version
  public func get_head_version(fileId : FileId) : async Result<Version, Error> {
    getHeadVersion(fileId);
  };

  // Create a snapshot
  public shared ({ caller }) func create_snapshot(
    fileId : FileId,
    message : ?Text
  ) : async Result<Version, Error> {
    switch (await getAllChunks(fileId)) {
      case (#ok(chunks)) {
        switch (createSnapshot(fileId, caller, message, chunks)) {
          case (#ok(version)) {
            // Create snapshot event
            ignore createSnapshotEvent(fileId, version);
            #ok(version);
          };
          case (#err(error)) { #err(error) };
        };
      };
      case (#err(error)) { #err(error) };
    };
  };

  // Rollback to a specific version
  public shared ({ caller }) func rollback_to_version(
    fileId : FileId,
    targetVersion : Version
  ) : async Result<Version, Error> {
    switch (getVersionChunks(fileId, targetVersion)) {
      case (#ok(chunks)) {
        switch (rollbackToVersion(fileId, targetVersion, caller, chunks)) {
          case (#ok(version)) {
            // Update file chunks
            ignore replaceFileContent(fileId, chunks, caller);
            #ok(version);
          };
          case (#err(error)) { #err(error) };
        };
      };
      case (#err(error)) { #err(error) };
    };
  };

  // ===== LIVE EDITING =====

  // Begin editing a file
  public func begin_edit(
    fileId : FileId,
    clientId : ClientId
  ) : async Result<{ headVersion : Version; seq : Seq; size : Nat }, Error> {
    switch (getFileMeta(fileId)) {
      case (#ok(meta)) {
        switch (getHeadVersion(fileId)) {
          case (#ok(headVersion)) {
            #ok({
              headVersion = headVersion;
              seq = getCurrentSeq();
              size = meta.size;
            });
          };
          case (#err(error)) { #err(error) };
        };
      };
      case (#err(error)) { #err(error) };
    };
  };

  // Apply a patch
  public shared ({ caller }) func apply_patch(
    fileId : FileId,
    patch : Patch
  ) : async Result<{ newVersion : Version; transformed : [EditOp] }, Error> {

    // Check for duplicate operation
    if (isDuplicateOperation(fileId, patch.clientOpId)) {
      return #err(#DuplicateOperation);
    };

    // Get current chunks
    switch (await getAllChunks(fileId)) {
      case (#ok(chunks)) {
        // Create commit
        switch (createCommit(fileId, patch, caller, null, chunks)) {
          case (#ok(version)) {
            // Apply patch to file content (simplified - in reality you'd apply the operations)
            // For now, we'll just update the file with the new chunks
            ignore replaceFileContent(fileId, chunks, caller);

            // Create event
            switch (getCommit(fileId, version)) {
              case (#ok(commit)) {
                ignore applyPatch(fileId, patch, commit);
              };
              case (#err(error)) { return #err(error) };
            };

            #ok({
              newVersion = version;
              transformed = patch.ops; // In a real implementation, you'd transform the ops
            });
          };
          case (#err(error)) { #err(error) };
        };
      };
      case (#err(error)) { #err(error) };
    };
  };

  // ===== PRESENCE AND COLLABORATION =====

  // Join a file
  public shared ({ caller }) func join_file(
    fileId : FileId,
    clientId : ClientId
  ) : async Result<{ headVersion : Version; since : Seq }, Error> {
    switch (getHeadVersion(fileId)) {
      case (#ok(headVersion)) {
        switch (joinFile(fileId, clientId, caller)) {
          case (#ok(seq)) {
            #ok({
              headVersion = headVersion;
              since = seq;
            });
          };
          case (#err(error)) { #err(error) };
        };
      };
      case (#err(error)) { #err(error) };
    };
  };


  // Update cursor
  public shared ({ caller }) func update_cursor(
    fileId : FileId,
    cursor : Cursor
  ) : async Result<(), Error> {
    updatePresence(fileId, cursor.clientId, ?cursor);
  };

  // ===== AUTOSAVE =====

  // Set autosave policy
  public shared ({ caller }) func set_autosave_policy(
    fileId : FileId,
    policy : AutosavePolicy
  ) : async Result<(), Error> {
    await setAutosavePolicy(fileId, policy);
  };

  // Get autosave policy
  public func get_autosave_policy(fileId : FileId) : async Result<AutosavePolicy, Error> {
    await getAutosavePolicy(fileId);
  };

  // Check if autosave is due
  public func is_autosave_due(fileId : FileId) : async Result<Bool, Error> {
    await isAutosaveDue(fileId);
  };

  // Get autosave statistics
  public func get_autosave_stats(fileId : FileId) : async Result<{ autosaveCount : Nat; lastAutosave : Time.Time; pendingChanges : Bool }, Error> {
    await getAutosaveStats(fileId);
  };

  public func saveFunction(fileId : FileId, user : Principal) : async Result<Version, Error> {
    switch (await getAllChunks(fileId)) {
      case (#ok(chunks)) {
        createSnapshot(fileId, user, ?"Autosave", chunks);
      };
      case (#err(error)) { #err(error) };
    };
  };

  // Process autosave for a file
  public shared ({ caller }) func process_autosave(fileId : FileId) : async Result<Version, Error> {
    switch (autosavePolicies.get(fileId)) {
      case (?state) {
        if (not state.policy.enabled) {
          return #err(#InvalidOperation);
        };

        let now = Types.now();
        let timeSinceActivity = now - state.lastActivity;
        let timeSinceLastAutosave = now - state.lastAutosave;

        // Check if autosave is needed
        if (not state.pendingChanges) {
          return #err(#InvalidOperation); // No changes to save
        };

        if (timeSinceLastAutosave < state.policy.intervalNanos) {
          return #err(#InvalidOperation); // Too soon since last autosave
        };

        if (timeSinceActivity < state.policy.idleNanos) {
          return #err(#InvalidOperation); // File not idle enough
        };

        // Perform autosave
        switch (await saveFunction(fileId, caller)) {
          case (#ok(version)) {
            // Mark as saved
            ignore markSaved(fileId);
            #ok(version);
          };
          case (#err(error)) { #err(error) };
        };
      };
      case null { #err(#NotFound) };
    };
  };

  // Process all pending autosaves
  public shared(msg) func processAllAutosaves(
    user : Principal
  ) : async Result<{ processed : Nat; errors : [Text] }, Error> {

    let filesToProcess = await getFilesNeedingAutosave();
    let results = Buffer.Buffer<Text>(0);
    var processedCount : Nat = 0;

    for (fileId in filesToProcess.vals()) {
      switch (await process_autosave(fileId)) {
        case (#ok(_)) { processedCount += 1 };
        case (#err(error)) {
          results.add("File " # Nat32.toText(fileId) # ": " # Types.errorMessage(error));
        };
      };
    };

    #ok({
      processed = processedCount;
      errors = Buffer.toArray(results);
    });
  };


  // ===== SYSTEM FUNCTIONS =====

  // System heartbeat for maintenance
  system func heartbeat() : async () {
    // Clean up stale clients
    for ((fileId, _) in presenceByFile.entries()) {
      ignore cleanupStaleClients(fileId);
    };

    // Process autosaves
    let filesNeedingAutosave = await getFilesNeedingAutosave();
    if (filesNeedingAutosave.size() > 0) {
      // In a real implementation, you'd process autosaves here
      // For now, we'll just log that autosaves are needed
      Debug.print("Files needing autosave: " # Nat.toText(filesNeedingAutosave.size()));
    };
  };

  // ===== UTILITY FUNCTIONS =====

  // Get storage statistics
  public query func get_storage_stats() : async {
    totalFiles : Nat;
    totalVersions : Nat;
    totalEvents : Nat;
    activeClients : Nat;
  } {
    var totalFiles : Nat = 0;
    var totalVersions : Nat = 0;
    var totalEvents : Nat = 0;
    var activeClients : Nat = 0;

    // Count files
    for ((_, _) in filesById.entries()) {
      totalFiles += 1;
    };

    // Count versions
    for ((_, fileVersions) in commitsByFile.entries()) {
      totalVersions += fileVersions.size();
    };

    // Count events
    for ((_, buffer) in eventsByFile.entries()) {
      totalEvents += buffer.events.size();
    };

    // Count active clients
    for ((_, filePresence) in presenceByFile.entries()) {
      activeClients += filePresence.size();
    };

    {
      totalFiles = totalFiles;
      totalVersions = totalVersions;
      totalEvents = totalEvents;
      activeClients = activeClients;
    };
  };

  // Clean up old data
  public shared ({ caller }) func cleanup_old_data() : async Result<{ files : Nat; versions : Nat; events : Nat }, Error> {
    // Only allow cleanup by authorized users (e.g., canister controller)
    if (not Principal.equal(caller, Principal.fromText("2vxsx-fae"))) {
      return #err(#AccessDenied);
    };

    var filesCleaned : Nat = 0;
    var versionsCleaned : Nat = 0;
    var eventsCleaned : Nat = 0;

    // Clean up deleted files
    filesCleaned := cleanupDeletedFiles();

    // Clean up old versions (keep only last 10 for each file)
    for ((fileId, _) in commitsByFile.entries()) {
      switch (pruneVersions(fileId, 10)) {
        case (#ok(count)) { versionsCleaned += count };
        case (#err(_)) { /* Ignore errors */ };
      };
    };

    // Clean up old events (keep only last 1000 per file)
    for ((fileId, buffer) in eventsByFile.entries()) {
      while (buffer.events.size() > 1000) {
        ignore buffer.events.remove(0);
        eventsCleaned += 1;
      };
    };

    #ok({
      files = filesCleaned;
      versions = versionsCleaned;
      events = eventsCleaned;
    });
  };
}


